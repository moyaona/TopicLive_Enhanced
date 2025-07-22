// ==UserScript==
// @name TopicLive_Enhanced
// @description Charge les nouveaux messages d'un topic JVC en direct.
// @author kiwec, moyaona, lantea
// @match https://www.jeuxvideo.com/*
// @match https://m.jeuxvideo.com/*
// @run-at document-end
// @require https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @downloadURL https://github.com/moyaona/TopicLive_Enhanced/raw/main/TopicLive_Enhanced.user.js
// @updateURL https://github.com/moyaona/TopicLive_Enhanced/raw/main/TopicLive_Enhanced.user.js
// @version 6.2.1
// @grant none
// @noframes
// ==/UserScript==

/**
 * La classe Page représente le contenu d'une page du topic, qu'elle soit
 * chargée initialement ou récupérée via AJAX.
 */
class Page {
	constructor($page) {
		this.$page = $page;
	}

	/**
	 * Parcourt le contenu de la page pour trouver tous les blocs de messages
	 * et les retourne sous forme d'une liste d'objets Message.
	 * @returns {Message[]} La liste des messages trouvés.
	 */
	obtenirMessages() {
		const msgs = [];
		this.trouver(`${TL.class_msg}:not(.msg-pseudo-blacklist)`).each(function() {
			msgs.push(new Message($(this)));
		});
		return msgs;
	}

	/**
	 * S'exécute lorsqu'un ou plusieurs nouveaux messages sont affichés.
	 * Gère les notifications (son, favicon), le nettoyage des anciens messages,
	 * et les transformations de la page.
	 */
	maj() {
		if(localStorage.topiclive_son == 'true') {
			try { TL.son.play(); }
			catch(err) { TL.log(`### Erreur son : ${err}`); }
		}
		// Appelle la fonction centrale pour mettre à jour les compteurs (y compris le favicon)
		try { if(!TL.ongletActif) TL.updateCounters(); }
		catch(err) { TL.log(`### Erreur favicon (maj) : ${err}`); }
		try { this.Transformation(); }
		catch(err) { TL.log(`### Erreur jsli.Transformation() : ${err}`); }

		// Pour éviter que la page ne devienne trop lourde, on supprime les messages les plus anciens
		// si le total dépasse 100. C'est une mesure de performance essentielle.
		const nb_messages = $(`${TL.class_msg}:not(.msg-pseudo-blacklist)`).size();
		if(nb_messages > 100) {
			$(`${TL.class_msg}:not(.msg-pseudo-blacklist)`)
				.slice(0, nb_messages - 100)
				.remove();
		}

		// Déclenche un événement personnalisé pour informer d'autres scripts potentiels que le traitement est terminé.
		dispatchEvent(new CustomEvent('topiclive:doneprocessing', {
			'detail': { jvcake: TL.jvCake }
		}));
	}

    /**
	 * Vérifie si l'utilisateur a fait défiler la page jusqu'en bas.
     * Un seuil (threshold) est utilisé pour ne pas être trop strict.
	 * @returns {boolean} Vrai si l'utilisateur est en bas de page.
	 */
    isUserAtBottom() {
		const threshold = 350;
		return $(window).scrollTop() + $(window).height() >= $(document).height() - threshold;
	}

	/**
	 * Effectue un défilement fluide et ciblé vers le dernier message de la page,
     * en s'assurant qu'il soit entièrement visible.
	 */
	performScroll() {
		TL.log('Déclenchement du scroll automatique et ciblé.');
        TL.markAllAsRead(); // Cliquer sur le bouton ou scroller automatiquement marque tout comme lu.
        const $lastMessage = $(`${TL.class_msg}:last`);
        if ($lastMessage.length === 0) { return; }
        // Calcule la position pour que le bas du message soit visible avec une marge de 30px.
        const targetScrollTop = $lastMessage.offset().top + $lastMessage.outerHeight() - $(window).height() + 30;
		$('html, body').animate({ scrollTop: targetScrollTop }, 800);
	}

