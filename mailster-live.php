<?php
/*
Plugin Name: Mailster Live!
Plugin URI: https://mailster.co/?utm_campaign=wporg&utm_source=wordpress.org&utm_medium=plugin&utm_term=Mailster+Live
Description: see who opens your newsletter campaigns in real time
Version: 2.0.0
Author: EverPress
Author URI: https://everpress.co
Text Domain: mailster-live
License: GPLv2 or later
*/


define( 'MAILSTER_LIVE_VERSION', '2.0.0' );
define( 'MAILSTER_LIVE_REQUIRED_VERSION', '3.0' );
define( 'MAILSTER_LIVE_FILE', __FILE__ );

require_once __DIR__ . '/classes/live.class.php';
new MailsterLive();
