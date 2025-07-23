// ==UserScript==
// @name          TopicLive_Enhanced
// @description   Charge les nouveaux messages d'un topic JVC en direct.
// @author        kiwec, moyaona, lantea
// @match         https://www.jeuxvideo.com/*
// @match         https://m.jeuxvideo.com/*
// @downloadURL https://github.com/moyaona/TopicLive_Enhanced/raw/refs/heads/main/TopicLive_Enhanced.user.js
// @updateURL https://github.com/moyaona/TopicLive_Enhanced/raw/refs/heads/main/TopicLive_Enhanced.user.js
// @run-at        document-end
// @require       https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @icon          https://image.noelshack.com/fichiers/2025/30/3/1753227153-logo-topiclive-enhanced.png
// @version       6.4.0
// @grant         none
// @noframes
// ==/UserScript==

/**
 * =================================================================================
 * CLASSE PAGE
 * =================================================================================
 * Représente le contenu d'une page de topic.
 * Cette classe contient les méthodes pour analyser le DOM (la structure de la page),
 * trouver les nouveaux messages, et mettre à jour l'affichage.
 */
class Page {

    /**
     * Crée une instance de la classe Page.
     * @param {jQuery} $page - Un objet jQuery contenant le code HTML complet de la page à analyser.
     */
    constructor($page) {
        this.$page = $page;
    }

    /**
     * Parcourt le contenu de la page pour trouver tous les blocs de messages.
     * Elle exclut les messages des utilisateurs blacklistés.
     * @returns {Message[]} - Un tableau (liste) d'objets `Message` trouvés sur la page.
     */
    obtenirMessages() {
        const msgs = [];
        this.trouver(`${TL.class_msg}:not(.msg-pseudo-blacklist)`).each(function() {
            msgs.push(new Message($(this)));
        });
        return msgs;
    }

    /**
     * S'exécute après l'affichage d'un ou plusieurs nouveaux messages.
     * Gère les actions consécutives à une mise à jour : notifications, nettoyage, etc.
     */
    maj() {
        // Joue un son de notification si l'option est activée.
        if (localStorage.topiclive_son == 'true') {
            try {
                TL.son.play();
            } catch (err) {
                // Affiche une erreur si la lecture du son échoue (ex: bloqué par le navigateur).
                console.error(`[TopicLive] Erreur son : ${err}`);
            }
        }

        // Met à jour le compteur sur le favicon si l'onglet n'est pas actif.
        try {
            if (!TL.ongletActif) {
                TL.updateCounters();
            }
        } catch (err) {
            console.error(`[TopicLive] Erreur favicon (maj) : ${err}`);
        }

        // Applique des transformations nécessaires à la page (ex: liens JvCare).
        try {
            this.Transformation();
        } catch (err) {
            console.error(`[TopicLive] Erreur jsli.Transformation() : ${err}`);
        }

        // Nettoie les messages les plus anciens pour éviter de surcharger la page.
        const nb_messages = $(`${TL.class_msg}:not(.msg-pseudo-blacklist)`).size();
        if (nb_messages > 100) {
            $(`${TL.class_msg}:not(.msg-pseudo-blacklist)`).slice(0, nb_messages - 100).remove();
        }

        // Déclenche un événement personnalisé pour signaler que le traitement est terminé.
        dispatchEvent(new CustomEvent('topiclive:doneprocessing', {
            'detail': {
                jvcake: TL.jvCake
            }
        }));
    }

    /**
     * Vérifie si l'utilisateur a fait défiler la page jusqu'en bas.
     * @returns {boolean} - `true` si l'utilisateur est considéré comme étant en bas de la page.
     */
    isUserAtBottom() {
        const threshold = 350; // Marge de tolérance en pixels.
        return $(window).scrollTop() + $(window).height() >= $(document).height() - threshold;
    }

