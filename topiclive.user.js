// ==UserScript==
// @name TopicLive
// @description Charge les nouveaux messages d'un topic de JVC en direct
// @author kiwec
// @downloadURL https://github.com/kiwec/TopicLive/raw/master/topiclive.user.js
// @updateURL https://github.com/kiwec/TopicLive/raw/master/topiclive.user.js
// @match https://www.jeuxvideo.com/*
// @match https://m.jeuxvideo.com/*
// @run-at document-end
// @require https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @version 5.4.2
// @grant none
// @noframes
// ==/UserScript==

class Page {
	constructor($page) {
		// TL.log('Nouvelle page.');
		this.$page = $page;
	}

	obtenirMessages() {
		// TL.log('page.obtenirMessages()');
		const msgs = [];
		this.trouver(`${TL.class_msg}:not(.msg-pseudo-blacklist)`).each(function() {
			msgs.push(new Message($(this)));
		});
		return msgs;
	}

	// Appele quand il y a des nouveaux messages
	maj() {
		TL.log('Nouveaux messages ! Execution favicon/son/spoilers');
		if(localStorage.topiclive_son == 'true') {
			try { TL.son.play(); }
			catch(err) { TL.log(`### Erreur son : ${err}`); }
		}
		try { if(!TL.ongletActif) TL.favicon.maj(`${TL.nvxMessages}`); }
		catch(err) { TL.log(`### Erreur favicon (maj) : ${err}`); }
		try { this.Transformation(); }
		catch(err) { TL.log(`### Erreur jsli.Transformation() : ${err}`); }

		// Nettoyage des anciens messages
		const nb_messages = $(`${TL.class_msg}:not(.msg-pseudo-blacklist)`).size();
		if(nb_messages > 100) {
			$(`${TL.class_msg}:not(.msg-pseudo-blacklist)`)
				.slice(0, nb_messages - 100)
				.remove();
		}

		TL.log('Envoi de topiclive:doneprocessing');
		dispatchEvent(new CustomEvent('topiclive:doneprocessing', {
			'detail': { jvcake: TL.jvCake }
		}));
	}

