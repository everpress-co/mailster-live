<?php
	$mapoptions = mailster_option(
		'live_map',
		array(
			'zoom' => 2,
			'lat'  => 47.059745395225704,
			'lng'  => 7.464083442187537,
		)
	);
	$maptype    = mailster_option( 'live_maptype', 'roadmap' );

	wp_enqueue_script( 'google-maps-api', $this->get_google_api_endpoint() );
	wp_enqueue_script( 'mailster-live-settings', $this->plugin_url . '/assets/js/settings-script.js', array( 'jquery' ), MAILSTER_LIVE_VERSION );
	wp_localize_script(
		'mailster-live-settings',
		'mailsterlive',
		array(
			'zoom'    => $mapoptions['zoom'],
			'lat'     => $mapoptions['lat'],
			'lng'     => $mapoptions['lng'],
			'maptype' => mailster_option( 'live_maptype', 'roadmap' ),
		)
	);

	?>
<table class="form-table">
	<tr valign="top">
		<th scope="row"><?php esc_html_e( 'Live', 'mailster-live' ); ?></th>
		<td><p><?php printf( __( 'Use the latest %s minutes for the Live! feature', 'mailster-live' ), '<input type="text" name="mailster_options[live_minutes]" value="' . esc_attr( mailster_option( 'live_minutes', 20 ) ) . '" class="small-text">' ); ?></p></td>
	</tr>
	<tr valign="top">
		<th scope="row"><?php esc_html_e( 'Map default settings', 'mailster-live' ); ?><p class="description"><?php esc_html_e( 'define the default section and type of the map by dragging and zooming to the desired region', 'mailster-live' ); ?></p></th>
		<td>
		<input type="hidden" id="mailster_live_zoom" name="mailster_options[live_map][zoom]" value="<?php echo esc_attr( $mapoptions['zoom'] ); ?>" />
		<input type="hidden" id="mailster_live_lat" name="mailster_options[live_map][lat]" value="<?php echo esc_attr( $mapoptions['lat'] ); ?>" />
		<input type="hidden" id="mailster_live_lng" name="mailster_options[live_map][lng]" value="<?php echo esc_attr( $mapoptions['lng'] ); ?>" /></label>
		<input type="hidden" id="mailster_live_maptype" name="mailster_options[live_maptype]" value="<?php echo esc_attr( $maptype ); ?>" /></label>
		<div id="mailster_live_map" style="width:700px;height:430px"></div>
		</td>
	</tr>
	<tr valign="top">
		<th scope="row"><?php esc_html_e( 'Meta Box height', 'mailster-live' ); ?></th>
		<td><p><input type="text" name="mailster_options[live_height]" value="<?php echo esc_attr( mailster_option( 'live_height', 500 ) ); ?>" class="small-text"> <?php esc_html_e( 'pixels', 'mailster-live' ); ?></p></td>
	</tr>
	<tr valign="top">
		<th scope="row"><?php esc_html_e( 'Pause on blur', 'mailster-live' ); ?></th>
		<td><label><input type="checkbox" name="mailster_options[live_pauseonblur]" value="1" <?php checked( mailster_option( 'live_pauseonblur' ) ); ?>> <?php esc_html_e( 'pause Live! modus if browser window doesn\'t have focus', 'mailster-live' ); ?> <span class="description">(<?php esc_html_e( 'recommended', 'mailster-live' ); ?>)</span> </label></td>
	</tr>
</table>
