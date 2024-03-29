jQuery(document).ready(function ($) {

	"use strict";

	var _mapcanvas = $('.mailster_live_map'),
		wpnonce = $('#mailster_nonce').val(),
		campaign_id = $('#post_ID').val(),
		wrap = $('.mailster_live_wrap'),
		activity = $('.mailster_live_activity'),
		activitylist = activity.find('ul').eq(0),
		activitydetail = activity.find('.mailster_live_userdetail'),
		actionhashes = [],
		activeuser,
		hiDPI = window.devicePixelRatio > 1,
		users = {},
		map, servertimestamp = 0,
		typecount = 0,
		timeout = null,
		timestamptimeout = null,
		invisible = false,
		isLive = true,
		live_timestamps = $('.mailster_live_timestamp'),
		currentuser = 0,
		mapcenter = new google.maps.LatLng(parseFloat(mailsterlive.mapoptions.lat), parseFloat(mailsterlive.mapoptions.lng)),
		lastcenter = mapcenter,
		lastzoom = parseInt(mailsterlive.mapoptions.zoom, 10),
		maxLive = parseInt(mailsterlive.maxlive, 10),
		counts = {
			open: 0,
			click: 0,
			unsub: 0,
			other: 0
		},
		$counts = {
			open: $('.mailster_live_total_opens').find('span'),
			click: $('.mailster_live_total_clicks').find('span'),
			unsub: $('.mailster_live_total_unsubscribes').find('span'),
			other: $('.mailster_live_total_others').find('span')
		},
		icons = {};


	function _init() {

		if (!_mapcanvas.length) return;

		var mapTypeIds = [];
		for (var type in google.maps.MapTypeId) {
			mapTypeIds.push(google.maps.MapTypeId[type]);
		}

		var mapOptions = {
			center: mapcenter,
			zoom: lastzoom,
			maxZoom: 9,
			minZoom: 1,
			optimized: false,
			scrollwheel: false,
			panControl: false,
			zoomControl: true,
			scaleControl: true,
			streetViewControl: false,
			fullscreenControl: false,
			mapTypeControl: true,
			mapTypeControlOptions: {
				style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
				mapTypeIds: mapTypeIds
			},
			mapTypeId: mailsterlive.maptype
		};

		map = new google.maps.Map(_mapcanvas[0], mapOptions);

		google.maps.event.addListener(map, 'click', function () {
			removeInfowindow();
		});

		google.maps.event.addListener(map, 'zoom_changed', function () {
			lastzoom = map.zoom;
		});

		google.maps.event.addListener(map, 'dragend', function () {
			lastcenter = map.center;
		});

		var size = new google.maps.Size(16, 25);

		icons = {
			open: new google.maps.MarkerImage(mailsterlive.markers['open' + (hiDPI ? '_2x' : '')], null, null, null, size),
			click: new google.maps.MarkerImage(mailsterlive.markers['click' + (hiDPI ? '_2x' : '')], null, null, null, size),
			unsub: new google.maps.MarkerImage(mailsterlive.markers['unsubscribe' + (hiDPI ? '_2x' : '')], null, null, null, size),
			'other': new google.maps.MarkerImage(mailsterlive.markers['other' + (hiDPI ? '_2x' : '')], null, null, null, size)
		};

		activitylist.on('click', 'li', function () {
			userdetail($(this).data('id'));
		});

		activitydetail.on('click', 'a.mailster_live_back', function () {
			removeInfowindow();
			activity.animate({
				left: 0
			}, 200);
			map.setZoom(Math.min(lastzoom, parseInt(mailsterlive.mapoptions.zoom, 10)));
			activeuser = false;
			return false;
		});

		wrap.on('click', 'a.mailster_live_collapse-button', function () {
			wrap.toggleClass('expanded');
			google.maps.event.trigger(map, 'resize');
			map.panTo(lastcenter);
			return false;
		}).on('click', 'a.mailster_toggle_fullscreen', function () {
			$('#mailster_live').toggleClass('fullscreen');
			$('body').toggleClass('mailster-oveflow-hidden');
			google.maps.event.trigger(map, 'resize');
			if (lastcenter) map.panTo(lastcenter);
			return false;
		});

		activity.on('click', 'header > div', function () {
			var id = $(this).data('id');
			if (activity.is('.active-' + id)) {
				activity.removeClass('active-' + id);
			} else {
				activity.removeAttr('class').addClass('mailster_live_activity active-' + id);
			}

		});

		$('#mailster_live').find('.hndle').on('click', function () {
			setTimeout(function () {
				google.maps.event.trigger(map, 'resize');
			}, 10);
		});

		if (mailsterlive.pauseonblur)
			$(window)
			.focus(function () {
				invisible = false;
				if (isLive) $('#mailster_live').removeClass('paused');
				timestamptimeout = setInterval(timestamps, 1000);
			})
			.blur(function () {
				invisible = true;
				$('#mailster_live').addClass('paused');
				clearInterval(timestamptimeout);
			});

		checkactions(0);
		timestamptimeout = setInterval(timestamps, 1000);

	}

	function checkactions(timestamp) {

		if (!isLive || invisible) {
			clearTimeout(timeout);
			timeout = setTimeout(function () {
				checkactions(timestamp);
			}, 1000);
			return;
		}
		_ajax('check', {
			timestamp: timestamp,
			campaign_id: campaign_id
		}, function (response) {

			servertimestamp = response.timestamp;

			if (response.success) {

				var html = '',
					detailhtml = '',
					d = Math.round(new Date().getTime() / 1000);

				maxLive = response.maxlive;

				if (d - timestamp < maxLive || !timestamp) {

					$.each(response.actions, function (i, action) {
						var a = addaction(action, timestamp, i);
						if (!a) return;
						counts[action.type] = Math.max(0, (counts[action.type] || 0) + 1);
						html = a + html;
						if (currentuser == 'user_' + action.ID) {
							detailhtml = a + detailhtml;
						}
					});

					if (html) {

						if (response.count <= 10) {
							$(html).fadeTo(1, 0).hide().prependTo(activitylist).slideDown(200, function () {
								$(this).fadeTo(300, 1);
							});
						} else {
							$(html).fadeTo(0, 0).prependTo(activitylist).fadeTo(300, 1);
						}

						activity.removeClass('noaction');

						if (detailhtml) $(detailhtml).fadeTo(1, 0).hide().prependTo(activitydetail.find('ul')).slideDown(200, function () {
							$(this).fadeTo(400, 1);
						});

						updateStats();

						live_timestamps = activity.find('.mailster_live_timestamp');

					} else {

						if (!actionhashes.length) activity.addClass('noaction');

					}
				}

				clearTimeout(timeout);
				timeout = setTimeout(function () {
					checkactions(response.timestamp);
				}, response.pause);
			} else {
				if (!response.loggedin) {
					activity.html('<div class="mailster_live_info loggedout"><h4>' + response.msg + '</h4></div>');
				}
			}

		});
	}

	function updateStats() {
		$.each(counts, function (type, i) {
			var t = $('.mailster_live_totals');
			if ($counts[type] && i > 0) {
				$counts[type].html(i);
				if ($counts[type].parent().is('.hidden')) {
					typecount++;
					$counts[type].parent().removeClass('hidden');
					t.removeAttr('class').addClass('mailster_live_totals count_' + typecount);
				}
			} else if (!$counts[type].parent().is('.hidden')) {
				typecount--;
				$counts[type].parent().addClass('hidden');
				t.removeAttr('class').addClass('mailster_live_totals count_' + typecount);
			}
		});
	}

	function addaction(action, timestamp, i) {
		var id = 'user_' + action.subscriber_id;
		if ($.inArray(action.hash, actionhashes) !== -1) return false;
		actionhashes.push(action.hash);

		if (!users[id]) {
			users[id] = {
				'ID': action.subscriber_id,
				'messages': [],
				'lastaction': action.type,
				'gravatar': action.gravatar,
				'email': action.email,
				'name': action.name,
				'geo': action.geo,
				'coords': action.coords
			};

			if (action.coords) {

				users[id].marker = marker(action.coords[0], action.coords[1], id, action.type, timestamp !== 0);
				users[id].infowindow = infowindow(action.coords[0], action.coords[1], id, action.type);

				if (users[id].marker)
					google.maps.event.addListener(users[id].marker, 'click', function () {
						userdetail(id);
					});
			}

		} else if (users[id].marker) {
			users[id].marker.setIcon(icons[action.type]);

		}
		var message = {
			'label': mailsterlive.messages[action.type],
			'type': action.type,
			'meta': [action.link],
			'timestamp': action.timestamp,
			'time': action.formatedtime
		};


		users[id].lastaction = action.type;
		users[id].messages.push(message);

		return '<li data-id="' + id + '" data-type="' + action.type + '" class="mailster_live_' + id + ' mailster_live_type_' + message.type + '"><div class="mailster_live_avatar" style="background-image:url(' + users[id].gravatar.replace(/&amp;/g, '&') + ')"></div><span class="mailster_live_name">' + users[id].name + '</span><h4>' + message.label + '</h4><div class="mailster_live_action_body">' + message.meta.join('<br>') + '</div><span class="mailster_live_timestamp" data-id="' + id + '" data-timestamp="' + message.timestamp + '" title="' + message.time + '">&nbsp;</span></li>';

	}

	function userdetail(id) {

		var user = users[id];

		activeuser = user;

		wrap.removeClass('expanded');
		google.maps.event.trigger(map, 'resize');

		currentuser = id;
		if (user.marker) {
			map.panTo(user.marker.position);
			map.setZoom(Math.max(6, map.zoom));
			lastcenter = user.marker.position;
		}

		activitydetail.find('h4.mailster_live_username').html(user.name);
		activitydetail.find('h5.mailster_live_email').html(user.email);
		activitydetail.find('.mailster_live_avatar').eq(0).css('background-image', 'url(' + user.gravatar.replace(/&amp;/g, '&') + ')').parent().attr('href', 'edit.php?post_type=newsletter&page=mailster_subscribers&ID=' + user.ID);

		var actions = activitylist.find('.mailster_live_' + id).clone().addClass('mailster_live_is_userdetail');

		activitydetail.find('ul').empty();

		actions.appendTo(activitydetail.find('ul'));

		live_timestamps = activity.find('.mailster_live_timestamp');
		activity.animate({
			left: -300
		}, 200);

		removeInfowindow();

		if (user.infowindow) {
			user.infowindow.open(map, user.marker);
			user.infowindow.setContent('<img src="' + user.gravatar + '" width="60" height="60"><div><strong>' + user.name + '</strong><span>' + (user.geo[1] ? user.geo[1] + ', ' : '') + (user.geo[0]) + '</span></div>');
		}


	}


	function timestamps() {

		if (!live_timestamps.length) return;

		var d = Math.floor(new Date().getTime() / 1000),
			remove = $([]);

		$.each(live_timestamps, function () {
			var _this = $(this),
				timestamp = _this.data('timestamp');

			if (d - timestamp > maxLive) {
				var el = _this.parent(),
					type = el.data('type');

				if (!el.is('.mailster_live_is_userdetail')) {
					counts[type]--;
					counts[type] = Math.max(0, counts[type]);
					removeMessage(el.data('id'));
				}
				remove = remove.add(el);
			} else {
				var _old = _this.html(),
					_new = humantimediff(timestamp, d);

				if (_old != _new) _this.html(_new);
			}
		});

		if (remove.length > 10) {
			remove.remove();
			live_timestamps = activity.find('.mailster_live_timestamp');
			updateStats();
			if (!live_timestamps.length)
				activity.addClass('noaction');

		} else if (remove.length) {
			remove.fadeTo(300, 0).slideUp(200, function () {
				remove.remove();
				live_timestamps = activity.find('.mailster_live_timestamp');
				if (!live_timestamps.length)
					activity.addClass('noaction');

			});
			updateStats();
		}
	}

	function humantimediff(timestamp, currenttime) {

		var elapsed = currenttime - timestamp;

		if (elapsed < 60) { //60
			return sprintf(mailsterlive.secago, elapsed);
		} else if (elapsed < 3600) {
			return sprintf(mailsterlive.minago, Math.floor(elapsed / 60));
		} else if (elapsed < 216000) {
			return sprintf(mailsterlive.hourago, Math.floor(elapsed / 3600));
		}
	}

	function removeMessage(id) {
		if (users[id]) {
			if (users[id].messages.length) {
				users[id].messages.shift();
			}
			if (!users[id].messages.length) {
				removeInfowindow(id);
				removeMarkers(id);
				delete users[id];
			}
			return true;
		}
		return false;
	}

	function marker(latitude, longitude, id, type, animate) {
		if (!latitude || !latitude) return false;
		var position = new google.maps.LatLng(latitude, longitude);

		var m = new google.maps.Marker({
			position: position,
			map: map,
			userid: id,
			icon: icons[type],
			animation: animate ? google.maps.Animation.DROP : null
		});

		return m;
	}

	function infowindow(latitude, longitude, id, type) {
		if (!latitude || !latitude) return false;

		return new InfoBubble({
			map: map,
			position: new google.maps.LatLng(latitude, longitude),
			content: '',
			shadowStyle: 0,
			arrowSize: 0,
			disableAutoPan: true,
			hideCloseButton: true,
			arrowPosition: '50%',
			backgroundClassName: 'mailster_infowindow type_' + type,
			borderRadius: 0,
			backgroundColor: 'none',
			padding: 0,
			borderWidth: 0,
			maxWidth: 260,
			maxHeight: 66,
			minWidth: 260,
			minHeight: 66
		});
	}

	function removeInfowindow(id) {
		if (id) {
			if (users[id] && users[id].infowindow) users[id].infowindow.close();
			return;
		}
		$.each(users, function (i, e) {
			if (e.infowindow) e.infowindow.close();
		});
	}

	function removeMarkers(id) {
		if (id) {
			if (users[id] && users[id].marker) users[id].marker.setMap(null);
			return;
		}
		$.each(users, function (i, e) {
			if (e.marker) e.marker.setMap(null);
		});
	}

	function sprintf() {
		var a = Array.prototype.slice.call(arguments),
			str = a.shift();
		while (a.length) str = str.replace('%s', a.shift());
		return str;
	}

	function _ajax(action, data, callback, errorCallback) {

		if ($.isFunction(data)) {
			if ($.isFunction(callback)) {
				errorCallback = callback;
			}
			callback = data;
			data = {};
		}
		$.ajax({
			type: 'POST',
			url: ajaxurl,
			data: $.extend({
				action: 'mailster_live_' + action,
				_wpnonce: wpnonce
			}, data),
			success: function (data, textStatus, jqXHR) {
				callback && callback.call(this, data, textStatus, jqXHR);
			},
			error: function (jqXHR, textStatus, errorThrown) {
				errorCallback && errorCallback.call(this, jqXHR, textStatus, errorThrown);
			},
			dataType: "JSON"
		});
	}

	_init();
});


