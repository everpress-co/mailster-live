<?php
/*
Plugin Name: Mailster Live!
Plugin URI: https://mailster.co/?utm_campaign=wporg&utm_source=Mailster+Live
Description: see who opens your newsletter campaigns in real time
Version: 1.0
Author: EverPress
Author URI: https://everpress.io
Text Domain: mailster-live
License: GPLv2 or later
*/

class MailsterLive {

	private $version = '1.0';
	private $plugin_dir;
	private $plugin_url;
	private $offset = 0;
	private $maxlive = 1200;
	private $ajaxpause = 3000;

	public function __construct() {

		$this->plugin_dir = dirname( __FILE__ );
		$this->plugin_url = plugins_url() . '/' . basename( $this->plugin_dir );

		register_activation_hook( $this->plugin_dir . '/mailster-live.php', array( &$this, 'activate' ) );
		register_deactivation_hook( $this->plugin_dir . '/mailster-live.php', array( &$this, 'deactivate' ) );

		load_plugin_textdomain( 'mailster-live' );

		add_action( 'plugins_loaded', array( &$this, 'init' ) );
		add_filter( 'mailster_capabilities', array( &$this, 'capabilities' ) );

	}


	public function init() {

		if ( ! function_exists( 'mailster' ) ) {

			add_action( 'admin_notices', array( &$this, 'notice' ) );
			return;

		}

		$this->maxlive = mailster_option( 'live_minutes', 20 ) * 60;

		if ( is_admin() ) {

			if ( current_user_can( 'mailster_live' ) ) {
				add_action( 'load-newsletter_page_mailster_dashboard', array( &$this, 'register_meta_boxes' ) );
				add_action( 'add_meta_boxes', array( &$this, 'add_meta_boxes' ) );
				add_action( 'admin_enqueue_scripts', array( &$this, 'scripts' ) );
			}

			add_filter( 'mailster_setting_sections', array( &$this, 'settings_tab' ) );
			add_action( 'mailster_section_tab_live', array( &$this, 'settings' ) );

		}

		add_action( 'wp_ajax_mailster_live_check', array( &$this, 'ajax_check' ) );

	}



	public function register_meta_boxes() {

		mailster( 'dashboard' )->register_meta_box( 'live', __( 'Live!', 'mailster' ), array( &$this, 'metabox' ), 'side' );

	}


	/**
	 *
	 *
	 * @param unknown $settings
	 * @return unknown
	 */
	public function settings_tab( $settings ) {

		$position = 4;
		$settings = array_slice( $settings, 0, $position, true ) +
			array( 'live' => 'Live!' ) +
			array_slice( $settings, $position, null, true );

		return $settings;
	}


	/**
	 *
	 *
	 * @param unknown $capabilities
	 * @return unknown
	 */
	public function capabilities( $capabilities ) {
		$capabilities['mailster_live'] = array(
			'title' => sprintf( __( 'view %s', 'mailster-live' ), 'Live!' ),
			'roles' => array( 'contributor', 'author', 'editor' ),
		);

		return $capabilities;
	}


	public function ajax_check() {

		$return['success'] = false;
		$return['loggedin'] = is_user_logged_in();

		if ( ! $return['loggedin'] ) {
			$return['msg'] = sprintf( __( 'You have been logged out. Click %s to sign in again!', 'mailster-live' ), '<a href="post.php?post=' . ( isset( $_POST['campaign_id'] ) ? intval( $_POST['campaign_id'] ) : 0 ) . '&action=edit">' . __( 'here', 'mailster-live' ) . '</a>' );
		}

		$this->ajax_nonce( json_encode( $return ) );

		$user_id = isset( $_POST['user_id'] ) ? intval( $_POST['user_id'] ) : null;
		$campaign_id = isset( $_POST['campaign_id'] ) ? intval( $_POST['campaign_id'] ) : null;
		$timestamp = isset( $_POST['timestamp'] ) ? intval( $_POST['timestamp'] ) : time();

		// get the latest 2 minutes if the first visit
		if ( ! $timestamp ) {
			$this->offset = $this->maxlive;
		}

		$return['success'] = true;
		$return['pause'] = $this->ajaxpause;

		$return['actions'] = $this->get( $timestamp, $user_id, $campaign_id );
		$return['count'] = count( $return['actions'] );
		$return['timestamp'] = time();
		$return['maxlive'] = $this->maxlive;

		@header( 'Content-type: application/json' );
		echo json_encode( $return );
		exit;
	}


