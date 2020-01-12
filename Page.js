/* exports Page */
/* globals Message, TL */

function Page($page)
{
	// TL.log('Nouvelle page.');
	this.$page = $page;
}

Page.prototype.obtenirMessages = function()
{
	// TL.log('page.obtenirMessages()');
	var msgs = [];
	this.trouver(TL.class_msg + ':not(.msg-pseudo-blacklist)').each(function() {
		msgs.push(new Message($(this)));
	});
	return msgs;
};

// Appele quand il y a des nouveaux messages
Page.prototype.maj = function()
{
	TL.log('Nouveaux messages ! Execution favicon/son/spoilers');
	if(localStorage.topiclive_son == 'true') {
		try { TL.son.play(); }
		catch(err) { TL.log('### Erreur son : ' + err); }
	}
	try { if(!TL.ongletActif) TL.favicon.maj('' + TL.nvxMessages); }
	catch(err) { TL.log('### Erreur favicon (maj) : ' + err); }
	try { this.Transformation(); }
	catch(err) { TL.log('### Erreur jsli.Transformation() : ' + err); }

	// Nettoyage des anciens messages
	var nb_messages = $(TL.class_msg + ':not(.msg-pseudo-blacklist)').size();
	if(nb_messages > 100) {
		$(TL.class_msg + ':not(.msg-pseudo-blacklist)')
			.slice(0, nb_messages - 100)
			.remove();
	}

	TL.log('Envoi de topiclive:doneprocessing');
	dispatchEvent(new CustomEvent('topiclive:doneprocessing', {
		'detail': { jvcake: TL.jvCake }
	}));
};

Page.prototype.scan = function()
{
	// TL.log('Scan de la page');
	TL.ajaxTs = this.trouver('#ajax_timestamp_liste_messages').val();
	TL.ajaxHash = this.trouver('#ajax_hash_liste_messages').val();

	// Maj du nombre de connectes
	$('.nb-connect-fofo').text(this.trouver('.nb-connect-fofo').text());

	if($(TL.class_msg).length === 0 || $(TL.class_page_fin).length !== 0) {
		TL.log('Pas sur une derniere page : loop');
		TL.majUrl(this);
		TL.loop();
		return;
	}

	var maj = false;

	// Liste de messages
	var nvMsgs = this.obtenirMessages();

	TL.log('Verification des messages supprimes');
	try {
		if(!TL.estMP) {
			for(let msg of TL.messages) {
				// Si le message n'est plus present dans la liste de nouveaux messages, on traite sa suppression
				let msg_supprime = nvMsgs.every(nvMsg => msg.id_message == nvMsg.id_message);
				if(msg_supprime) {
					msg.supprimer();
				}
			}
		}
	} catch(err) { TL.log('### Erreur messages supprimes : ' + err); }

	TL.log('Verification des nouveaux messages et editions');
	try {
		for(let nvMsg of nvMsgs) {
			var nv = true;
			for(let ancienMsg of TL.messages) {
				if(TL.estMP) {
					if(ancienMsg.trouver('.bloc-spoil-jv').length !== 0) {
						var ancienneDate = ancienMsg.trouver(TL.class_date).text();
						var nouvelleDate = nvMsg.trouver(TL.class_date).text();
						if(ancienneDate == nouvelleDate) {
							nv = false;
							break;
						}
					} else if(ancienMsg.$message.text() == nvMsg.$message.text()) {
						nv = false;
						break;
					}
				} else {
					if(ancienMsg.id_message == nvMsg.id_message) {
						nv = false;
						ancienMsg.update(nvMsg);
						break;
					}
				}
			}
			if(nv) {
				// TL.log('Nouveau message !');
				TL.messages.push(nvMsg);
				TL.nvxMessages++;
				nvMsg.afficher();
				maj = true;
			}
		}
	} catch(err) { TL.log('Erreur nouveaux messages : ' + err); }

	// Doit etre avant TL.charger()
	TL.majUrl(this);

	if(maj) {
		this.maj();
	}

	TL.loop();
};

// Version perso de JvCare
Page.prototype.Transformation = function () {
	$('.JvCare').each(function () {
		var $span = $(this);
		var classes = $span.attr('class');
		var href = TL.jvCake(classes);

		// Suppression de JvCare
		classes = classes.split(' ');
		var index = classes.indexOf('JvCare');
		classes.splice(index, index + 2);
		classes.unshift('xXx');
		classes = classes.join(' ');

		$span.replaceWith('<a href="' + href + '" class="' + classes + '">' +
                      $span.html() + '</a>');
	});

	// Fix temporaire des avatars
	$('.user-avatar-msg').each(function () {
		var $elem = $(this);
		var newsrc = $elem.attr('data-srcset');
		if(newsrc != 'undefined') {
			$elem.attr('src', newsrc);
			$elem.removeAttr('data-srcset');
		}
	});
};

Page.prototype.trouver = function(chose)
{
	// TL.log('Page.trouver : ' + chose);
	return this.$page.find(chose);
};