	/**
	 * C'est le cœur du script. Cette fonction est appelée après chaque requête AJAX.
	 * Elle compare les messages reçus avec ceux déjà affichés pour trouver les nouveautés.
	 */
	scan() {
        // Mémorise la position de l'utilisateur AVANT d'ajouter de nouveaux messages.
        const userWasAtBottom = this.isUserAtBottom();

		// Récupère les jetons de sécurité (timestamp et hash) nécessaires pour les futures requêtes AJAX.
		TL.ajaxTs = this.trouver('#ajax_timestamp_liste_messages').val();
		TL.ajaxHash = this.trouver('#ajax_hash_liste_messages').val();

		$('.nb-connect-fofo').text(this.trouver('.nb-connect-fofo').text());

		// Si on n'est pas sur la dernière page du topic, le script ne fait qu'actualiser l'URL et continuer.
		if($(TL.class_msg).length === 0 || $(TL.class_page_fin).length !== 0) {
			TL.log('Pas sur une derniere page : loop');
			TL.majUrl(this);
			TL.loop();
			return;
		}

		let messages_a_afficher = [];
		const nvMsgs = this.obtenirMessages();

		try {
			for(let nvMsg of nvMsgs) {
				let nv = true;
				for(let ancienMsg of TL.messages) {
					// Compare les messages par ID pour voir s'il est réellement nouveau.
					if(ancienMsg.id_message == nvMsg.id_message) {
						nv = false;
						ancienMsg.update(nvMsg); // S'il existe déjà, on vérifie s'il a été édité.
						break;
					}
				}
				if(nv) {
					TL.messages.push(nvMsg);
					TL.nvxMessages++;
					nvMsg.$message.hide();
                    nvMsg.fixAvatar();
					nvMsg.fixBlacklist();
					nvMsg.fixCitation();
					nvMsg.fixDeroulerCitation();
					if(TL.mobile) { nvMsg.fixMobile(); }
					$(`${TL.class_pagination}:last`).before(nvMsg.$message);
					messages_a_afficher.push({ message: nvMsg, cancelled: false });
					dispatchEvent(new CustomEvent('topiclive:newmessage', { 'detail': { id: nvMsg.id_message, jvcake: TL.jvCake, cancel: () => { evt.cancelled = true; } } }));
				}
			}
		} catch(err) { TL.log(`Erreur nouveaux messages : ${err}`); }

		TL.majUrl(this);

		if(messages_a_afficher.length > 0) {
			// Un délai est utilisé pour s'assurer que le DOM est prêt avant l'animation.
			setTimeout(() => {
				let maj = false;
				for(let msg of messages_a_afficher) {
					if(msg.cancelled) {
						TL.nvxMessages--;
					} else {
						msg.message.$message.fadeIn('slow');
                        TL.addUnreadAnchor(msg.message.$message); // Ajoute le message à la liste de lecture.
						maj = true;
					}
				}

				if(maj) {
					this.maj();
                    if (userWasAtBottom) {
                        this.performScroll();
                    } else {
                        TL.updateCounters();
                    }
				}
			}, 1000);
		}

		TL.loop();
	}

	/**
	 * Corrige les liens JvCare et les avatars qui peuvent être mal affichés
	 * après une injection dynamique de contenu.
	 */
	Transformation() { $('.JvCare').each(function () { const $span = $(this); let classes = $span.attr('class'); const href = TL.jvCake(classes); classes = classes.split(' '); const index = classes.indexOf('JvCare'); classes.splice(index, index + 2); classes.unshift('xXx'); classes = classes.join(' '); $span.replaceWith(`<a href="${href}" class="${classes}">${$span.html()}</a>`); }); $('.user-avatar-msg').each(function () { const $elem = $(this); const newsrc = $elem.attr('data-srcset'); if(newsrc != 'undefined') { $elem.attr('src', newsrc); $elem.removeAttr('data-srcset'); } }); }

	/**
	 * Raccourci pour rechercher un élément à l'intérieur du contenu de la page.
	 */
	trouver(chose) { return this.$page.find(chose); }
}

/**
 * Gère une option du script (ex: le son) et l'affiche dans le menu de JVC.
 */
class TLOption { constructor(nom, id) { this.actif = localStorage[id] == 'true'; this.nom = nom; this.id = id; this.injecter(); } injecter() { let option = `<li><span class="pull-left">TopicLive - ${this.nom}</span>`; option += `<input type="checkbox" class="input-on-off" id="${this.id}" `; option += this.actif ? 'checked>' : '>'; option += `<label for="${this.id}" class="btn-on-off"></label></li>`; $('.menu-user-forum').append(option); this.bouton = $(`#${this.id}`); this.bouton.change(() => { this.actif = !this.actif; localStorage[this.id] = this.actif; }); } }

/**
 * Représente un seul message et contient les méthodes pour interagir avec lui (citer, blacklister, etc.).
 */
