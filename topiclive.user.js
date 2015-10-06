// ==UserScript==
// @name TopicLive
// @description Charge les nouveaux messages d'un topic de jeuxvideo.com en direct
// @include http://www.jeuxvideo.com/*
// @include http://www.forumjv.com/*
// @version 4.9.0
// ==/UserScript==

// Compatibilité Google Chrome & Opera
var script = document.createElement("script");
script.textContent = "(" + wrapper + ")();";
(document.head || document.documentElement).appendChild(script);
script.parentNode.removeChild(script);

function wrapper() {

// Etat de TopicLive
var instance = 0, idanalyse = -1, shouldReload = false;
// Etat de la page
var urlToLoad, isOnLastPage, isTabActive, isMP;
// Etat des posts
var lastPost, newPosts, editions = {};
// Data
var son = new Audio('http://kiwec.net/files/topiclive.ogg'),
favicon = new Image(),
lienFavicon = null;
favicon.src = '/favicon.ico';

/**
 * Ajoute l'option pour active ou desactiver le son de nouveau message
 */
function ajouterOption()
{
	try
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
	catch(e)
	{
		console.log('[TopicLive] Erreur ajouterOption : ' + e);
	}
}

function getLastPage($boutonFin)
{
	try
	{
		if($boutonFin.length > 0)
		{
			if($boutonFin.prop("tagName") == "A")
				urlToLoad = $boutonFin.attr("href");
			else
				urlToLoad = jvCake($boutonFin.attr("class"));
		}
	}
	catch(e)
	{
		console.log('[TopicLive] Erreur getLastPage : ' + e);
	}
}

/**
 * Traite les donnees obtenues par obtenirPage()
 */
function processPage($data)
{
	try
	{
		// Mise a jour du formulaire
		majFormulaire($data);

		// Mise a jour du numero de dernier post
		if(lastPost == -1)
			lastPost = parseInt($data.find('.bloc-message-forum:last').attr('data-id'),10);

		// Mise a jour de l'URL de la page
		getLastPage($data.find('.pagi-fin-actif'));

		// Anti-expiration de la page
		$("#ajax_timestamp_liste_messages").val($data.find("#ajax_timestamp_liste_messages").val());
		$("#ajax_hash_liste_messages").val($data.find("#ajax_hash_liste_messages").val());
		
		// Ajout des nouveaux messages a la page
		$data.find(".bloc-message-forum").each(function()
		{
			ajouterPost($(this));
		});

		try
		{
			// Fix des liens (automatique via jvcare)
			jsli.Transformation();
		}
		catch(e)
		{
			console.log('[TopicLive] Erreur jvCare : liens HS');
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
		} else chargementAuto();
	}
	catch(e)
	{
		console.log('[TopicLive] Erreur processPage : ' + e);
	}
}

/**
 * Ajoute un post a la page.
 * SEULEMENT s'il est nouveau
 */
function ajouterPost($post)
{
	try
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

			if($post.find('.info-edition-msg').length == 1) // Si le message a ete edite
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

		try
		{
			// Fix spoilers
			replace_spoilers($post[0]);
		}
		catch(e)
		{
			console.log('[TopicLive] Erreur spoilers : les spoilers seront invisibles');
		}
	}
	catch(e)
	{
		console.log('[TopicLive] Erreur ajouterPost : ' + e);
	}
}

function updatePost($oldPost, $newPost)
{
	try
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
	catch(e)
	{
		console.log('[TopicLive] Erreur updatePost : ' + e);
	}
}

/**
 * Telecharge la page d'URL urlToLoad
 */
