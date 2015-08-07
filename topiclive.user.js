// ==UserScript==
// @name TopicLive
// @description Charge les nouveaux messages d'un topic de jeuxvideo.com en direct
// @include http://www.jeuxvideo.com/forums/*
// @include http://www.forumjv.com/forums/*
// @version 4.8.5
// @grant GM_addStyle
// @grant GM_xmlhttpRequest
// ==/UserScript==

// Compatibilité Google Chrome & Opera
var script = document.createElement("script");
script.textContent = "(" + wrapper + ")();";
(document.head || document.documentElement).appendChild(script);
script.parentNode.removeChild(script);

function wrapper() {

var urlToLoad = '';
var isOnLastPage = true, isTabActive = true, shouldReload = false;
var lastPost = -1, newPosts = 0, idanalyse = -1;
var instance = 0;
var son = new Audio('http://kiwec.net/files/topiclive.ogg');
var favicon = new Image();
var lienFavicon = null;
favicon.src = '/favicon.ico';
var editions = {};

/**
 * Ajoute l'option pour active ou desactiver le son de nouveau message
 */
function ajouterOption()
{
	var actif = localStorage['topiclive_son'] == 'bru' ? true : false;
	$(".menu-user-forum").append("<li><span class=\"pull-left\">Son TopicLive</span>"
		+ "<span class=\"interrupteur-inline " + (actif ? "actif" : "pointer") + " forum_son_topiclive\" id=\"topiclive_activerson\">OUI</span>"
		+ "<span class=\"interrupteur-inline " + (actif ? "pointer" : "actif") + " forum_son_topiclive\" id=\"topiclive_desactiverson\">NON</span></li>");

	$("#topiclive_activerson").on("click", function(){
		localStorage["topiclive_son"] = "bru";
		$("#topiclive_activerson").attr("class", "interrupteur-inline actif");
		$("#topiclive_desactiverson").attr("class", "interrupteur-inline pointer");
	});
	
	$("#topiclive_desactiverson").on("click", function(){
		localStorage["topiclive_son"] = "sil";
		$("#topiclive_activerson").attr("class", "interrupteur-inline pointer");
		$("#topiclive_desactiverson").attr("class", "interrupteur-inline actif");
	});
}

function getLastPage($boutonFin)
{
	if($boutonFin.length > 0)
	{
		if($boutonFin.prop("tagName") == "A")
			urlToLoad = $boutonFin.attr("href");
		else
			urlToLoad = jvCake($boutonFin.attr("class"));
	}
}

/**
 * Traite les donnees obtenues par obtenirPage()
 */
function processPage($data) {

	// Mise a jour du formulaire
	try {
		majFormulaire($data);
	} catch(e) {
		console.log('[TopicLive] processPage>majFormulaire :', e);
	}

	// Mise a jour du numero de dernier post
	try {
		if(lastPost == -1)
			lastPost = parseInt($data.find('.bloc-message-forum:last').attr('data-id'),10);
	} catch(e) {
		console.log('[TopicLive] processPage>lastPost :', e);
	}

	// Mise a jour de l'URL de la page
	try {
		getLastPage($data.find('.pagi-fin-actif'));
	} catch(e) {
		console.log('[TopicLive] processPage>getLastPage :', e);
	}

	// Anti-expiration de la page
	try {
		$("#ajax_timestamp_liste_messages").val($data.find("#ajax_timestamp_liste_messages").val());
		$("#ajax_hash_liste_messages").val($data.find("#ajax_hash_liste_messages").val());
	} catch(e){
		console.log('[TopicLive] processPage>antiExpiration :', e);
	}
	
	// Ajout des nouveaux messages a la page
	$data.find(".bloc-message-forum").each(function(){
		try {
			ajouterPost($(this));
		} catch(e) {
			console.log("[TopicLive] processPage>ajouterPost :", e);
		}
	});

	try {
		// Fix des liens (automatique via jvcare)
		jsli.Transformation();
	} catch(e) {
		console.log('[TopicLive] processPage>fonctionsJVC :', e);
	}

	dispatchEvent(new CustomEvent('topiclive:doneprocessing', {
		'detail': {
			jvcake: jvCake
		}
	}));
	
	// Changement de la favicon en cas de nouveaux messages
	if(!isTabActive && newPosts > 0) setFavicon("" + newPosts);

	if(shouldReload) {
		console.log('[TopicLive] Chargement de page (shouldReload)');
		obtenirPage(processPage);
	} else chargementPropre();
}

/**
 * Ajoute un post a la page.
 * SEULEMENT s'il est nouveau
 */
function ajouterPost($post)
{
	if(parseInt($post.attr('data-id'),10) > lastPost)
	{
		newPosts++;
		lastPost = parseInt($post.attr('data-id'),10);
			   
		if(isOnLastPage) {
				   
			$post.hide();
			$('.bloc-message-forum').last().after($post);
			fixCitation($post);
			$post.fadeIn('slow');
					
		} else {
			actualiserBanniere();
		}

		dispatchEvent(new CustomEvent("topiclive:newmessage", {
			'detail': {
				id: $post.attr("id"),
				jvcake: jvCake
			}
		}));
		
		if(localStorage['topiclive_son'] == 'bru' && shouldReload == false) son.play();

		shouldReload = false;
	}
	else
	{
		var postid = $post.attr("id");
		var $message = $("#" + postid);

		if($message.find('.info-edition-msg').length == 1) // Si le message a ete edite
		{
			if(postid in editions) // si le message etait deja edite
			{
				if(editions[postid] != $post.find('.info-edition-msg').text()) // si l'edition est plus recente
				{
					updatePost($message, $post);
				}
			}
			else
			{
				updatePost($message, $post);
			}
		}
	}

	// Fix spoilers
	replace_spoilers($post[0]);
}

function updatePost($oldPost, $newPost)
{
	editions[$oldPost.attr('id')] = $newPost.find('.info-edition-msg').text();

	// Maj des messages edites
	$oldPost.find('.bloc-contenu').html($newPost.find('.bloc-contenu').html());

	dispatchEvent(new CustomEvent("topiclive:edition", {
		'detail': {
			id: $oldPost.attr("id"),
			jvcake: jvCake
		}
	}));
	
	// Clignotement des messages edites
	var defColor = $oldPost.css("backgroundColor");
	$oldPost.animate({
		backgroundColor: "#FF9900"
	}, 50);
	$oldPost.animate({
		backgroundColor: defColor
	}, 500);
}

/**
 * Telecharge la page d'URL urlToLoad
 */
function obtenirPage(cb)
{
	var lInstance = instance;

	$('.bloc-header-form').text('Répondre ○');
	
	$.ajax({
		url: urlToLoad,
		dataType: 'text',
		type: 'GET',
		success: function(data)
		{
			if(lInstance == instance)
			{
				cb($(data));

				$('.bloc-header-form').text('Répondre ●');
				setTimeout(function()
				{
					$('.bloc-header-form').text('Répondre');
				}, 100)
			}
			else
			{
				console.log('[TopicLive] Nouvelle instance detectee : arret du chargement de la page');
			}
		},
		error: function()
		{
			console.log('[TopicLive] Erreur lors du chargement de la page.')
			obtenirPage(cb);
		}
	});
}

/**
 * Ajoute ou actualise la banniere alertant des nouveaux messages
 */
function actualiserBanniere() {

	var blocInfo;

	if($('#loadposts').length === 0) {
		blocInfo = document.createElement('div');
		blocInfo.className = 'alert alert-warning';
		blocInfo.innerHTML = '<div class="alert-row" id="loadposts"></div>';
		$(blocInfo).hide();
		$('.bloc-pre-pagi-forum:last').after(blocInfo);
	}
	
	$('#loadposts').html('<a href="' + urlToLoad
			+ '">Nouveaux messages depuis que vous avez chargé cette page : <strong style="color:#FF4000">'
			+ newPosts + '</strong></a>');
	$(blocInfo).fadeIn('slow');
	 
}

/**
 * Transforme une classe encryptee par jvcare en lien
 */
function jvCake(classe)
{
	var base16 = "0A12B34C56D78E9F",
	lien = "",
	s = classe.split(" ")[1];

	for (var i = 0; i < s.length; i += 2)
		lien += String.fromCharCode(base16.indexOf(s.charAt(i)) * 16 + base16.indexOf(s.charAt(i + 1)));

	return lien;
}

/**
 * Fixe le bouton de citation pour le $message
 */
function fixCitation($message)
{
	var id = $message.attr("data-id"),
		pseudo = $(".bloc-pseudo-msg", $message).text().replace(/[\r\n]/g, ""),
		date = $(".bloc-date-msg", $message).text().replace(/[\r\n]/g, "").replace(/[\r\n]/g, "").replace(/#[0-9]+$/g, "");
	
	$message.find(".bloc-options-msg .picto-msg-quote").on("click", function() {
		$.ajax({
			type: "POST",
			url: "/forums/ajax_citation.php",
			dataType: "json",
			data: {
				id_message: id,
				ajax_timestamp: $("#ajax_timestamp_liste_messages").val(),
				ajax_hash: $("#ajax_hash_liste_messages").val()
			},
			success: function(e) {
				n = $("#message_topic");
				n.val("> Le " + date + " " + pseudo + " a écrit :\n>" + e.txt.split("\n").join("\n> ") + "\n\n" + n.val());
			}
		});
	});
}

/**
 * Met a jour le formulaire pour poster sans rechargement
 */
function majFormulaire($page, majCaptcha)
{
	var $newForm = $page.find(".form-post-message");
	var $formulaire = $('.form-post-message');
	
	// Si TopicLive demande deja un captcha
	if($formulaire.find(".col-md-12").length == 3)
	{
		if($newForm.find(".col-md-12").length == 3 && !majCaptcha)
			return;
		
		$formulaire.find(".col-md-12:eq(1)").remove();
	}
	
	// Si un captcha est demande
	if($newForm.find(".col-md-12").length == 3)
	{
		$formulaire.find(".col-md-12:first").after($newForm.find(".col-md-12:eq(1)"));
	}
	
	$formulaire.unbind("submit");
	$formulaire.on("submit", function(e)
	{
		$.ajax({
			type: "POST",
			url: "/forums/ajax_check_poste_message.php",
			data: {
				id_topic: id_topic,
				new_message: $("#message_topic").val(),
				ajax_timestamp: $page.find("#ajax_timestamp_liste_messages").val(),
				ajax_hash: $page.find("#ajax_hash_liste_messages").val()
			},
			dataType: "json",
			success: function(e) {
				if(e.erreurs.length !== 0)
				{
					var message_erreur = "";
					for (var i = 0; i < e.erreurs.length; i++)
					{
						message_erreur += e.erreurs[i];
						if(i < e.erreurs.length)
							message_erreur += "<br />";
					}
					
					modal("erreur", {
						message: message_erreur
					});
				}
				else
				{
					// Si il n'y a pas d'erreurs
					postRespawn($newForm);
				}
			},
			error: function()
			{
				modal('erreur', {
					message: 'Erreur lors de la vérification du message.'
				});
			}
		});
	
		return false;
	});
}

/**
 * Poste un message sans recharger la page
 */
function postRespawn($newForm) {

	var $formulaire = $('.form-post-message');
	$formulaire.find('.btn-poster-msg').attr('disabled','disabled');
	$formulaire.find('.conteneur-editor').fadeOut();
	
	// On prend les données du nouveau formulaire : pseudo, message, tokens...
	var formData = {};
	$.each($newForm.serializeArray(), function(i, j) {
		formData[j.name] = j.value;
	});
	// On rajoute le message et captcha aux donnees
	formData.message_topic = $formulaire.find("#message_topic").val();
	if($formulaire.find(".col-md-12").length == 3)
		formData.fs_ccode = $formulaire.find("#code_captcha").val();

	// Envoi du message
	$.ajax({
		type: 'POST',
		url: document.URL,
		data: formData,
		success: function(data){
			var $data = $(data);
			majFormulaire($data, true);
			console.log('[TopicLive] Chargement de page (postRespawn)');
			shouldReload = true;
			obtenirPage(processPage);
			
			$formulaire.find('.btn-poster-msg').removeAttr("disabled");
			$("#message_topic").val("");
			$formulaire.find('.conteneur-editor').fadeIn();
		},
		error: function()
		{
			console.log('[TopicLive] Erreur lors de l\'envoi d\'un message');
			postRespawn($newForm);
		}
	});
}

function chargementPropre() {
	window.clearTimeout(idanalyse);
	var lInstance = instance;
	idanalyse = setTimeout(function(){
		//console.log('[TopicLive] Chargement de page (chargementAuto) ' + idanalyse);
		if(lInstance == instance)
			obtenirPage(processPage);
		else
			console.log('[TopicLive] Nouvelle instance detectee : arret de chargementAuto');
	}, isTabActive ? 5000 : 10000);
}

/**
 * Change la favicon pour alerter en cas de nouveaux messages
 * Code provenant de SpawnKill
 */
function setFavicon(nvxMessages) {

	try {
	
		var canvas = $("<canvas>").get(0);
		canvas.width = 16;
		canvas.height = 16;
		var context = canvas.getContext("2d");
		var textWidth = context.measureText(nvxMessages).width;
		context.drawImage(favicon, 0, 0);
		
		if(nvxMessages != "")
		{
			context.fillStyle = "red";
			context.fillRect(0, 0, textWidth + 3, 11);
			context.fillStyle = "white";
			context.font = "bold 10px Verdana";
			context.textBaseline = "bottom";
			context.fillText(nvxMessages, 1, 11);
		}
		
		var newFavicon = canvas.toDataURL("image/png");
		
		if(lienFavicon !== null)
			lienFavicon.remove();
		
		lienFavicon = $("<link>", {
			href: newFavicon,
			rel: "shortcut icon",
			type: "image/png"
		});
		
		$("head").append(lienFavicon);
	
	} catch(e){console.log(e);}
	
}

function registerTabs()
{
	// Alerte par titre
	$(window).bind('focus', function(){                
		if(!isTabActive) {
			isTabActive = true;
			setFavicon("");
			newPosts = 0;
		}
	});
	$(window).bind('blur', function(){
		if (isTabActive) {
			isTabActive = false;
			setFavicon("");
			newPosts = 0;
		}
	});
}

/**
 * Fix pour chrome qui n'aime pas que TopicLive charge avant la page
 */
function fixChromeHack()
{
	if(typeof $ != "undefined")
	{
		main();
		addEventListener("instantclick:newpage", main);
	}
	else
	{
		setTimeout(fixChromeHack, 50);
	}
}

fixChromeHack();

function main() {

	console.log("[TopicLive] Script charge.");
	instance++;
	
	// Topic
	if($('.conteneur-message').length > 0) {

		lastPost = -1;
		newPosts = 0;
		formData = {};
		isTabActive = true;

		if($('.pagi-fin-actif').length == 2) {
			isOnLastPage = false;
			getLastPage($('.pagi-fin-actif'));
		} else {
			isOnLastPage = true;
			urlToLoad = document.URL;
		}
		 
		registerTabs();
		setFavicon("");
		ajouterOption();
		chargementPropre();
		majFormulaire($(document), true);
	}
}

} // fin de wrapper(), pas une erreur