	/**
	 *
	 *
	 * @param unknown $return (optional)
	 * @param unknown $nonce  (optional)
	 */
	private function ajax_nonce( $return = null, $nonce = 'mailster_nonce' ) {
		if ( ! wp_verify_nonce( $_REQUEST['_wpnonce'], $nonce ) ) {
			if ( is_string( $return ) ) {
				wp_die( $return );
			} else {
				die( $return );
			}
		}

	}


	/**
	 *
	 *
	 * @param unknown $hook
	 */
	public function scripts( $hook ) {

		global $post;

		$screen = get_current_screen();

		if ( 'newsletter_page_mailster_dashboard' == $screen->id ) {

		} elseif ( isset( $post ) ) {

			if ( ( 'newsletter' != get_post_type() ) || ( 'edit.php' == $hook ) ) {
				return;
			}

			if ( ! in_array( $post->post_status, array( 'finished', 'active', 'autoresponder' ) ) ) {
				return;
			}

			if ( $post->post_status == 'autoresponder' && ( ! isset( $_GET['showstats'] ) || ! $_GET['showstats'] ) ) {
				return;
			}
		} else {
			return;
		}

		wp_enqueue_script( 'google-maps-api', $this->get_google_api_endpoint() );
		wp_enqueue_script( 'mailster-live', $this->plugin_url . '/assets/js/script.js', array( 'jquery' ), $this->version );
		wp_enqueue_style( 'mailster-live', $this->plugin_url . '/assets/css/style.css', array(), $this->version );
		wp_localize_script( 'mailster-live', 'mailsterlive', array(
				'url' => $this->plugin_url,
				'maxlive' => $this->maxlive,
				'pauseonblur' => mailster_option( 'live_pauseonblur' ),
				'maptype' => mailster_option( 'live_maptype', 'roadmap' ),
				'markers' => array(
					'open' => $this->plugin_url . '/assets/img/green.png',
					'click' => $this->plugin_url . '/assets/img/blue.png',
					'unsubscribe' => $this->plugin_url . '/assets/img/red.png',
					'other' => $this->plugin_url . '/assets/img/yellow.png',
					'open_2x' => $this->plugin_url . '/assets/img/green_2x.png',
					'click_2x' => $this->plugin_url . '/assets/img/blue_2x.png',
					'unsubscribe_2x' => $this->plugin_url . '/assets/img/red_2x.png',
					'other_2x' => $this->plugin_url . '/assets/img/yellow_2x.png',
				),
				'mapoptions' => mailster_option( 'live_map', array(
						'zoom' => 2,
						'lat' => 47.059745395225704,
						'lng' => 7.464083442187537,
				) ),
				'secago' => __( '%s sec ago', 'mailster-live' ),
				'minago' => __( '%s min ago', 'mailster-live' ),
				'hourago' => __( '%s hours ago', 'mailster-live' ),
				'messages' => array(
					'2' => __( 'opened the newsletter', 'mailster-live' ),
					'3' => __( 'clicked a link', 'mailster-live' ),
					'4' => _x( 'unsubscribed', 'the verb', 'mailster-live' ),
				),
		) );

	}


	public function add_meta_boxes() {

		global $post;

		if ( ! in_array( $post->post_status, array( 'finished', 'active', 'autoresponder' ) ) ) {
			return;
		}

		if ( $post->post_status == 'autoresponder' && ( ! isset( $_GET['showstats'] ) || ! $_GET['showstats'] ) ) {
			return;
		}

		add_meta_box( 'mailster_live', 'Live!', array( &$this, 'metabox' ), 'newsletter', 'normal', 'high' );
	}


	public function metabox() {

		include $this->plugin_dir . '/views/metabox.php';

	}