function obtenirPage(cb)
{
	try
	{
		var lInstance = instance;

		$('.bloc-header-form').text('Répondre ○');
		
		$.ajax({
			url: urlToLoad,
			dataType: 'text',
			type: 'GET',
			timeout: 5000,
			success: function(data)
			{
				if(lInstance == instance)
				{
					try
					{
						cb($(data.substring(data.indexOf('<!DOCTYPE html>'))));
					}
					catch(e)
					{
						console.log('[TopicLive] Erreur de parsing :( chargement impossible : ' + e);
					}

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
	catch(e)
	{
		console.log('[TopicLive] Erreur obtenirPage : ' + e);
	}
}

/**
 * Ajoute ou actualise la banniere alertant des nouveaux messages
 */
function actualiserBanniere()
{
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
	try
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
	catch(e)
	{
		console.log('[TopicLive] Erreur fixCitation : ' + e);
	}
}

/**
 * Renvoit le formulaire d'une page
 */
function getFormulaire($page)
{
	if(isMP) {
		return $page.find('.form-post-topic');
	} else {
		return $page.find('.form-post-message');
	}
}

/**
 * Renvoit le captcha d'un formulaire
 * NOTE : le bloc captcha s'obtient avec .parent()
 */
function getCaptcha($formulaire)
{
	if(isMP) {
		return $formulaire.find('.bloc-cap');
	} else {
		return $formulaire.find('.captcha-boot-jv');
	}
}

/**
 * Met a jour le formulaire pour poster sans rechargement
 */
function majFormulaire($page, majCaptcha)
{
	try
	{
		var $formulaire = getFormulaire($(document));
		var $newForm = getFormulaire($page);
		var captchaAvant = getCaptcha($formulaire);
		var captchaApres = getCaptcha($newForm);
		
		// Si TopicLive demande deja un captcha
		if(captchaAvant.length)
		{
			if(captchaApres.length && !majCaptcha) {
				return;
			} else {
				captchaAvant.parent().remove();
			}
		}
		
		// Si un captcha est demande
		if(captchaApres.length)
		{
			// Note : le captcha pourrait bug hors forumjv et mps
			$formulaire.find('.jv-editor').after(captchaApres.parent());
		}
		
		$formulaire.unbind('submit');
		$formulaire.on('submit', function(e)
		{
			$.ajax({
				type: 'POST',
				url: '/forums/ajax_check_poste_message.php',
				data: {
					id_topic: id_topic,
					new_message: $('#message_topic').val(),
					ajax_timestamp: $page.find('#ajax_timestamp_liste_messages').val(),
					ajax_hash: $page.find('#ajax_hash_liste_messages').val()
				},
				dataType: 'json',
				timeout: 5000,
				success: function(e) {
					if(e.erreurs.length !== 0)
					{
						var message_erreur = '';
						for (var i = 0; i < e.erreurs.length; i++)
						{
							message_erreur += e.erreurs[i];
							if(i < e.erreurs.length)
								message_erreur += '<br />';
						}
						
						modal('erreur', {
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
	catch(e)
	{
		console.log('[TopicLive] Erreur majFormulaire : ' + e);
	}
}

/**
 * Poste un message sans recharger la page
 */
function postRespawn($newForm)
{
	try
	{
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
			timeout: 5000,
			success: function(data) {
				processPage($(data.substring(data.indexOf('<!DOCTYPE html>'))));
				
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
	catch(e)
	{
		console.log('[TopicLive] Erreur postRespawn : ' + e);
	}
}

function chargementAuto() {
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
function setFavicon(nvxMessages)
{
	try
	{
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
	}
	catch(e)
	{
		console.log('[TopicLive] Erreur setFavicon : ' + e);
	}
}

function registerTabs()
{
	// Alerte par titre
	$(window).bind('focus', function() {                
		if(!isTabActive) {
			isTabActive = true;
			setFavicon('');
			newPosts = 0;
		}
	});
	$(window).bind('blur', function() {
		if (isTabActive) {
			isTabActive = false;
			setFavicon('');
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

function main()
{
	console.log("[TopicLive] Script charge.");
	instance++;
	
	if($('.conteneur-message').length > 0)
	{
		lastPost = -1;
		newPosts = 0;
		formData = {};
		isTabActive = true;
		isMP = $('#mp-page').length;

		if($('.pagi-fin-actif').length == 2) {
			isOnLastPage = false;
			getLastPage($('.pagi-fin-actif'));
		} else {
			isOnLastPage = true;
			urlToLoad = document.URL;
		}

		// Ajout des messages edites a la liste de messages edites
		if(!isMP) {
			$('.bloc-message-forum').each(function()
			{
				var $post = $(this);
				var $edit = $post.find('.info-edition-msg');
	
				if($edit.length == 1)
				{
					editions[$post.attr('id')] = $edit.text();
				}
			});
		}
		 
		registerTabs();
		setFavicon('');
		if(!isMP) ajouterOption();
		majFormulaire($(document), true);
		obtenirPage(processPage);
	}
}

} // fin de wrapper(), pas une erreur