/**
 * @name CSS3 InfoBubble with tabs for Google Maps API V3
 * @version 0.8
 * @author Luke Mahe
 * @fileoverview
 * This library is a CSS Infobubble with tabs. It uses css3 rounded corners and
 * drop shadows and animations. It also allows tabs
 */

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	 http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


(function () {
	var b = void 0,
		g;

	function k(a) {
		this.extend(k, google.maps.OverlayView);
		this.b = [];
		this.d = null;
		this.g = 100;
		this.m = !1;
		a = a || {};
		if (a.backgroundColor == b) a.backgroundColor = this.z;
		if (a.borderColor == b) a.borderColor = this.A;
		if (a.borderRadius == b) a.borderRadius = this.B;
		if (a.borderWidth == b) a.borderWidth = this.C;
		if (a.padding == b) a.padding = this.F;
		if (a.arrowPosition == b) a.arrowPosition = this.u;
		a.disableAutoPan == b && (a.disableAutoPan = !1);
		a.disableAnimation == b && (a.disableAnimation = !1);
		if (a.minWidth == b) a.minWidth = this.D;
		if (a.shadowStyle == b) a.shadowStyle =
			this.G;
		if (a.arrowSize == b) a.arrowSize = this.v;
		if (a.arrowStyle == b) a.arrowStyle = this.w;
		l(this);
		this.setValues(a)
	}
	window.InfoBubble = k;
	g = k.prototype;
	g.v = 15;
	g.w = 0;
	g.G = 1;
	g.D = 50;
	g.u = 50;
	g.F = 10;
	g.C = 1;
	g.A = "#ccc";
	g.B = 10;
	g.z = "#fff";
	g.extend = function (a, c) {
		return function (a) {
			for (var c in a.prototype) this.prototype[c] = a.prototype[c];
			return this
		}.apply(a, [c])
	};

	function l(a) {
		var c = a.c = document.createElement("DIV");
		c.style.position = "absolute";
		c.style.zIndex = a.g;
		(a.i = document.createElement("DIV")).style.position = "relative";
		var d = a.l = document.createElement("IMG");
		d.style.position = "absolute";
		d.style.width = n(12);
		d.style.height = n(12);
		d.style.border = 0;
		d.style.zIndex = a.g + 1;
		d.style.cursor = "pointer";
		d.src = "//maps.gstatic.com/intl/en_us/mapfiles/iw_close.gif";
		google.maps.event.addDomListener(d, "click", function () {
			a.close();
			google.maps.event.trigger(a, "closeclick")
		});
		var e = a.e = document.createElement("DIV");
		e.style.overflowX = "auto";
		e.style.overflowY = "auto";
		e.style.cursor = "default";
		e.style.clear = "both";
		e.style.position = "relative";
		var f = a.j = document.createElement("DIV");
		e.appendChild(f);
		f = a.L = document.createElement("DIV");
		f.style.position = "relative";
		var i = a.n = document.createElement("DIV"),
			h = a.k = document.createElement("DIV"),
			j = q(a);
		i.style.position = h.style.position = "absolute";
		i.style.left = h.style.left = "50%";
		i.style.height = h.style.height = "0";
		i.style.width = h.style.width =
			"0";
		i.style.marginLeft = n(-j);
		i.style.borderWidth = n(j);
		i.style.borderBottomWidth = 0;
		j = a.a = document.createElement("DIV");
		j.style.position = "absolute";
		c.style.display = j.style.display = "none";
		c.appendChild(a.i);
		c.appendChild(d);
		c.appendChild(e);
		f.appendChild(i);
		f.appendChild(h);
		c.appendChild(f);
		c = document.createElement("style");
		c.setAttribute("type", "text/css");
		a.h = "_ibani_" + Math.round(1E4 * Math.random());
		c.textContent = "." + a.h + "{-webkit-animation-name:" + a.h + ";-webkit-animation-duration:0.5s;-webkit-animation-iteration-count:1;}@-webkit-keyframes " +
			a.h + " {from {-webkit-transform: scale(0)}50% {-webkit-transform: scale(1.2)}90% {-webkit-transform: scale(0.95)}to {-webkit-transform: scale(1)}}";
		document.getElementsByTagName("head")[0].appendChild(c)
	}
	g.ca = function (a) {
		this.set("backgroundClassName", a)
	};
	k.prototype.setBackgroundClassName = k.prototype.ca;
	k.prototype.M = function () {
		this.j.className = this.get("backgroundClassName")
	};
	k.prototype.backgroundClassName_changed = k.prototype.M;
	k.prototype.oa = function (a) {
		this.set("tabClassName", a)
	};
	k.prototype.setTabClassName = k.prototype.oa;
	k.prototype.ra = function () {
		t(this)
	};
	k.prototype.tabClassName_changed = k.prototype.ra;
	k.prototype.ba = function (a) {
		this.set("arrowStyle", a)
	};
	k.prototype.setArrowStyle = k.prototype.ba;
	k.prototype.K = function () {
		this.p()
	};
	k.prototype.arrowStyle_changed = k.prototype.K;

	function q(a) {
		return parseInt(a.get("arrowSize"), 10) || 0
	}
	k.prototype.aa = function (a) {
		this.set("arrowSize", a)
	};
	k.prototype.setArrowSize = k.prototype.aa;
	k.prototype.p = function () {
		this.r()
	};
	k.prototype.arrowSize_changed = k.prototype.p;
	k.prototype.$ = function (a) {
		this.set("arrowPosition", a)
	};
	k.prototype.setArrowPosition = k.prototype.$;
	k.prototype.J = function () {
		this.n.style.left = this.k.style.left = (parseInt(this.get("arrowPosition"), 10) || 0) + "%";
		u(this)
	};
	k.prototype.arrowPosition_changed = k.prototype.J;
	k.prototype.setZIndex = function (a) {
		this.set("zIndex", a)
	};
	k.prototype.setZIndex = k.prototype.setZIndex;
	k.prototype.getZIndex = function () {
		return parseInt(this.get("zIndex"), 10) || this.g
	};
	k.prototype.ta = function () {
		var a = this.getZIndex();
		this.c.style.zIndex = this.g = a;
		this.l.style.zIndex = a + 1
	};
	k.prototype.zIndex_changed = k.prototype.ta;
	k.prototype.ma = function (a) {
		this.set("shadowStyle", a)
	};
	k.prototype.setShadowStyle = k.prototype.ma;
	k.prototype.pa = function () {
		var a = "",
			c = "",
			d = "";
		switch (parseInt(this.get("shadowStyle"), 10) || 0) {
		case 0:
			a = "none";
			break;
		case 1:
			c = "40px 15px 10px rgba(33,33,33,0.3)";
			d = "transparent";
			break;
		case 2:
			c = "0 0 2px rgba(33,33,33,0.3)", d = "rgba(33,33,33,0.35)"
		}
		this.a.style.boxShadow = this.a.style.webkitBoxShadow = this.a.style.MozBoxShadow = c;
		this.a.style.backgroundColor = d;
		if (this.m) this.a.style.display = a, this.draw()
	};
	k.prototype.shadowStyle_changed = k.prototype.pa;
	k.prototype.qa = function () {
		this.set("hideCloseButton", !1)
	};
	k.prototype.showCloseButton = k.prototype.qa;
	k.prototype.P = function () {
		this.set("hideCloseButton", !0)
	};
	k.prototype.hideCloseButton = k.prototype.P;
	k.prototype.Q = function () {
		this.l.style.display = this.get("hideCloseButton") ? "none" : ""
	};
	k.prototype.hideCloseButton_changed = k.prototype.Q;
	k.prototype.da = function (a) {
		a && this.set("backgroundColor", a)
	};
	k.prototype.setBackgroundColor = k.prototype.da;
	k.prototype.N = function () {
		var a = this.get("backgroundColor");
		this.e.style.backgroundColor = a;
		this.k.style.borderColor = a + " transparent transparent";
		t(this)
	};
	k.prototype.backgroundColor_changed = k.prototype.N;
	k.prototype.ea = function (a) {
		a && this.set("borderColor", a)
	};
	k.prototype.setBorderColor = k.prototype.ea;
	k.prototype.O = function () {
		var a = this.get("borderColor"),
			c = this.e,
			d = this.n;
		c.style.borderColor = a;
		d.style.borderColor = a + " transparent transparent";
		c.style.borderStyle = d.style.borderStyle = this.k.style.borderStyle = "solid";
		t(this)
	};
	k.prototype.borderColor_changed = k.prototype.O;
	k.prototype.fa = function (a) {
		this.set("borderRadius", a)
	};
	k.prototype.setBorderRadius = k.prototype.fa;

	function w(a) {
		return parseInt(a.get("borderRadius"), 10) || 0
	}
	k.prototype.q = function () {
		var a = w(this),
			c = x(this);
		this.e.style.borderRadius = this.e.style.MozBorderRadius = this.e.style.webkitBorderRadius = this.a.style.borderRadius = this.a.style.MozBorderRadius = this.a.style.webkitBorderRadius = n(a);
		this.i.style.paddingLeft = this.i.style.paddingRight = n(a + c);
		u(this)
	};
	k.prototype.borderRadius_changed = k.prototype.q;

	function x(a) {
		return parseInt(a.get("borderWidth"), 10) || 0
	}
	k.prototype.ga = function (a) {
		this.set("borderWidth", a)
	};
	k.prototype.setBorderWidth = k.prototype.ga;
	k.prototype.r = function () {
		var a = x(this);
		this.e.style.borderWidth = n(a);
		this.i.style.top = n(a);
		var a = x(this),
			c = q(this),
			d = parseInt(this.get("arrowStyle"), 10) || 0,
			e = n(c),
			f = n(Math.max(0, c - a)),
			i = this.n,
			h = this.k;
		this.L.style.marginTop = n(-a);
		i.style.borderTopWidth = e;
		h.style.borderTopWidth = f;
		0 == d || 1 == d ? (i.style.borderLeftWidth = e, h.style.borderLeftWidth = f) : i.style.borderLeftWidth = h.style.borderLeftWidth = 0;
		0 == d || 2 == d ? (i.style.borderRightWidth = e, h.style.borderRightWidth = f) : i.style.borderRightWidth = h.style.borderRightWidth =
			0;
		2 > d ? (i.style.marginLeft = n(-c), h.style.marginLeft = n(-(c - a))) : i.style.marginLeft = h.style.marginLeft = 0;
		i.style.display = 0 == a ? "none" : "";
		t(this);
		this.q();
		u(this)
	};
	k.prototype.borderWidth_changed = k.prototype.r;
	k.prototype.la = function (a) {
		this.set("padding", a)
	};
	k.prototype.setPadding = k.prototype.la;

	function y(a) {
		return parseInt(a.get("padding"), 10) || 0
	}
	k.prototype.X = function () {
		this.e.style.padding = n(y(this));
		t(this);
		u(this)
	};
	k.prototype.padding_changed = k.prototype.X;

	function n(a) {
		return a ? a + "px" : a
	}

	function z(a) {
		var c = "mousedown,mousemove,mouseover,mouseout,mouseup,mousewheel,DOMMouseScroll,touchstart,touchend,touchmove,dblclick,contextmenu,click".split(","),
			d = a.c;
		a.s = [];
		for (var e = 0, f; f = c[e]; e++) a.s.push(google.maps.event.addDomListener(d, f, function (a) {
			a.cancelBubble = !0;
			a.stopPropagation && a.stopPropagation()
		}))
	}
	k.prototype.onAdd = function () {
		this.c || l(this);
		z(this);
		var a = this.getPanes();
		a && (a.floatPane.appendChild(this.c), a.floatShadow.appendChild(this.a))
	};
	k.prototype.onAdd = k.prototype.onAdd;
	k.prototype.draw = function () {
		var a = this.getProjection();
		if (a) {
			var c = this.get("position");
			if (c) {
				var d = 0;
				if (this.d) d = this.d.offsetHeight;
				var e = A(this),
					f = q(this),
					i = parseInt(this.get("arrowPosition"), 10) || 0,
					i = i / 100,
					a = a.fromLatLngToDivPixel(c);
				if (c = this.e.offsetWidth) {
					var h = a.y - (this.c.offsetHeight + f);
					e && (h -= e);
					var j = a.x - c * i;
					this.c.style.top = n(h);
					this.c.style.left = n(j);
					switch (parseInt(this.get("shadowStyle"), 10)) {
					case 1:
						this.a.style.top = n(h + d - 1);
						this.a.style.left = n(j);
						this.a.style.width = n(c);
						this.a.style.height =
							n(this.e.offsetHeight - f);
						break;
					case 2:
						c *= 0.8, this.a.style.top = e ? n(a.y) : n(a.y + f), this.a.style.left = n(a.x - c * i), this.a.style.width = n(c), this.a.style.height = n(2)
					}
				}
			} else this.close()
		}
	};
	k.prototype.draw = k.prototype.draw;
	k.prototype.onRemove = function () {
		this.c && this.c.parentNode && this.c.parentNode.removeChild(this.c);
		this.a && this.a.parentNode && this.a.parentNode.removeChild(this.a);
		for (var a = 0, c; c = this.s[a]; a++) google.maps.event.removeListener(c)
	};
	k.prototype.onRemove = k.prototype.onRemove;
	k.prototype.R = function () {
		return this.m
	};
	k.prototype.isOpen = k.prototype.R;
	k.prototype.close = function () {
		if (this.c) this.c.style.display = "none", this.c.className = this.c.className.replace(this.h, "");
		if (this.a) this.a.style.display = "none", this.a.className = this.a.className.replace(this.h, "");
		this.m = !1
	};
	k.prototype.close = k.prototype.close;
	k.prototype.open = function (a, c) {
		var d = this;
		window.setTimeout(function () {
			B(d, a, c)
		}, 0)
	};

	function B(a, c, d) {
		C(a);
		c && a.setMap(c);
		d && (a.set("anchor", d), a.bindTo("anchorPoint", d), a.bindTo("position", d));
		a.c.style.display = a.a.style.display = "";
		a.get("disableAnimation") || (a.c.className += " " + a.h, a.a.className += " " + a.h);
		u(a);
		a.m = !0;
		a.get("disableAutoPan") || window.setTimeout(function () {
			a.o()
		}, 200)
	}
	k.prototype.open = k.prototype.open;
	k.prototype.setPosition = function (a) {
		a && this.set("position", a)
	};
	k.prototype.setPosition = k.prototype.setPosition;
	k.prototype.getPosition = function () {
		return this.get("position")
	};
	k.prototype.getPosition = k.prototype.getPosition;
	k.prototype.Y = function () {
		this.draw()
	};
	k.prototype.position_changed = k.prototype.Y;
	k.prototype.o = function () {
		var a = this.getProjection();
		if (a && this.c) {
			var c = this.c.offsetHeight + A(this),
				d = this.get("map"),
				e = d.getDiv().offsetHeight,
				f = this.getPosition(),
				i = a.fromLatLngToContainerPixel(d.getCenter()),
				f = a.fromLatLngToContainerPixel(f),
				c = i.y - c,
				e = e - i.y,
				i = 0;
			0 > c && (i = (-1 * c + e) / 2);
			f.y -= i;
			f = a.fromContainerPixelToLatLng(f);
			d.getCenter() != f && d.panTo(f)
		}
	};
	k.prototype.panToView = k.prototype.o;

	function D(a) {
		var a = a.replace(/^\s*([\S\s]*)\b\s*$/, "$1"),
			c = document.createElement("DIV");
		c.innerHTML = a;
		if (1 == c.childNodes.length) return c.removeChild(c.firstChild);
		for (a = document.createDocumentFragment(); c.firstChild;) a.appendChild(c.firstChild);
		return a
	}

	function E(a) {
		if (a)
			for (var c; c = a.firstChild;) a.removeChild(c)
	}
	k.prototype.setContent = function (a) {
		this.set("content", a)
	};
	k.prototype.setContent = k.prototype.setContent;
	k.prototype.getContent = function () {
		return this.get("content")
	};
	k.prototype.getContent = k.prototype.getContent;

	function C(a) {
		if (a.j) {
			E(a.j);
			var c = a.getContent();
			if (c) {
				"string" == typeof c && (c = D(c));
				a.j.appendChild(c);
				for (var c = a.j.getElementsByTagName("IMG"), d = 0, e; e = c[d]; d++) google.maps.event.addDomListener(e, "load", function () {
					var c = !a.get("disableAutoPan");
					u(a);
					c && (0 == a.b.length || 0 == a.d.index) && a.o()
				});
				google.maps.event.trigger(a, "domready")
			}
			u(a)
		}
	}

	function t(a) {
		if (a.b && a.b.length) {
			for (var c = 0, d; d = a.b[c]; c++) F(a, d.f);
			a.d.style.zIndex = a.g;
			c = x(a);
			d = y(a) / 2;
			a.d.style.borderBottomWidth = 0;
			a.d.style.paddingBottom = n(d + c)
		}
	}

	function F(a, c) {
		var d = a.get("backgroundColor"),
			e = a.get("borderColor"),
			f = w(a),
			i = x(a),
			h = y(a),
			j = n(-Math.max(h, f)),
			f = n(f),
			p = a.g;
		c.index && (p -= c.index);
		var d = {
				cssFloat: "left",
				position: "relative",
				cursor: "pointer",
				backgroundColor: d,
				border: n(i) + " solid " + e,
				padding: n(h / 2) + " " + n(h),
				marginRight: j,
				whiteSpace: "nowrap",
				borderRadiusTopLeft: f,
				MozBorderRadiusTopleft: f,
				webkitBorderTopLeftRadius: f,
				borderRadiusTopRight: f,
				MozBorderRadiusTopright: f,
				webkitBorderTopRightRadius: f,
				zIndex: p,
				display: "inline"
			},
			m;
		for (m in d) c.style[m] =
			d[m];
		m = a.get("tabClassName");
		m != b && (c.className += " " + m)
	}

	function G(a, c) {
		c.S = google.maps.event.addDomListener(c, "click", function () {
			H(a, this)
		})
	}
	k.prototype.na = function (a) {
		(a = this.b[a - 1]) && H(this, a.f)
	};
	k.prototype.setTabActive = k.prototype.na;

	function H(a, c) {
		if (c) {
			var d = y(a) / 2,
				e = x(a);
			if (a.d) {
				var f = a.d;
				f.style.zIndex = a.g - f.index;
				f.style.paddingBottom = n(d);
				f.style.borderBottomWidth = n(e)
			}
			c.style.zIndex = a.g;
			c.style.borderBottomWidth = 0;
			c.style.marginBottomWidth = "-10px";
			c.style.paddingBottom = n(d + e);
			a.setContent(a.b[c.index].content);
			C(a);
			a.d = c;
			u(a)
		} else a.setContent(""), C(a)
	}
	k.prototype.ia = function (a) {
		this.set("maxWidth", a)
	};
	k.prototype.setMaxWidth = k.prototype.ia;
	k.prototype.U = function () {
		u(this)
	};
	k.prototype.maxWidth_changed = k.prototype.U;
	k.prototype.ha = function (a) {
		this.set("maxHeight", a)
	};
	k.prototype.setMaxHeight = k.prototype.ha;
	k.prototype.T = function () {
		u(this)
	};
	k.prototype.maxHeight_changed = k.prototype.T;
	k.prototype.ka = function (a) {
		this.set("minWidth", a)
	};
	k.prototype.setMinWidth = k.prototype.ka;
	k.prototype.W = function () {
		u(this)
	};
	k.prototype.minWidth_changed = k.prototype.W;
	k.prototype.ja = function (a) {
		this.set("minHeight", a)
	};
	k.prototype.setMinHeight = k.prototype.ja;
	k.prototype.V = function () {
		u(this)
	};
	k.prototype.minHeight_changed = k.prototype.V;
	k.prototype.H = function (a, c) {
		var d = document.createElement("DIV");
		d.innerHTML = a;
		F(this, d);
		G(this, d);
		this.i.appendChild(d);
		this.b.push({
			label: a,
			content: c,
			f: d
		});
		d.index = this.b.length - 1;
		d.style.zIndex = this.g - d.index;
		this.d || H(this, d);
		d.className = d.className + " " + this.h;
		u(this)
	};
	k.prototype.addTab = k.prototype.H;
	k.prototype.sa = function (a, c, d) {
		if (this.b.length && !(0 > a || a >= this.b.length)) {
			a = this.b[a];
			if (c != b) a.f.innerHTML = a.label = c;
			if (d != b) a.content = d;
			this.d == a.f && (this.setContent(a.content), C(this));
			u(this)
		}
	};
	k.prototype.updateTab = k.prototype.sa;
	k.prototype.Z = function (a) {
		if (this.b.length && !(0 > a || a >= this.b.length)) {
			var c = this.b[a];
			c.f.parentNode.removeChild(c.f);
			google.maps.event.removeListener(c.f.S);
			this.b.splice(a, 1);
			delete c;
			for (var d = 0, e; e = this.b[d]; d++) e.f.index = d;
			if (c.f == this.d) this.d = this.b[a] ? this.b[a].f : this.b[a - 1] ? this.b[a - 1].f : b, H(this, this.d);
			u(this)
		}
	};
	k.prototype.removeTab = k.prototype.Z;

	function I(a, c, d) {
		var e = document.createElement("DIV");
		e.style.display = "inline";
		e.style.position = "absolute";
		e.style.visibility = "hidden";
		"string" == typeof a ? e.innerHTML = a : e.appendChild(a.cloneNode(!0));
		document.body.appendChild(e);
		a = new google.maps.Size(e.offsetWidth, e.offsetHeight);
		if (c && a.width > c) e.style.width = n(c), a = new google.maps.Size(e.offsetWidth, e.offsetHeight);
		if (d && a.height > d) e.style.height = n(d), a = new google.maps.Size(e.offsetWidth, e.offsetHeight);
		document.body.removeChild(e);
		delete e;
		return a
	}

	function u(a) {
		var c = a.get("map");
		if (c) {
			var d = y(a);
			x(a);
			w(a);
			var e = q(a),
				f = c.getDiv(),
				i = 2 * e,
				c = f.offsetWidth - i,
				f = f.offsetHeight - i - A(a),
				i = 0,
				h = a.get("minWidth") || 0,
				j = a.get("minHeight") || 0,
				p = a.get("maxWidth") || 0,
				m = a.get("maxHeight") || 0,
				p = Math.min(c, p),
				m = Math.min(f, m),
				v = 0;
			if (a.b.length)
				for (var r = 0, o; o = a.b[r]; r++) {
					var s = I(o.f, p, m);
					o = I(o.content, p, m);
					if (h < s.width) h = s.width;
					v += s.width;
					if (j < s.height) j = s.height;
					if (s.height > i) i = s.height;
					if (h < o.width) h = o.width;
					if (j < o.height) j = o.height
				} else if (r = a.get("content"),
					"string" == typeof r && (r = D(r)), r) {
					o = I(r, p, m);
					if (h < o.width) h = o.width;
					if (j < o.height) j = o.height
				}
			p && (h = Math.min(h, p));
			m && (j = Math.min(j, m));
			h = Math.max(h, v);
			h == v && (h += 2 * d);
			h = Math.max(h, 2 * e);
			h > c && (h = c);
			j > f && (j = f - i);
			if (a.i) a.t = i, a.i.style.width = n(v);
			a.e.style.width = n(h);
			a.e.style.height = n(j)
		}
		w(a);
		d = x(a);
		c = 2;
		a.b.length && a.t && (c += a.t);
		e = 2 + d;
		(f = a.e) && f.clientHeight < f.scrollHeight && (e += 15);
		a.l.style.right = n(e);
		a.l.style.top = n(c + d);
		a.draw()
	}

	function A(a) {
		return a.get("anchor") && (a = a.get("anchorPoint")) ? -1 * a.y : 0
	}
	k.prototype.I = function () {
		this.draw()
	};
	k.prototype.anchorPoint_changed = k.prototype.I;
})();