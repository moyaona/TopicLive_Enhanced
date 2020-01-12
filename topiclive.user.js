// ==UserScript==
// @name TopicLive
// @description Charge les nouveaux messages d'un topic de JVC en direct
// @author kiwec
// @match http://www.jeuxvideo.com/*
// @match http://m.jeuxvideo.com/*
// @run-at document-end
// @require http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @require Favicon.js
// @require Formulaire.js
// @require Message.js
// @require Option.js
// @require Page.js
// @require TopicLive.js
// @version 5.2.4
// @grant none
// @noframes
// ==/UserScript==

/* globals TopicLive */
/* exported TL */
var TL = new TopicLive();
TL.initStatic();