class Message {
	constructor($message) { if(TL.estMP) { this.id_message = 'MP'; } else if(TL.mobile) { let id = $message.attr('id'); id = id.slice(id.indexOf('_') + 1); this.id_message = parseInt(id, 10); } else { this.id_message = parseInt($message.attr('data-id'), 10); } this.date = $(TL.class_date, $message).text().replace(/[\r\n]|#[0-9]+$/g, ''); this.edition = $message.find('.info-edition-msg').text(); this.$message = $message; this.pseudo = $('.bloc-pseudo-msg', $message).text().replace(/[\r\n]/g, ''); this.supprime = false; }
    fixAvatar() { let avatar = this.trouver('.user-avatar-msg'); avatar.attr('src', avatar.data('src')); }
	fixBlacklist() { this.trouver('.bloc-options-msg > .picto-msg-tronche, .msg-pseudo-blacklist .btn-blacklist-cancel').on('click', function () { $.ajax({ url: '/forums/ajax_forum_blacklist.php', data: { id_alias_msg: this.$message.attr('data-id-alias'), action: this.$message.attr('data-action'), ajax_hash: $('#ajax_hash_preference_user') }, dataType: 'json', success({erreur}) { if(erreur && erreur.length) { TL.alert(erreur); } else { document.location.reload(); } } }); }); }
	fixCitation() { this.$message.find('.bloc-options-msg .picto-msg-quote').on('click', () => { $.ajax({ type: 'POST', url: '/forums/ajax_citation.php', data: { id_message: this.id_message, ajax_timestamp: TL.ajaxTs, ajax_hash: TL.ajaxHash }, dataType: 'json', timeout: 5000, success: ({txt}) => { const $msg = TL.formu.obtenirMessage(); let nvmsg = `> Le ${this.date} ${this.pseudo} a écrit :\n>`; nvmsg += `${txt.split('\n').join('\n> ')}\n\n`; if ($msg[0].value === '') { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value") .set.call($msg[0], `${nvmsg}\n`); } else { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value") .set.call($msg[0], `${$msg[0].value}\n\n${nvmsg}`); } $msg[0].dispatchEvent(new Event("input", { bubbles: true })); $msg[0].focus(); location.hash = '#forums-post-message-editor'; }, error: this.fixCitation.bind(this) }); }); }
	fixDeroulerCitation() { this.trouver('blockquote').click(function() { $(this).attr('data-visible', '1'); }); }
	fixMobile() { this.trouver('.message').addClass('show-all'); }
	trouver(chose) { return this.$message.find(chose); }
	update(nvMessage) { if(this.edition == nvMessage.edition) return; TL.log(`Message ${this.id_message} edite : mise a jour`); this.edition = nvMessage.edition; this.trouver(TL.class_contenu).html(nvMessage.trouver(TL.class_contenu).html()); dispatchEvent(new CustomEvent('topiclive:edition', { 'detail': { id: this.id_message, jvcake: TL.jvCake } })); const defColor = this.$message.css('backgroundColor'); this.$message.animate({ backgroundColor: '#FF9900' }, 50); this.$message.animate({ backgroundColor: defColor }, 500); }
}

/**
 * Gère le formulaire de réponse de JVC pour permettre de poster sans recharger la page.
 */
class Formulaire { constructor() { this.hook(); } afficherErreurs(msg) { if(typeof msg !== 'undefined') { let message_erreur = ''; for(let i = 0; i < msg.length; i++) { message_erreur += msg[i]; if(i < msg.length) message_erreur += '<br />'; } TL.alert(message_erreur); } } envoyer(e) { if(typeof e !== 'undefined' && typeof e.errors !== 'undefined' && e.errors.length) { this.afficherErreurs(e.erreurs); } else { TL.log('Message valide. Envoi en cours'); this.trouver('.btn-poster-msg').attr('disabled', 'disabled'); this.trouver('.conteneur-editor').fadeOut(); window.clearTimeout(TL.idanalyse); $.ajax({ type: 'POST', url: TL.url, data: this.obtenirFormulaire().serializeArray(), timeout: 5000, success: data => { switch(typeof data) { case 'object': if(data.hidden_reset) { this.trouver('input[type="hidden"]').remove(); this.obtenirFormulaire().append(data.hidden_reset); } if(data.errors) { this.afficherErreurs(data.errors); this.trouver('.btn-poster-msg').removeAttr('disabled'); this.trouver('.conteneur-editor').fadeIn(); } if(data.redirect_uri) { TL.log(`Redirection du formulaire vers ${data.redirect_uri}`); TL.url = data.redirect_uri; TL.GET(this.verifEnvoi.bind(this)); } break; case 'string': this.verifEnvoi($(data.substring(data.indexOf('<!DOCTYPE html>')))); break; case 'undefined': default: TL.alert('Erreur inconnue lors de l\'envoi du message.'); this.trouver('.btn-poster-msg').removeAttr('disabled'); this.trouver('.conteneur-editor').fadeIn(); break; } TL.loop(); }, error: err => TL.alert(`Erreur lors de l'envoi du message : ${err}`) }); } } hook() { const $form = this.obtenirFormulaire(); const $bouton = $form.find('.btn-poster-msg'); $bouton.off(); $bouton.removeAttr('data-push'); $bouton.attr('type', 'button'); $bouton.on('click', this.verifMessage.bind(this)); } maj($nvform) { TL.log('Mise a jour du formulaire'); const $form = this.obtenirFormulaire(); const $cap = this.obtenirCaptcha($form); const $ncap = this.obtenirCaptcha($nvform); this.trouver('input[type="hidden"]').remove(); $nvform.find('input[type="hidden"]').each(function() { $form.append($(this)); }); this.trouver('.btn-poster-msg').removeAttr('disabled'); this.trouver('.conteneur-editor').fadeIn(); $cap.remove(); this.trouver('.jv-editor').after($ncap); this.trouver('.alert-danger').remove(); this.trouver('.row:first').before($nvform.find('.alert-danger')); this.obtenirMessage().val(this.obtenirMessage($nvform).val()); this.hook(); } obtenirCaptcha($form) { if(typeof $form === 'undefined') $form = this.obtenirFormulaire(); return $form.find('.jv-editor').next('div'); } obtenirMessage($form) { if(typeof $form == 'undefined') $form = this.obtenirFormulaire(); return $form.find(TL.estMP ? '#message' : '#message_topic'); } obtenirFormulaire($page) { if(typeof $page === 'undefined') $page = $(document); return $page.find(TL.estMP ? '#repondre-mp > form' : '#forums-post-message-editor'); } verifEnvoi(data) { const nvPage = new Page(data); const $formu = this.obtenirFormulaire(nvPage.$page); this.maj($formu); TL.majUrl(nvPage); nvPage.scan(); } verifMessage() { TL.log('Verification du message avant envoi'); if(TL.estMP) { this.envoyer(); } else { $.ajax({ type: 'POST', url: '/forums/ajax_check_poste_message.php', data: { id_topic, new_message: this.obtenirMessage().val(), ajax_timestamp: TL.ajaxTs, ajax_hash: TL.ajaxHash }, dataType: 'json', timeout: 5000, success: this.envoyer.bind(this), error: this.verifMessage.bind(this) }); } return false; } trouver(chose) { return this.obtenirFormulaire().find(chose); } }

/**
 * Gère la création et la mise à jour du favicon de l'onglet avec un compteur de notifications.
 */
class Favicon {
	constructor() {
		try {
            this.imageLoaded = false; this.pendingText = '';
			this.canv = $('<canvas>').get(0); this.canv.width = 192; this.canv.height = 192;
			this.context = this.canv.getContext('2d');
			this.image = new Image();
            this.image.onload = () => { this.imageLoaded = true; if (this.pendingText) { this.maj(this.pendingText); } };
			this.image.src = 'https://www.jeuxvideo.com/favicon.png'; this.maj('');
		} catch(err) { TL.log(`### Erreur init favicon : ${err}`); }
	}
	clear() { this.context.clearRect(0, 0, this.canv.width, this.canv.height); if (this.imageLoaded) { this.context.drawImage(this.image, 0, 0); } }