	/**
	 *
	 *
	 * @return unknown
	 */
	public function get_google_api_endpoint() {

		$endpoint = 'https://maps.googleapis.com/maps/api/js';

		if ( $key = mailster_option( 'google_api_key' ) ) {
			$endpoint = add_query_arg( array(
					'key' => $key,
			), $endpoint );
		}

		return $endpoint;

	}


	public function settings() {

		$mapoptions = mailster_option( 'live_map', array(
				'zoom' => 2,
				'lat' => 47.059745395225704,
				'lng' => 7.464083442187537,
		) );
		$maptype = mailster_option( 'live_maptype', 'roadmap' );

		wp_enqueue_script( 'google-maps-api', $this->get_google_api_endpoint() );
		wp_enqueue_script( 'mailster-live-settings', $this->plugin_url . '/assets/js/settings-script.js', array( 'jquery' ), $this->version );
		wp_localize_script( 'mailster-live-settings', 'mailsterlive', array(
				'zoom' => $mapoptions['zoom'],
				'lat' => $mapoptions['lat'],
				'lng' => $mapoptions['lng'],
				'maptype' => mailster_option( 'live_maptype', 'roadmap' ),
		) );

?>
	<table class="form-table">
		<tr valign="top">
			<th scope="row"><?php _e( 'Live', 'mailster-live' )?></th>
			<td><p><?php echo sprintf( __( 'Use the latest %s minutes for the Live! feature', 'mailster-live' ), '<input type="text" name="mailster_options[live_minutes]" value="' . esc_attr( mailster_option( 'live_minutes', 20 ) ) . '" class="small-text">' ) ?></p></td>
		</tr>
		<tr valign="top">
			<th scope="row"><?php _e( 'Map default settings', 'mailster-live' )?><p class="description"><?php _e( 'define the default section and type of the map by dragging and zooming to the desired region', 'mailster-live' );?></p></th>
			<td>
			<input type="hidden" id="mailster_live_zoom" name="mailster_options[live_map][zoom]" value="<?php echo esc_attr( $mapoptions['zoom'] ); ?>" />
			<input type="hidden" id="mailster_live_lat" name="mailster_options[live_map][lat]" value="<?php echo esc_attr( $mapoptions['lat'] ); ?>" />
			<input type="hidden" id="mailster_live_lng" name="mailster_options[live_map][lng]" value="<?php echo esc_attr( $mapoptions['lng'] ); ?>" /></label>
			<input type="hidden" id="mailster_live_maptype" name="mailster_options[live_maptype]" value="<?php echo esc_attr( $maptype ) ?>" /></label>
			<div id="mailster_live_map" style="width:700px;height:430px"></div>
			</td>
		</tr>
		<tr valign="top">
			<th scope="row"><?php _e( 'Meta Box height', 'mailster-live' )?></th>
			<td><p><input type="text" name="mailster_options[live_height]" value="<?php echo esc_attr( mailster_option( 'live_height', 500 ) ) ?>" class="small-text"> <?php _e( 'pixels', 'mailster-live' );?></p></td>
		</tr>
		<tr valign="top">
			<th scope="row"><?php _e( 'Pause on blur', 'mailster-live' );?></th>
			<td><label><input type="checkbox" name="mailster_options[live_pauseonblur]" value="1" <?php checked( mailster_option( 'live_pauseonblur' ) );?>> <?php _e( 'pause Live! modus if browser window doesn\'t have focus', 'mailster-live' )?> <span class="description">(<?php _e( 'recommended', 'mailster-live' );?>)</span> </label></td>
		</tr>
	</table>
	<?php

	}