    /**
     * Fait défiler la page avec une animation fluide jusqu'au premier message non lu.
     */
    performScroll() {
        console.log('[TopicLive] Déclenchement du scroll vers le premier message non lu.');
        const $firstUnreadMessage = TL.unreadMessageAnchors[0];

        if (!$firstUnreadMessage || $firstUnreadMessage.length === 0) {
            return;
        }

        const targetScrollTop = $firstUnreadMessage.offset().top - 100; // Marge de 100px en haut.

        $('html, body').animate({
            scrollTop: targetScrollTop
        }, 800); // Durée de l'animation : 800ms.
    }

    /**
     * C'est le cœur du script.
     * Compare les messages reçus via AJAX avec ceux déjà affichés pour injecter les nouveautés.
     */
    scan() {
        const userWasAtBottom = this.isUserAtBottom();

        // Met à jour les informations techniques (timestamp, hash) pour les futures requêtes.
        TL.ajaxTs = this.trouver('#ajax_timestamp_liste_messages').val();
        TL.ajaxHash = this.trouver('#ajax_hash_liste_messages').val();

        // Met à jour le nombre de connectés sur le forum.
        $('.nb-connect-fofo').text(this.trouver('.nb-connect-fofo').text());

        // Si on est sur la dernière page, on se contente de rafraîchir en boucle.
        if ($(TL.class_msg).length === 0 || $(TL.class_page_fin).length !== 0) {
            TL.majUrl(this);
            TL.loop();
            return;
        }

        let messages_a_afficher = [];
        const nvMsgs = this.obtenirMessages();

        try {
            // Boucle sur les messages fraîchement téléchargés.
            for (let nvMsg of nvMsgs) {
                let nv = true;
                // Boucle sur les messages déjà affichés pour voir si c'est une nouveauté.
                for (let ancienMsg of TL.messages) {
                    if (ancienMsg.id_message == nvMsg.id_message) {
                        nv = false; // Ce message existe déjà.
                        ancienMsg.update(nvMsg); // On vérifie s'il a été édité.
                        break;
                    }
                }

                // Si le message est bien une nouveauté.
                if (nv) {
                    TL.messages.push(nvMsg);
                    TL.nvxMessages++;
                    nvMsg.$message.hide(); // On le cache pour le faire apparaître avec un effet.

                    // On applique diverses corrections pour que les fonctionnalités JVC marchent.
                    nvMsg.fixAvatar();
                    nvMsg.fixBlacklist();
                    nvMsg.fixCitation();
                    nvMsg.fixDeroulerCitation();
                    if (TL.mobile) {
                        nvMsg.fixMobile();
                    }

                    // On insère le message dans le DOM, juste avant la pagination.
                    $(`${TL.class_pagination}:last`).before(nvMsg.$message);
                    messages_a_afficher.push({ message: nvMsg, cancelled: false });

                    // On déclenche un événement pour d'autres scripts potentiels.
                    dispatchEvent(new CustomEvent('topiclive:newmessage', {
                        'detail': {
                            id: nvMsg.id_message,
                            jvcake: TL.jvCake,
                            cancel: () => { evt.cancelled = true; }
                        }
                    }));
                }
            }
        } catch (err) {
            console.error(`[TopicLive] Erreur nouveaux messages : ${err}`);
        }

        TL.majUrl(this);

        // Si on a trouvé des messages à afficher...
        if (messages_a_afficher.length > 0) {
            const isTextareaFocused = $(TL.formu.obtenirMessage()).is(':focus');
            let distanceFromBottom;

            // Si l'utilisateur est en train d'écrire, on sauvegarde sa position de scroll.
            if (isTextareaFocused) {
                distanceFromBottom = document.documentElement.scrollHeight - $(window).scrollTop();
            }

            // On attend une seconde avant d'afficher pour un effet plus doux.
            setTimeout(() => {
                let maj = false;
                for (let msg of messages_a_afficher) {
                    if (msg.cancelled) {
                        TL.nvxMessages--;
                    } else {
                        msg.message.$message.fadeIn('slow'); // Effet d'apparition.
                        TL.addUnreadAnchor(msg.message.$message);
                        maj = true;
                    }
                }

                // On restaure la position de scroll pour que le champ de texte ne bouge pas.
                if (isTextareaFocused) {
                    const newScrollTop = document.documentElement.scrollHeight - distanceFromBottom;
                    $(window).scrollTop(newScrollTop);
                }

                if (maj) {
                    this.maj();
                    if (userWasAtBottom && !isTextareaFocused) {
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
     * Corrige des éléments spécifiques à JVC après une injection de contenu.
     */
    Transformation() {
        // Répare les liens "JvCare" qui sont obscurcis par JVC.
        $('.JvCare').each(function() {
            const $span = $(this);
            let classes = $span.attr('class');
            const href = TL.jvCake(classes);
            classes = classes.split(' ');
            const index = classes.indexOf('JvCare');
            classes.splice(index, index + 2);
            classes.unshift('xXx');
            classes = classes.join(' ');
            $span.replaceWith(`<a href="${href}" class="${classes}">${$span.html()}</a>`);
        });
        // Force le chargement des avatars qui sont en "lazy loading".
        $('.user-avatar-msg').each(function() {
            const $elem = $(this);
            const newsrc = $elem.attr('data-srcset');
            if (newsrc != 'undefined') {
                $elem.attr('src', newsrc);
                $elem.removeAttr('data-srcset');
            }
        });
    }

    /**
     * Raccourci pour rechercher un élément à l'intérieur du contenu de la page.
     * @param {string} chose - Le sélecteur CSS à rechercher.
     * @returns {jQuery} - L'élément trouvé.
     */
    trouver(chose) {
        return this.$page.find(chose);
    }
}


/**
 * =================================================================================
 * CLASSE TLOPTION
 * =================================================================================
 * Gère une option du script (ex: activer/désactiver le son).
 * Affiche une case à cocher dans le menu des options de JVC et sauvegarde le choix.
 */
class TLOption {

    /**
     * Crée une nouvelle option.
     * @param {string} nom - Le nom de l'option qui sera affiché.
     * @param {string} id - L'identifiant unique pour le `localStorage`.
     */
    constructor(nom, id) {
        // Si l'option n'a jamais été définie, on l'active par défaut.
        if (localStorage.getItem(id) === null) {
            localStorage.setItem(id, 'true');
        }
        this.actif = localStorage[id] == 'true';
        this.nom = nom;
        this.id = id;
        this.injecter();
    }

    /**
     * Injecte le code HTML de l'option dans le menu de JVC.
     */
    injecter() {
        let option = `<li><span class="pull-left">TopicLive - ${this.nom}</span>`;
        option += `<input type="checkbox" class="input-on-off" id="${this.id}" ${this.actif ? 'checked' : ''}>`;
        option += `<label for="${this.id}" class="btn-on-off"></label></li>`;
        $('.menu-user-forum').append(option);

        // Ajoute un écouteur d'événement sur la case à cocher.
        this.bouton = $(`#${this.id}`);
        this.bouton.change(() => {
            this.actif = !this.actif;
            localStorage[this.id] = this.actif;

            // Déclenche un événement pour que le script puisse réagir immédiatement au changement.
            dispatchEvent(new CustomEvent('topiclive:optionchanged', {
                'detail': {
                    id: this.id,
                    actif: this.actif
                }
            }));
        });
    }
}


/**
 * =================================================================================
 * CLASSE MESSAGE
 * =================================================================================
 * Représente un seul message du forum.
 * Contient ses informations (ID, pseudo, date) et les méthodes pour interagir avec.
 */
class Message {
    constructor($message) {
        // La logique pour récupérer l'ID est différente sur mobile, MP, et forum.
        if (TL.estMP) {
            this.id_message = 'MP';
        } else if (TL.mobile) {
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
        this.trouver('.bloc-options-msg > .picto-msg-tronche, .msg-pseudo-blacklist .btn-blacklist-cancel').on('click', function() {
            $.ajax({
                url: '/forums/ajax_forum_blacklist.php',
                data: {
                    id_alias_msg: this.$message.attr('data-id-alias'),
                    action: this.$message.attr('data-action'),
                    ajax_hash: $('#ajax_hash_preference_user')
                },
                dataType: 'json',
                success: ({ erreur }) => {
                    if (erreur && erreur.length) {
                        TL.alert(erreur);
                    } else {
                        document.location.reload();
                    }
                }
            });
        });
    }

    fixCitation() {
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
                success: ({ txt }) => {
                    const $msg = TL.formu.obtenirMessage();
                    let nvmsg = `> Le ${this.date} ${this.pseudo} a écrit :\n>`;
                    nvmsg += `${txt.split('\n').join('\n> ')}\n\n`;
                    if ($msg[0].value === '') {
                        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call($msg[0], `${nvmsg}\n`);
                    } else {
                        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call($msg[0], `${$msg[0].value}\n\n${nvmsg}`);
                    }
                    $msg[0].dispatchEvent(new Event("input", { bubbles: true }));
                    $msg[0].focus();
                    location.hash = '#forums-post-message-editor';
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
        if (this.edition == nvMessage.edition) return;

        this.edition = nvMessage.edition;
        this.trouver(TL.class_contenu).html(nvMessage.trouver(TL.class_contenu).html());

        dispatchEvent(new CustomEvent('topiclive:edition', {
            'detail': { id: this.id_message, jvcake: TL.jvCake }
        }));

        const defColor = this.$message.css('backgroundColor');
        this.$message.animate({ backgroundColor: '#FF9900' }, 50);
        this.$message.animate({ backgroundColor: defColor }, 500);
    }
}


/**
 * =================================================================================
 * CLASSE FORMULAIRE
 * =================================================================================
 * Gère le formulaire de réponse pour permettre de poster un message sans recharger la page.
 */
class Formulaire {

    constructor() {
        this.hook();
    }

    afficherErreurs(msg) {
        if (typeof msg !== 'undefined') {
            let message_erreur = '';
            for (let i = 0; i < msg.length; i++) {
                message_erreur += msg[i];
                if (i < msg.length) message_erreur += '<br />';
            }
            TL.alert(message_erreur);
        }
    }

    envoyer(e) {
        if (typeof e !== 'undefined' && typeof e.errors !== 'undefined' && e.errors.length) {
            this.afficherErreurs(e.erreurs);
        } else {
            this.trouver('.btn-poster-msg').attr('disabled', 'disabled');
            this.trouver('.conteneur-editor').fadeOut();
            window.clearTimeout(TL.idanalyse);
            $.ajax({
                type: 'POST',
                url: TL.url,
                data: this.obtenirFormulaire().serializeArray(),
                timeout: 5000,
                success: data => {
                    switch (typeof data) {
                        case 'object':
                            if (data.hidden_reset) {
                                this.trouver('input[type="hidden"]').remove();
                                this.obtenirFormulaire().append(data.hidden_reset);
                            }
                            if (data.errors) {
                                this.afficherErreurs(data.errors);
                                this.trouver('.btn-poster-msg').removeAttr('disabled');
                                this.trouver('.conteneur-editor').fadeIn();
                            }
                            if (data.redirect_uri) {
                                TL.url = data.redirect_uri;
                                TL.GET(this.verifEnvoi.bind(this));
                            }
                            break;
                        case 'string':
                            this.verifEnvoi($(data.substring(data.indexOf('<!DOCTYPE html>'))));
                            break;
                        case 'undefined':
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
        const $form = this.obtenirFormulaire();
        const $bouton = $form.find('.btn-poster-msg');
        $bouton.off();
        $bouton.removeAttr('data-push');
        $bouton.attr('type', 'button');
        $bouton.on('click', this.verifMessage.bind(this));
    }

    maj($nvform) {
        const $form = this.obtenirFormulaire();
        const $cap = this.obtenirCaptcha($form);
        const $ncap = this.obtenirCaptcha($nvform);
        this.trouver('input[type="hidden"]').remove();
        $nvform.find('input[type="hidden"]').each(function() {
            $form.append($(this));
        });
        this.trouver('.btn-poster-msg').removeAttr('disabled');
        this.trouver('.conteneur-editor').fadeIn();
        $cap.remove();
        this.trouver('.jv-editor').after($ncap);
        this.trouver('.alert-danger').remove();
        this.trouver('.row:first').before($nvform.find('.alert-danger'));
        this.obtenirMessage().val(this.obtenirMessage($nvform).val());
        this.hook();
    }

    obtenirCaptcha($form) {
        if (typeof $form === 'undefined') $form = this.obtenirFormulaire();
        return $form.find('.jv-editor').next('div');
    }

    obtenirMessage($form) {
        if (typeof $form == 'undefined') $form = this.obtenirFormulaire();
        // Le sélecteur de l'input est différent pour les MPs et les forums.
        return $form.find(TL.estMP ? '#message' : '#message_topic');
    }

    obtenirFormulaire($page) {
        if (typeof $page === 'undefined') $page = $(document);
        // Le sélecteur du formulaire est différent pour les MPs et les forums.
        return $page.find(TL.estMP ? '#repondre-mp > form' : '#forums-post-message-editor');
    }

    verifEnvoi(data) {
        const nvPage = new Page(data);
        const $formu = this.obtenirFormulaire(nvPage.$page);
        this.maj($formu);
        TL.majUrl(nvPage);
        nvPage.scan();
    }

    verifMessage() {
        // La vérification AJAX n'existe pas pour les MPs, on envoie directement.
        if (TL.estMP) {
            this.envoyer();
        } else {
            $.ajax({
                type: 'POST',
                url: '/forums/ajax_check_poste_message.php',
                data: {
                    id_topic,
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


/**
 * =================================================================================
 * CLASSE FAVICON
 * =================================================================================
 * Gère la création et la mise à jour du favicon de l'onglet du navigateur
 * pour y afficher un compteur de notifications.
 */
class Favicon {

    constructor() {
        try {
            this.imageLoaded = false;
            this.pendingText = '';
            this.canv = $('<canvas>').get(0);
            this.canv.width = 192;
            this.canv.height = 192;
            this.context = this.canv.getContext('2d');
            this.image = new Image();
            this.image.onload = () => {
                this.imageLoaded = true;
                if (this.pendingText) {
                    this.maj(this.pendingText);
                }
            };
            this.image.src = 'https://www.jeuxvideo.com/favicon.png';
            this.maj('');
        } catch (err) {
            console.error(`[TopicLive] Erreur init favicon : ${err}`);
        }
    }

    clear() {
        this.context.clearRect(0, 0, this.canv.width, this.canv.height);
        if (this.imageLoaded) {
            this.context.drawImage(this.image, 0, 0);
        }
    }

    maj(txt) {
        this.pendingText = txt;
        if (!this.imageLoaded) {
            return;
        }
        this.clear();

        if (txt && txt !== '') {
            const radius = 70;
            const borderWidth = 8;
            const centerX = radius + borderWidth;
            const centerY = radius + borderWidth;
            const font = 'bold 120px Arial Black';
            const verticalTextOffset = 8;
            const shadowOffset = 6;

            // 1. Dessine les cercles de fond (blanc puis bleu).
            this.context.beginPath();
            this.context.arc(centerX, centerY, radius + borderWidth, 0, 2 * Math.PI);
            this.context.fillStyle = 'white';
            this.context.fill();
            this.context.beginPath();
            this.context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            this.context.fillStyle = '#0074ff';
            this.context.fill();

            // 2. Prépare le style du texte.
            this.context.font = font;
            this.context.textAlign = 'center';
            this.context.textBaseline = 'middle';

            // 3. Dessine "l'ombre" : le texte en noir, légèrement décalé.
            this.context.fillStyle = 'black';
            this.context.fillText(txt, centerX + shadowOffset, centerY + verticalTextOffset + shadowOffset);

            // 4. Dessine le texte principal en blanc par-dessus.
            this.context.fillStyle = 'white';
            this.context.fillText(txt, centerX, centerY + verticalTextOffset);
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


/**
 * =================================================================================
 * CLASSE TOPICLIVE (CLASSE PRINCIPALE)
 * =================================================================================
 * C'est la classe qui orchestre tout le script.
 * Elle gère l'initialisation, la boucle de rafraîchissement et l'état général.
 */
class TopicLive {

    constructor() {
        this.instance = 0;
        this.ongletActif = !document.hidden;
        this.unreadMessageAnchors = [];
    }

    ajouterOptions() {
        if (this.mobile) return;
        this.options = {
            optionSon: new TLOption('Son', 'topiclive_son'),
            optionFavicon: new TLOption('Compteur Favicon', 'topiclive_favicon'),
            optionScrollButton: new TLOption('Bouton "Nouveaux messages"', 'topiclive_scrollbutton')
        };
    }

    charger() {
        if (this.oldInstance != this.instance) {
            return;
        }
        TL.GET(data => {
            new Page(data).scan();
        });
    }

    init() {
        if (typeof $ === 'undefined') {
            return;
        }

        this.instance++;
        this.ajaxTs = $('#ajax_timestamp_liste_messages').val();
        this.ajaxHash = $('#ajax_hash_liste_messages').val();

        // On détermine si on est sur une page de MP pour adapter la logique.
        this.estMP = $('.mp-page').length > 0;
        // L'URL de rafraîchissement des MPs est différente.
        this.url = this.estMP ? document.URL.substring(0, document.URL.indexOf('&')) : document.URL;

        this.mobile = document.URL.includes('//m.jeuxvideo.com');
        this.class_msg = this.mobile ? '.post' : '.bloc-message-forum';
        this.class_num_page = this.mobile ? '.num-page' : '.page-active';
        this.class_page_fin = this.mobile ? '.right-elt > a' : '.pagi-fin-actif';
        this.class_date = this.mobile ? '.date-post' : '.bloc-date-msg';
        this.class_contenu = this.mobile ? '.contenu' : '.bloc-contenu';
        this.class_pagination = this.mobile ? '.pagination-b' : '.bloc-pagi-default';
        this.ajouterOptions();

        // Le script ne doit s'activer que sur les pages de forum ou de conversation MP.
        const analysable = (document.URL.match(/\/forums\/\d/) || document.URL.match(/\/messages-prives\//));

        if (analysable && $(this.class_msg).length > 0) {
            console.log('[TopicLive] Script actif sur cette page.');
            this.page = new Page($(document));
            this.formu = new Formulaire();
            this.messages = this.page.obtenirMessages();
            this.nvxMessages = 0;
            this.page.scan();
            this.loop();
        } else {
            console.log('[TopicLive] Script inactif sur cette page.');
        }
    }

    initScrollButton() {
        const buttonCss = ` #topiclive-scroll-button { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 20px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.2); display: none; transition: opacity 0.3s; } #topiclive-scroll-button:hover { background-color: #0056b3; } `;
        $('head').append(`<style>${buttonCss}</style>`);
        this.$scrollButton = $('<button id="topiclive-scroll-button">↓ Nouveaux messages</button>');
        $('body').append(this.$scrollButton);
        this.$scrollButton.on('click', () => {
            this.page.performScroll();
        });

        $(window).on('scroll', () => {
            if (this.unreadMessageAnchors.length === 0) {
                return;
            }
            const viewportBottom = $(window).scrollTop() + $(window).height();
            const messagesJustRead = [];
            for (const $message of this.unreadMessageAnchors) {
                const messageBottom = $message.offset().top + $message.outerHeight();
                if (viewportBottom >= messageBottom) {
                    messagesJustRead.push($message);
                }
            }
            if (messagesJustRead.length > 0) {
                this.unreadMessageAnchors = this.unreadMessageAnchors.filter($anchor => !messagesJustRead.some($read => $read.is($anchor)));
                this.nvxMessages -= messagesJustRead.length;
                this.updateCounters();
            }
        });
    }

    updateCounters() {
        let countText = '';
        if (this.nvxMessages > 0) {
            countText = this.nvxMessages > 99 ? '99+' : `${this.nvxMessages}`;
        }

        if (this.options.optionFavicon.actif) {
            this.favicon.maj(countText);
        }

        if (this.options.optionScrollButton.actif) {
            if (this.nvxMessages > 0) {
                this.showScrollButton(this.nvxMessages);
            } else {
                this.hideScrollButton();
            }
        } else {
            this.hideScrollButton();
        }
    }

    markAllAsRead() {
        this.nvxMessages = 0;
        this.unreadMessageAnchors = [];
        this.updateCounters();
    }

    showScrollButton(count) {
        if (!this.options.optionScrollButton.actif) {
            return;
        }
        const message = count > 1 ? `↓ ${count} Nouveaux messages` : '↓ Nouveau message';
        this.$scrollButton.text(message).fadeIn();
    }

    hideScrollButton() {
        this.$scrollButton.fadeOut();
    }

    addUnreadAnchor($message) {
        this.unreadMessageAnchors.push($message);
    }

    initStatic() {
        this.favicon = new Favicon();
        this.son = new Audio('https://github.com/moyaona/TopicLive_Enhanced/raw/refs/heads/main/notification_sound.mp3');
        this.suivreOnglets();
        this.initScrollButton();
        this.init();
        addEventListener('instantclick:newpage', this.init.bind(this));

        addEventListener('topiclive:optionchanged', (e) => {
            const { id, actif } = e.detail;
            if (id === 'topiclive_favicon' && !actif) {
                this.favicon.maj('');
            }
            if (id === 'topiclive_scrollbutton' && !actif) {
                this.hideScrollButton();
            }
        });

        $("head").append(`
            <style type='text/css'>
                .topiclive-loading:after { content: ' ○' }
                .topiclive-loaded:after { content: ' ●' }
                .menu-user-forum li:has(input[id^="topiclive_"]) {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
            </style>
        `);
        console.log('[TopicLive] Initialisation terminée.');
    }

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
        try {
            modal('erreur', { message });
            console.error(`[TopicLive] ${message}`);
        } catch (err) {
            console.error(`[TopicLive] Alerte : ${message}`);
            alert(message);
        }
    }

    log(message) {
        console.log(`[TopicLive] ${message}`);
    }

    loop() {
        if (typeof this.idanalyse !== 'undefined') window.clearTimeout(this.idanalyse);
        let duree = this.ongletActif ? 5000 : 10000;
        if (this.mobile) duree = 10000;
        this.oldInstance = this.instance;
        this.idanalyse = setTimeout(this.charger.bind(this), duree);
    }

    majUrl(page) {
        // La gestion d'URL est spécifique aux forums.
        if (this.estMP) return;

        const $bouton = page.trouver(this.class_page_fin);
        const numPage = page.trouver(`${this.class_num_page}:first`).text();
        const testUrl = this.url.split('-');
        if ($bouton.length > 0) {
            this.messages = [];
            if ($bouton.prop('tagName') == 'A') {
                this.url = $bouton.attr('href');
            } else {
                this.url = this.jvCake($bouton.attr('class'));
            }
        } else if (testUrl[3] != numPage) {
            this.messages = [];
            testUrl[3] = numPage;
            this.url = testUrl.join('-');
        }
    }

    suivreOnglets() {
        document.addEventListener('visibilitychange', () => {
            this.ongletActif = !document.hidden;
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
                if (this.oldInstance != this.instance) {
                    return;
                }
                blocChargement.removeClass('topiclive-loading');
                blocChargement.addClass('topiclive-loaded');
                cb($(data.substring(data.indexOf('<!DOCTYPE html>'))));
                setTimeout(() => {
                    blocChargement.removeClass('topiclive-loaded');
                }, 100);
                TL.loop();
            },
            error: () => {
                TL.loop();
            }
        });
    }
}


/**
 * =================================================================================
 * POINT D'ENTRÉE DU SCRIPT
 * =================================================================================
 * C'est ici que le script démarre son exécution.
 */

// Condition d'exclusion principale.
// Le script vérifie s'il se trouve sur une page de la section des messages privés.
if (!document.URL.includes('/messages-prives/')) {

    // Si ce n'est PAS une page de messages privés, on lance le script.
    var TL = new TopicLive();
    TL.initStatic();

} else {

    // Si c'est une page de messages privés, on ne fait rien et on l'indique
    // dans la console pour informer l'utilisateur.
    console.log('[TopicLive] Script volontairement désactivé sur la section des Messages Privés.');

}