	scan() {
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

		let messages_a_afficher = [];

		// TL.log('Verification des nouveaux messages et editions');
		const nvMsgs = this.obtenirMessages();
		try {
			for(let nvMsg of nvMsgs) {
				// TODO: On n'a pas besoin de ce hack. On sait que les IDs
				// s'incrémentent, il faut juste tenir compte de 8 liste
				// d'IDs différents, car il y a 8 listes séparées d'IDs qui
				// s'incrémentent (logique de sharing de JVC). On peut donc
				// en théorie retirer le check de contenu des messages et
				// avoir des résultats plus stables.
				let nv = true;
				for(let ancienMsg of TL.messages) {
					if(TL.estMP) {
						if(ancienMsg.trouver('.bloc-spoil-jv').length !== 0) {
							const ancienneDate = ancienMsg.trouver(TL.class_date).text();
							const nouvelleDate = nvMsg.trouver(TL.class_date).text();
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

					nvMsg.$message.hide();
          nvMsg.fixAvatar();
					nvMsg.fixBlacklist();
					nvMsg.fixCitation();
					nvMsg.fixDeroulerCitation();
					if(TL.mobile) {
						nvMsg.fixMobile();
					}
					$(`${TL.class_pagination}:last`).before(nvMsg.$message);

					const evt = {
						message: nvMsg,
						cancelled: false
					};
					messages_a_afficher.push(evt);

					dispatchEvent(new CustomEvent('topiclive:newmessage', {
						'detail': {
							id: nvMsg.id_message,
							jvcake: TL.jvCake,
							cancel: () => { evt.cancelled = true; }
						}
					}));
				}
			}
		} catch(err) { TL.log(`Erreur nouveaux messages : ${err}`); }

		TL.majUrl(this);

		if(messages_a_afficher.length > 0) {
			setTimeout(() => {
				let maj = false;
				for(let msg of messages_a_afficher) {
					if(msg.cancelled) {
						TL.nvxMessages--;
					} else {
						TL.log(`Affichage du message ${msg.message.id_message}`);
						msg.message.$message.fadeIn('slow');
						maj = true;
					}
				}

				if(maj) {
					this.maj();
				}
			}, 1000);
		}

		TL.loop();
	}

	// Version perso de JvCare
	Transformation() {
		$('.JvCare').each(function () {
			const $span = $(this);
			let classes = $span.attr('class');
			const href = TL.jvCake(classes);

			// Suppression de JvCare
			classes = classes.split(' ');
			const index = classes.indexOf('JvCare');
			classes.splice(index, index + 2);
			classes.unshift('xXx');
			classes = classes.join(' ');

			$span.replaceWith(`<a href="${href}" class="${classes}">${$span.html()}</a>`);
		});

		// Fix temporaire des avatars
		$('.user-avatar-msg').each(function () {
			const $elem = $(this);
			const newsrc = $elem.attr('data-srcset');
			if(newsrc != 'undefined') {
				$elem.attr('src', newsrc);
				$elem.removeAttr('data-srcset');
			}
		});
	}

	trouver(chose) {
		// TL.log('Page.trouver : ' + chose);
		return this.$page.find(chose);
	}
}

class TLOption {
	constructor(nom, id) {
		this.actif = localStorage[id] == 'true';
		this.nom = nom;
		this.id = id;

		this.injecter();
	}

	injecter() {
		// Ajout de l'option aux options JVC
		let option = `<li><span class="pull-left">TopicLive - ${this.nom}</span>`;
		option += `<input type="checkbox" class="input-on-off" id="${this.id}" `;
		option += this.actif ? 'checked>' : '>';
		option += `<label for="${this.id}" class="btn-on-off"></label></li>`;
		$('.menu-user-forum').append(option);

		// Register des events lors du toggle de l'option
		this.bouton = $(`#${this.id}`);
		this.bouton.change(() => {
			this.actif = !this.actif;
			localStorage[this.id] = this.actif;
		});
	}
}

class Message {
	constructor($message) {
		if(TL.estMP) {
			this.id_message = 'MP';
		} else if(TL.mobile) {
			let id = $message.attr('id');
			id = id.slice(id.indexOf('_') + 1);
			this.id_message = parseInt(id, 10);
		} else {
			this.id_message = parseInt($message.attr('data-id'), 10);
		}

		this.date = $(TL.class_date, $message).text().replace(/[\r\n]|#[0-9]+$/g, '');
		this.edition = $message.find('.info-edition-msg').text();
		this.$message = $message;
		this.pseudo = $('.bloc-pseudo-msg', $message).text().replace(/[\r\n]/g, '');
		this.supprime = false;
	}
  
  fixAvatar() {
    let avatar = this.trouver('.user-avatar-msg');
    avatar.attr('src', avatar.data('src'));
  }

	fixBlacklist() {
		this.trouver('.bloc-options-msg > .picto-msg-tronche, .msg-pseudo-blacklist .btn-blacklist-cancel').on('click', function () {
			$.ajax({
				url: '/forums/ajax_forum_blacklist.php',
				data: {
					id_alias_msg: this.$message.attr('data-id-alias'),
					action: this.$message.attr('data-action'),
					ajax_hash: $('#ajax_hash_preference_user')
				},
				dataType: 'json',
				success({erreur}) {
					if(erreur && erreur.length) {
						TL.alert(erreur);
					} else {
						document.location.reload();
					}
				}
			});
		});
	}

	fixCitation() {
		TL.log(`Obtention de la citation du message ${this.id_message}`);
		this.$message.find('.bloc-options-msg .picto-msg-quote').on('click', () => {
			$.ajax({
				type: 'POST',
				url: '/forums/ajax_citation.php',
				data: {
					id_message: this.id_message,
					ajax_timestamp: TL.ajaxTs,
					ajax_hash: TL.ajaxHash
				},
				dataType: 'json',
				timeout: 5000,
				success: ({txt}) => {
					TL.log(`Citation du message ${this.id_message} recue avec succes`);
					const $msg = TL.formu.obtenirMessage();
					let nvmsg = `> Le ${this.date} ${this.pseudo} a écrit :\n>`;
					nvmsg += `${txt.split('\n').join('\n> ')}\n\n`;
					if($msg.val() === '') {
						$msg.val(nvmsg);
					} else {
						$msg.val(`${$msg.val()}\n\n${nvmsg}`);
					}
				},
				error: this.fixCitation.bind(this)
			});
		});
	}

	fixDeroulerCitation() {
		this.trouver('blockquote').click(function() {
			$(this).attr('data-visible', '1');
		});
	}

	fixMobile() {
		this.trouver('.message').addClass('show-all');
	}

	trouver(chose) {
		return this.$message.find(chose);
	}

	update(nvMessage) {
		if(this.edition == nvMessage.edition) return;
		TL.log(`Message ${this.id_message} edite : mise a jour`);

		this.edition = nvMessage.edition;
		this.trouver(TL.class_contenu).html(nvMessage.trouver(TL.class_contenu).html());

		dispatchEvent(new CustomEvent('topiclive:edition', {
			'detail': {
				id: this.id_message,
				jvcake: TL.jvCake
			}
		}));

		// Clignotement du messages
		const defColor = this.$message.css('backgroundColor');
		this.$message.animate({
			backgroundColor: '#FF9900'
		}, 50);
		this.$message.animate({
			backgroundColor: defColor
		}, 500);
	}
}

class Formulaire {
	constructor() {
		// TL.log('Nouveau formulaire.');
		this.hook();
	}

	afficherErreurs(msg) {
		if(typeof msg !== 'undefined') {
			let message_erreur = '';
			for(let i = 0; i < msg.length; i++) {
				message_erreur += msg[i];
				if(i < msg.length) message_erreur += '<br />';
			}
			TL.alert(message_erreur);
		}
	}

	envoyer(e) {
		// Si le message est invalide selon JVC
		if(typeof e !== 'undefined' && typeof e.errors !== 'undefined' && e.errors.length) {
			this.afficherErreurs(e.erreurs);
		} else {
			TL.log('Message valide. Envoi en cours');
			this.trouver('.btn-poster-msg').attr('disabled', 'disabled');
			this.trouver('.conteneur-editor').fadeOut();

			window.clearTimeout(TL.idanalyse);
			$.ajax({
				type: 'POST',
				url: TL.url,
				data: this.obtenirFormulaire().serializeArray(),
				timeout: 5000,
				success: data => {
					switch(typeof data) {
					case 'object':
						// MaJ du formulaire via JSON
						if(data.hidden_reset) {
							this.trouver('input[type="hidden"]').remove();
							this.obtenirFormulaire().append(data.hidden_reset);
						}

						// Erreur lors de l'envoi du message
						if(data.errors) {
							this.afficherErreurs(data.errors);
							this.trouver('.btn-poster-msg').removeAttr('disabled');
							this.trouver('.conteneur-editor').fadeIn();
						}
                            
						// Redirection via JSON (wtf)
						if(data.redirect_uri) {
							TL.log(`Redirection du formulaire vers ${data.redirect_uri}`);
							TL.url = data.redirect_uri;
							TL.GET(this.verifEnvoi.bind(this));
						}
						break;
					case 'string':
						this.verifEnvoi($(data.substring(data.indexOf('<!DOCTYPE html>'))));
						break;
					case 'undefined': /* falls through */
					default:
						TL.alert('Erreur inconnue lors de l\'envoi du message.');
						this.trouver('.btn-poster-msg').removeAttr('disabled');
						this.trouver('.conteneur-editor').fadeIn();
						break;
					}
                    
					TL.loop();
				},
				error: err => TL.alert(`Erreur lors de l'envoi du message : ${err}`)
			});
		}
	}

	hook() {
		// Remplacement du bouton de post
		const $form = this.obtenirFormulaire();
		const $bouton = $form.find('.btn-poster-msg');
		$bouton.off();
		$bouton.removeAttr('data-push');
		$bouton.attr('type', 'button');
		$bouton.on('click', this.verifMessage.bind(this));
	}

	maj($nvform) {
		TL.log('Mise a jour du formulaire');
		const $form = this.obtenirFormulaire();
		const $cap = this.obtenirCaptcha($form);
		const $ncap = this.obtenirCaptcha($nvform);

		// Remplacement hashs formulaire
		this.trouver('input[type="hidden"]').remove();
		$nvform.find('input[type="hidden"]').each(function() {
			$form.append($(this));
		});

		// Reactivation des boutons
		this.trouver('.btn-poster-msg').removeAttr('disabled');
		this.trouver('.conteneur-editor').fadeIn();

		// Remplacement du captcha
		$cap.remove();
		this.trouver('.jv-editor').after($ncap);

		// Maj banniere erreur
		this.trouver('.alert-danger').remove();
		this.trouver('.row:first').before($nvform.find('.alert-danger'));

		// Remplacement du message (JVC n'effacera pas le message en erreur)
		this.obtenirMessage().val(this.obtenirMessage($nvform).val());

		this.hook();
	}

	obtenirCaptcha($form) {
		if(typeof $form === 'undefined') $form = this.obtenirFormulaire();
		return $form.find('.jv-editor').next('div');
	}

	obtenirMessage($form) {
		if(typeof $form == 'undefined') $form = this.obtenirFormulaire();
		return $form.find(TL.estMP ? '#message' : '#message_topic');
	}

	obtenirFormulaire($page) {
		if(typeof $page === 'undefined') $page = $(document);
		return $page.find(TL.estMP ? '#repondre-mp > form' : '.form-post-message');
	}

	verifEnvoi(data) {
		const nvPage = new Page(data);
		const $formu = this.obtenirFormulaire(nvPage.$page);
		this.maj($formu);
		TL.majUrl(nvPage);
		nvPage.scan();
	}

	verifMessage() {
		TL.log('Verification du message avant envoi');

		if(TL.estMP) {
			this.envoyer();
		} else {
			$.ajax({
				type: 'POST',
				url: '/forums/ajax_check_poste_message.php',
				data: {
					id_topic, /* globals id_topic */
					new_message: this.obtenirMessage().val(),
					ajax_timestamp: TL.ajaxTs,
					ajax_hash: TL.ajaxHash
				},
				dataType: 'json',
				timeout: 5000,
				success: this.envoyer.bind(this),
				error: this.verifMessage.bind(this)
			});
		}

		return false;
	}

	trouver(chose) {
		return this.obtenirFormulaire().find(chose);
	}
}

// Code de Spawnkill
class Favicon {
	constructor() {
		try {
			this.canv = $('<canvas>').get(0);
			this.canv.width = 192;
			this.canv.height = 192;
			this.context = this.canv.getContext('2d');
			this.context.font = 'bold 120px Courier New';
			this.context.textBaseline = 'bottom';
			this.image = new Image();
			this.image.src = 'https://www.jeuxvideo.com/favicon.png';
			this.maj('');
		} catch(err) {
			TL.log(`### Erreur init favicon : ${err}`);
		}
	}

	clear() {
		this.context.clearRect(0, 0, this.canv.width, this.canv.height);
		this.context.drawImage(this.image, 0, 0);
	}

	maj(txt) {
		this.clear();

		if(txt !== '')
		{
			this.context.fillStyle = 'red';
			this.context.fillRect(0, 0, this.context.measureText(txt).width + 36, 132);
			this.context.fillStyle = 'white';
			this.context.fillText(txt, 12, 132);
		}

		this.replace();
	}

	replace() {
		$('link[rel*="icon"]').remove();
		this.lien = $('<link>', {
			href: this.canv.toDataURL('image/png'),
			rel: 'shortcut icon',
			type: 'image/png'
		});
		$('head').append(this.lien);
	}
}

class TopicLive {
	constructor() {
		this.log('Initialisation');
		this.instance = 0;
		this.ongletActif = true;
	}

	ajouterOptions() {
		if(this.mobile) return;
		this.options = {
			optionSon: new TLOption('Son', 'topiclive_son')
		};
	}

	charger() {
		if(this.oldInstance != this.instance) {
			this.log('Nouvelle instance detectee : arret du chargement');
			return;
		}
        
		TL.GET(data => {
			new Page(data).scan();
		});
	}

	// Sera initialise a chaque changement de page
	init() {
		if(typeof $ === 'undefined') {
			return this.log('### jQuery introuvable !');
		}

		this.instance++;
		this.ajaxTs = $('#ajax_timestamp_liste_messages').val();
		this.ajaxHash = $('#ajax_hash_liste_messages').val();
		this.estMP = $('.mp-page').length;
		this.url = this.estMP ? document.URL.substring(0, document.URL.indexOf('&')) : document.URL;
		this.mobile = document.URL.includes('//m.jeuxvideo.com');

		this.class_msg = this.mobile ? '.post' : '.bloc-message-forum';
		this.class_num_page = this.mobile ? '.num-page' : '.page-active';
		this.class_page_fin = this.mobile ? '.right-elt > a' : '.pagi-fin-actif';
		this.class_date = this.mobile ? '.date-post' : '.bloc-date-msg';
		this.class_contenu = this.mobile ? '.contenu' : '.bloc-contenu';
		this.class_pagination = this.mobile ? '.pagination-b' : '.bloc-pagi-default';

		this.ajouterOptions();

		// Actif sur les URL de forums ou de messages privés, tant qu'il y a un
		// message dans la page.
		// -> Sera compatible respeed, sans pour autant s'exécuter sur des pages
		//    non supportées (ex. GTA)
		const analysable = (document.URL.match(/\/forums\/\d/) || document.URL.match(/\/messages-prives\//));
		if(analysable && $(this.class_msg).length > 0) {
			this.log('TopicLive actif sur cette page.');
			this.page = new Page($(document));
			this.formu = new Formulaire();
			this.messages = this.page.obtenirMessages();
			this.nvxMessages = 0;
			this.page.scan();
			this.loop();
		} else {
			this.log('TopicLive sera inactif sur cette page');
		}
	}

	// Ne sera pas initialise a chaque changement de page
	initStatic() {
		this.favicon = new Favicon();
		this.son = new Audio('https://raw.githubusercontent.com/Kiwec/TopicLive/master/notification.ogg');

		this.suivreOnglets();
		this.init();
		addEventListener('instantclick:newpage', this.init.bind(this));

		$("head").append("<style type='text/css'>\
                .topiclive-loading:after { content: ' ○' }\
                .topiclive-loaded:after { content: ' ●' }\
            </style>");
        
		this.log('Fin de l\'initialisation');
	}

	// Transforme une classe chiffree par JvCare en un lien
	jvCake(classe) {
		const base16 = '0A12B34C56D78E9F';
		let lien = '';
		const s = classe.split(' ')[1];
		for (let i = 0; i < s.length; i += 2) {
			lien += String.fromCharCode(base16.indexOf(s.charAt(i)) * 16 + base16.indexOf(s.charAt(i + 1)));
		}
		return lien;
	}

	alert(message) {
		/* globals modal */
		try {
			modal('erreur', { message });
			this.log(message);
		} catch(err) {
			this.log('### Fonction modal() inaccessible');
			alert(message);
		}
	}

	log(message) {
		console.log(`[TopicLive] ${message}`);
	}

	loop() {
		if(typeof this.idanalyse !== 'undefined') window.clearTimeout(this.idanalyse);

		let duree = this.ongletActif ? 5000 : 10000;

		if(this.mobile)
			duree = 10000;

		this.oldInstance = this.instance;
		this.idanalyse = setTimeout(this.charger.bind(this), duree);
	}

	majUrl(page) {
		if(this.estMP) return;

		const $bouton = page.trouver(this.class_page_fin);
		const numPage = page.trouver(`${this.class_num_page}:first`).text();
		const testUrl = this.url.split('-');

		// Si le bouton page suivante est present
		if($bouton.length > 0) {
			TL.log('Nouvelle URL (loop)');
			this.messages = [];
			if($bouton.prop('tagName') == 'A') {
				this.url = $bouton.attr('href');
			} else {
				this.url = this.jvCake($bouton.attr('class'));
			}
			// Si la page n'est pas la meme (ex. post d'un message sur nouvelle page)
		} else if(testUrl[3] != numPage) {
			TL.log('Nouvelle URL (formulaire)');
			this.messages = [];
			testUrl[3] = numPage;
			this.url = testUrl.join('-');
		}
	}

	suivreOnglets() {
		$(window).bind('focus', () => {
			if(!this.ongletActif) {
				this.ongletActif = true;
				this.favicon.maj('');
				this.nvxMessages = 0;
			}
		});
		$(window).bind('blur', () => {
			if(this.ongletActif) {
				this.ongletActif = false;
				this.favicon.maj('');
				this.nvxMessages = 0;
			}
		});
	}

	GET(cb) {
		const blocChargement = this.mobile ? $('.bloc-nom-sujet:last > span') : $('#bloc-formulaire-forum .titre-bloc');
		blocChargement.addClass('topiclive-loading');
        
		window.clearTimeout(this.idanalyse);
		$.ajax({
			type: 'GET',
			url: this.url,
			timeout: 5000,
			success: data => {
				if(this.oldInstance != this.instance) {
					this.log('Nouvelle instance detectee : arret du chargement');
					return;
				}
        
				blocChargement.removeClass('topiclive-loading');
				blocChargement.addClass('topiclive-loaded');
				cb($(data.substring(data.indexOf('<!DOCTYPE html>'))));
				setTimeout(() => { blocChargement.removeClass('topiclive-loaded'); }, 100);
                
				TL.loop();
			},
			error() {
				TL.loop();
			}
		});
	}
}

var TL = new TopicLive();
TL.initStatic();