	/**
	 *
	 *
	 * @param unknown $timestamp     (optional)
	 * @param unknown $subscriber_id (optional)
	 * @param unknown $campaign_id   (optional)
	 * @return unknown
	 */
	private function get( $timestamp = '', $subscriber_id = null, $campaign_id = null ) {

		global $wpdb;

		$timeformat = get_option( 'date_format' ) . ' ' . get_option( 'time_format' );
		$timeoffset = get_option( 'gmt_offset' ) * 3600;
		if ( empty( $timestamp ) ) {
			$timestamp = time() - $this->maxlive;
		}

		$campaign_ids = is_array( $campaign_id ) ? $campaign_id : ( is_numeric( $campaign_id ) ? array( $campaign_id ) : null );
		$subscriber_ids = is_array( $subscriber_id ) ? $subscriber_id : ( is_numeric( $subscriber_id ) ? array( $subscriber_id ) : null );

		$sql = "SELECT a.type,a.subscriber_id AS subscriber_id,s.email AS email, a.campaign_id AS campaign_id,a.timestamp AS timestamp,geo.meta_value AS geo,coords.meta_value AS coords,l.link, TRIM(CONCAT(IFNULL(firstname.meta_value, ''), ' ', IFNULL(lastname.meta_value, ''))) as name FROM {$wpdb->prefix}mailster_actions AS a LEFT JOIN {$wpdb->prefix}mailster_subscribers AS s ON s.ID = a.subscriber_id LEFT JOIN {$wpdb->prefix}mailster_subscriber_fields AS firstname ON firstname.subscriber_id = a.subscriber_id AND firstname.meta_key = 'firstname' LEFT JOIN {$wpdb->prefix}mailster_subscriber_fields AS lastname ON lastname.subscriber_id = a.subscriber_id AND lastname.meta_key = 'lastname' LEFT JOIN {$wpdb->prefix}mailster_links AS l ON l.ID = a.link_id";

		$sql .= " LEFT JOIN {$wpdb->prefix}mailster_subscriber_meta AS geo ON geo.subscriber_id = a.subscriber_id AND geo.meta_key = 'geo'";
		if ( ! empty( $campaign_ids ) ) {
			$sql .= ' AND geo.campaign_id IN (' . implode( ',', $campaign_ids ) . ')';
		}

		$sql .= " LEFT JOIN {$wpdb->prefix}mailster_subscriber_meta AS coords  ON coords.subscriber_id = a.subscriber_id AND coords.meta_key = 'coords'";
		if ( ! empty( $campaign_ids ) ) {
			$sql .= ' AND coords.campaign_id IN (' . implode( ',', $campaign_ids ) . ')';
		}

		$sql .= ' WHERE a.timestamp >= %d';

		if ( ! empty( $campaign_ids ) ) {
			$sql .= ' AND a.campaign_id IN (' . implode( ',', $campaign_ids ) . ')';
		}

		if ( ! empty( $subscriber_ids ) ) {
			$sql .= ' AND a.subscriber_id IN (' . implode( ',', $subscriber_id ) . ')';
		}

		$sql .= ' AND a.type IN (2,3,4) GROUP BY a.type, a.subscriber_id, a.campaign_id, l.link ORDER BY a.timestamp ASC LIMIT 200';

		$actions = $wpdb->get_results( $wpdb->prepare( $sql, $timestamp ) );

		$count = 0;
		$return = array();

		foreach ( $actions as $action ) {

			$action->hash = md5( serialize( $action ) );
			$action->gravatar = mailster( 'subscribers' )->get_gravatar_uri( $action->email, 120 );
			$action->coords = $action->coords ? explode( ',', $action->coords ) : null;
			$action->geo = $action->geo ? explode( '|', $action->geo ) : null;
			$action->formatedtime = date( $timeformat, $action->timestamp + $timeoffset );
			if ( empty( $action->name ) ) {
				$action->name = $action->email;
			}

			$return[] = $action;

		}

		return $return;

	}


	public function activate() {
		if ( function_exists( 'mailster' ) ) {
			mailster( 'settings' )->update_capabilities();
		}

	}


	public function deactivate() {
		if ( function_exists( 'mailster' ) ) {
			mailster( 'settings' )->update_capabilities();
		}
	}


	public function notice() {
		$msg = sprintf( __( 'You have to enable the %s to use Mailster Live!', 'mailster-live' ), '<a href="http://rxa.li/mailster?utm_campaign=plugin&utm_medium=link&utm_source=Mailster+Live!">Mailster Newsletter Plugin</a>' );
?>
		<div class="error"><p><strong><?php echo $msg; ?></strong></p></div>
	<?php

	}

}


new MailsterLive();