   maj(txt) {
        this.pendingText = txt;
        if (!this.imageLoaded) {
            TL.log("Mise à jour du favicon en attente du chargement de l'image de base.");
            return;
        }

        this.clear();

        if (txt && txt !== '') {
            const radius = 70;
            const borderWidth = 8; // Une bordure un peu plus épaisse pour le style
            const centerX = radius + borderWidth;
            const centerY = radius + borderWidth;
            const font = 'bold 120px Arial Black';
            const verticalTextOffset = 8; // Ajustement vertical pour la police Arial Black

            // 1. Dessine la bordure blanche pour la lisibilité
            //this.context.beginPath();
            //this.context.arc(centerX, centerY, radius + borderWidth, 0, 2 * Math.PI);
            //this.context.fillStyle = 'white';
            //this.context.fill();

            // 2. Dessine le cercle de notification bleu
            this.context.beginPath();
            this.context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            this.context.fillStyle = '#0074ff';
            this.context.fill();

            // 3. Configure l'ombre portée pour le texte
            this.context.shadowColor = 'rgba(0, 0, 0, 0.5)'; // Ombre noire semi-transparente
            this.context.shadowBlur = 5;      // Flou de l'ombre
            this.context.shadowOffsetX = 3;   // Décalage horizontal
            this.context.shadowOffsetY = 3;   // Décalage vertical

            // 4. Dessine le texte avec son ombre
            this.context.font = font;
            this.context.fillStyle = 'white';
            this.context.textAlign = 'center';
            this.context.textBaseline = 'middle';
            this.context.fillText(txt, centerX, centerY + verticalTextOffset);

            // 5. Réinitialise l'ombre pour ne pas affecter les dessins suivants
            this.context.shadowColor = 'transparent';
            this.context.shadowBlur = 0;
            this.context.shadowOffsetX = 0;
            this.context.shadowOffsetY = 0;
        }

        this.replace();
    }
	replace() { $('link[rel*="icon"]').remove(); this.lien = $('<link>', { href: this.canv.toDataURL('image/png'), rel: 'shortcut icon', type: 'image/png' }); $('head').append(this.lien); }
}

/**
 * La classe principale qui orchestre tout le script.
 */
class TopicLive {
	constructor() {
		this.instance = 0;
        // Détecte l'état réel de l'onglet au démarrage.
		this.ongletActif = !document.hidden;
        // Initialise la liste des messages non lus.
        this.unreadMessageAnchors = [];
	}
	ajouterOptions() { if(this.mobile) return; this.options = { optionSon: new TLOption('Son', 'topiclive_son') }; }
	charger() { if(this.oldInstance != this.instance) { return; } TL.GET(data => { new Page(data).scan(); }); }
	init() { if(typeof $ === 'undefined') { return this.log('### jQuery introuvable !'); } this.instance++; this.ajaxTs = $('#ajax_timestamp_liste_messages').val(); this.ajaxHash = $('#ajax_hash_liste_messages').val(); this.estMP = $('.mp-page').length; this.url = this.estMP ? document.URL.substring(0, document.URL.indexOf('&')) : document.URL; this.mobile = document.URL.includes('//m.jeuxvideo.com'); this.class_msg = this.mobile ? '.post' : '.bloc-message-forum'; this.class_num_page = this.mobile ? '.num-page' : '.page-active'; this.class_page_fin = this.mobile ? '.right-elt > a' : '.pagi-fin-actif'; this.class_date = this.mobile ? '.date-post' : '.bloc-date-msg'; this.class_contenu = this.mobile ? '.contenu' : '.bloc-contenu'; this.class_pagination = this.mobile ? '.pagination-b' : '.bloc-pagi-default'; this.ajouterOptions(); const analysable = (document.URL.match(/\/forums\/\d/) || document.URL.match(/\/messages-prives\//)); if(analysable && $(this.class_msg).length > 0) { this.log('TopicLive actif sur cette page.'); this.page = new Page($(document)); this.formu = new Formulaire(); this.messages = this.page.obtenirMessages(); this.nvxMessages = 0; this.page.scan(); this.loop(); } else { this.log('TopicLive sera inactif sur cette page'); } }

    /**
     * Crée le bouton "Nouveaux messages", le style, et attache l'écouteur de scroll
     * pour la lecture progressive.
     */
    initScrollButton() {
        const buttonCss = ` #topiclive-scroll-button { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 20px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.2); display: none; transition: opacity 0.3s; } #topiclive-scroll-button:hover { background-color: #0056b3; } `;
        $('head').append(`<style>${buttonCss}</style>`);
        this.$scrollButton = $('<button id="topiclive-scroll-button">↓ Nouveaux messages</button>');
        $('body').append(this.$scrollButton);
        this.$scrollButton.on('click', () => { this.page.performScroll(); });

        $(window).on('scroll', () => {
            if (this.unreadMessageAnchors.length === 0) { return; }
            const viewportBottom = $(window).scrollTop() + $(window).height();
            const messagesJustRead = [];
            for (const $message of this.unreadMessageAnchors) {
                const messageBottom = $message.offset().top + $message.outerHeight();
                if (viewportBottom >= messageBottom) {
                    messagesJustRead.push($message);
                }
            }
            if (messagesJustRead.length > 0) {
                this.unreadMessageAnchors = this.unreadMessageAnchors.filter( $anchor => !messagesJustRead.some($read => $read.is($anchor)) );
                this.nvxMessages -= messagesJustRead.length;
                this.updateCounters();
            }
        });
    }

    /**
     * La fonction centrale qui met à jour l'état du bouton et du favicon.
     * C'est le chef d'orchestre des compteurs.
     */
    updateCounters() {
        this.log(`Mise à jour des compteurs : ${this.nvxMessages} messages non lus.`);
        let countText = '';
        if (this.nvxMessages > 0) {
            countText = this.nvxMessages > 99 ? '99+' : `${this.nvxMessages}`;
        }

        this.favicon.maj(countText);

        if (this.nvxMessages > 0) {
            this.showScrollButton(this.nvxMessages);
        } else {
            this.hideScrollButton();
        }
    }

    markAllAsRead() { this.nvxMessages = 0; this.unreadMessageAnchors = []; this.updateCounters(); }
    showScrollButton(count) { const message = count > 1 ? `↓ ${count} Nouveaux messages` : '↓ Nouveau message'; this.$scrollButton.text(message).fadeIn(); }
    hideScrollButton() { this.$scrollButton.fadeOut(); }
    addUnreadAnchor($message) { this.unreadMessageAnchors.push($message); }

	/**
	 * Point d'entrée principal du script, appelé une seule fois.
	 */
	initStatic() {
		this.favicon = new Favicon(); this.son = new Audio('https://raw.githubusercontent.com/Kiwec/TopicLive/master/notification.ogg');
		this.suivreOnglets(); this.initScrollButton(); this.init();
		addEventListener('instantclick:newpage', this.init.bind(this));
		$("head").append("<style type='text/css'> .topiclive-loading:after { content: ' ○' } .topiclive-loaded:after { content: ' ●' } </style>");
		this.log('Fin de l\'initialisation');
	}

	jvCake(classe) { const base16 = '0A12B34C56D78E9F'; let lien = ''; const s = classe.split(' ')[1]; for (let i = 0; i < s.length; i += 2) { lien += String.fromCharCode(base16.indexOf(s.charAt(i)) * 16 + base16.indexOf(s.charAt(i + 1))); } return lien; }
	alert(message) { try { modal('erreur', { message }); this.log(message); } catch(err) { this.log('### Fonction modal() inaccessible'); alert(message); } }
	log(message) { console.log(`[TopicLive] ${message}`); }
	loop() { if(typeof this.idanalyse !== 'undefined') window.clearTimeout(this.idanalyse); let duree = this.ongletActif ? 5000 : 10000; if(this.mobile) duree = 10000; this.oldInstance = this.instance; this.idanalyse = setTimeout(this.charger.bind(this), duree); }
	majUrl(page) { if(this.estMP) return; const $bouton = page.trouver(this.class_page_fin); const numPage = page.trouver(`${this.class_num_page}:first`).text(); const testUrl = this.url.split('-'); if($bouton.length > 0) { TL.log('Nouvelle URL (loop)'); this.messages = []; if($bouton.prop('tagName') == 'A') { this.url = $bouton.attr('href'); } else { this.url = this.jvCake($bouton.attr('class')); } } else if(testUrl[3] != numPage) { TL.log('Nouvelle URL (formulaire)'); this.messages = []; testUrl[3] = numPage; this.url = testUrl.join('-'); } }

    /**
     * Utilise l'API de Visibilité de Page pour mettre à jour l'état de l'onglet.
     * Ne touche plus directement aux compteurs.
     */
    suivreOnglets() {
        document.addEventListener('visibilitychange', () => {
            this.ongletActif = !document.hidden;
            this.log(`Visibilité changée. Onglet actif : ${this.ongletActif}`);
        });
	}

	GET(cb) { const blocChargement = this.mobile ? $('.bloc-nom-sujet:last > span') : $('#bloc-formulaire-forum .titre-bloc'); blocChargement.addClass('topiclive-loading'); window.clearTimeout(this.idanalyse); $.ajax({ type: 'GET', url: this.url, timeout: 5000, success: data => { if(this.oldInstance != this.instance) { this.log('Nouvelle instance detectee : arret du chargement'); return; } blocChargement.removeClass('topiclive-loading'); blocChargement.addClass('topiclive-loaded'); cb($(data.substring(data.indexOf('<!DOCTYPE html>')))); setTimeout(() => { blocChargement.removeClass('topiclive-loaded'); }, 100); TL.loop(); }, error() { TL.loop(); } }); }
}

var TL = new TopicLive();
TL.initStatic();
