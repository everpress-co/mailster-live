<?php

class MailsterLive {

	private $plugin_dir;
	private $plugin_url;
	private $offset    = 0;
	private $maxlive   = 1200;
	private $ajaxpause = 3000;

	public function __construct() {

		$this->plugin_dir = dirname( MAILSTER_LIVE_FILE );
		$this->plugin_url = plugins_url() . '/' . basename( $this->plugin_dir );

		register_activation_hook( MAILSTER_LIVE_FILE, array( &$this, 'activate' ) );
		register_deactivation_hook( MAILSTER_LIVE_FILE, array( &$this, 'deactivate' ) );

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

		$return['success']  = false;
		$return['loggedin'] = is_user_logged_in();

		if ( ! $return['loggedin'] ) {
			$return['msg'] = sprintf( __( 'You have been logged out. Click %s to sign in again!', 'mailster-live' ), '<a href="post.php?post=' . ( isset( $_POST['campaign_id'] ) ? intval( $_POST['campaign_id'] ) : 0 ) . '&action=edit">' . __( 'here', 'mailster-live' ) . '</a>' );
		}

		$this->ajax_nonce( json_encode( $return ) );

		$user_id     = isset( $_POST['user_id'] ) ? intval( $_POST['user_id'] ) : null;
		$campaign_id = isset( $_POST['campaign_id'] ) ? intval( $_POST['campaign_id'] ) : null;
		$timestamp   = isset( $_POST['timestamp'] ) ? intval( $_POST['timestamp'] ) : time();

		// get the latest 2 minutes if the first visit
		if ( ! $timestamp ) {
			$this->offset = $this->maxlive;
		}

		$return['success'] = true;
		$return['pause']   = $this->ajaxpause;

		$return['actions']   = $this->get( $timestamp, $user_id, $campaign_id );
		$return['count']     = count( $return['actions'] );
		$return['timestamp'] = time();
		$return['maxlive']   = $this->maxlive;

		wp_send_json( $return );
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

			if ( ! in_array( $post->post_status, array( 'finished', 'active', 'autoresponder' ) ) && ! isset( $_GET['showstats'] ) ) {
				return;
			}

			if ( $post->post_status == 'autoresponder' && ( ! isset( $_GET['showstats'] ) || ! $_GET['showstats'] ) ) {
				return;
			}
		} else {
			return;
		}

		$suffix = SCRIPT_DEBUG ? '' : '.min';

		wp_enqueue_script( 'google-maps-api', $this->get_google_api_endpoint() );
		wp_enqueue_script( 'mailster-live', $this->plugin_url . '/assets/js/script' . $suffix . '.js', array( 'jquery' ), MAILSTER_LIVE_VERSION );
		wp_enqueue_style( 'mailster-live', $this->plugin_url . '/assets/css/style' . $suffix . '.css', array(), MAILSTER_LIVE_VERSION );
		wp_localize_script(
			'mailster-live',
			'mailsterlive',
			array(
				'url'         => $this->plugin_url,
				'maxlive'     => $this->maxlive,
				'pauseonblur' => mailster_option( 'live_pauseonblur' ),
				'maptype'     => mailster_option( 'live_maptype', 'roadmap' ),
				'markers'     => array(
					'open'           => $this->plugin_url . '/assets/img/green.png',
					'click'          => $this->plugin_url . '/assets/img/blue.png',
					'unsubscribe'    => $this->plugin_url . '/assets/img/red.png',
					'other'          => $this->plugin_url . '/assets/img/yellow.png',
					'open_2x'        => $this->plugin_url . '/assets/img/green_2x.png',
					'click_2x'       => $this->plugin_url . '/assets/img/blue_2x.png',
					'unsubscribe_2x' => $this->plugin_url . '/assets/img/red_2x.png',
					'other_2x'       => $this->plugin_url . '/assets/img/yellow_2x.png',
				),
				'mapoptions'  => mailster_option(
					'live_map',
					array(
						'zoom' => 2,
						'lat'  => 47.059745395225704,
						'lng'  => 7.464083442187537,
					)
				),
				'secago'      => __( '%s sec ago', 'mailster-live' ),
				'minago'      => __( '%s min ago', 'mailster-live' ),
				'hourago'     => __( '%s hours ago', 'mailster-live' ),
				'messages'    => array(
					'open'  => __( 'opened the newsletter', 'mailster-live' ),
					'click' => __( 'clicked a link', 'mailster-live' ),
					'unsub' => _x( 'unsubscribed', 'the verb', 'mailster-live' ),
				),
			)
		);

	}


	public function add_meta_boxes() {

		global $post;

		if ( ! in_array( $post->post_status, array( 'finished', 'active', 'autoresponder' ) ) && ! isset( $_GET['showstats'] ) ) {
			return;
		}

		if ( $post->post_status == 'autoresponder' && ( ! isset( $_GET['showstats'] ) || ! $_GET['showstats'] ) ) {
			return;
		}

		add_meta_box( 'mailster_live', __( 'Live!', 'mailster-live' ), array( &$this, 'metabox' ), 'newsletter', 'normal', 'high' );
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
			$endpoint = add_query_arg(
				array(
					'key' => $key,
				),
				$endpoint
			);
		}

		return $endpoint;

	}


	public function settings() {

		include $this->plugin_dir . '/views/settings.php';

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

		$index = null;
		$limit = 200;
		$types = array( 'opens', 'clicks', 'unsubs' );

		$timeformat = get_option( 'date_format' ) . ' ' . get_option( 'time_format' );
		$timeoffset = get_option( 'gmt_offset' ) * 3600;
		if ( empty( $timestamp ) ) {
			$timestamp = time() - $this->maxlive;
		}
		$activities = mailster( 'actions' )->get_activity( $campaign_id, $subscriber_id, $index, $limit, $timestamp, $types );

		$activities = array_reverse( $activities );

		$return = array();

		foreach ( $activities as $activity ) {

			$subscriber = mailster( 'subscribers' )->get( $activity->subscriber_id, true );
			$action     = array();

			$action['hash']     = md5( serialize( $activity ) );
			$action['gravatar'] = mailster( 'subscribers' )->get_gravatar( $subscriber->ID, 120 );

			$action['coords']        = explode( ',', mailster( 'subscribers' )->meta( $subscriber->ID, 'coords' ) );
			$action['geo']           = explode( '|', mailster( 'subscribers' )->meta( $subscriber->ID, 'geo' ) );
			$action['formatedtime']  = date( $timeformat, $activity->timestamp + $timeoffset );
			$action['name']          = $subscriber->fullname;
			$action['email']         = $subscriber->email;
			$action['subscriber_id'] = $subscriber->ID;
			$action['type']          = $activity->type;
			$action['link']          = $activity->link;
			$action['timestamp']     = $activity->timestamp;
			// $action['time']          = $activity->time;
			if ( empty( $action['name'] ) ) {
				$action['name'] = $subscriber->email;
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
		$msg = sprintf( esc_html__( 'You have to enable the %s to use Mailster Live!', 'mailster-live' ), '<a href="https://mailster.co/?utm_campaign=wporg&utm_source=wordpress.org&utm_medium=plugin&utm_term=Mailster+Live">Mailster Newsletter Plugin</a>' );
		?>
		<div class="error"><p><strong><?php echo $msg; ?></strong></p></div>
		<?php

	}

}
