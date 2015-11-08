// ==UserScript==
// @name TopicLive
// @description Charge les nouveaux messages d'un topic de JVC en direct
// @author Kiwec
// @match http://www.jeuxvideo.com/*
// @match http://www.forumjv.com/*
// @run-at document-end
// @require Favicon.js
// @require Formulaire.js
// @require Message.js
// @require Option.js
// @require Page.js
// @require TopicLive.js
// @version 5.0.6
// @grant none
// @noframes
// ==/UserScript==

var TL = new TopicLive();
TL.initStatic();
