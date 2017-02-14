jQuery( document ).ready(function ($) {

	"use strict"

	var mapcenter = new google.maps.LatLng( +mailsterlive.lat, +mailsterlive.lng );

	function _init() {

		var mapTypeIds = [];
		for (var type in google.maps.MapTypeId) {
			mapTypeIds.push( google.maps.MapTypeId[type] );
		}

		var mapOptions = {
			center: mapcenter,
			zoom: +mailsterlive.zoom,
			maxZoom: 9,
			minZoom: 1,
			scrollwheel: false,
			panControl: false,
			zoomControl: true,
			scaleControl: true,
			streetViewControl: false,
			mapTypeControl: true,
			mapTypeControlOptions: {
				mapTypeIds: mapTypeIds
			},
			mapTypeId: mailsterlive.maptype
		},

		map = new google.maps.Map( document.getElementById('mailster_live_map'), mapOptions );

		google.maps.event.addListener(map, 'zoom_changed', function () {
			$( '#mailster_live_zoom' ).val( this.getZoom() );
		});

		google.maps.event.addListener( map, 'maptypeid_changed', function() {
			$( '#mailster_live_maptype' ).val( map.getMapTypeId() );
		});

		google.maps.event.addListener(map, 'dragend', function () {
			var coords = this.getCenter();

			$( '#mailster_live_lat' ).val( coords.lat() );
			$( '#mailster_live_lng' ).val( coords.lng() );
		});

		$( '.mainnav' ).on('click', 'a', function(){
			if ($( this ).attr( 'href' ) == '#live') {
				google.maps.event.trigger( map, 'resize' );
				map.setCenter( mapcenter );
			}
		});

	}

	_init();
});
