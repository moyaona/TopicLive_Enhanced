// ==UserScript==
// @name          TopicLive_Enhanced
// @description   Charge les nouveaux messages d'un topic JVC en direct.
// @author        kiwec, moyaona, lantea
// @match         https://www.jeuxvideo.com/*
// @match         https://m.jeuxvideo.com/*
// @downloadURL https://github.com/moyaona/TopicLive_Enhanced/raw/main/TopicLive_Enhanced.user.js
// @updateURL https://github.com/moyaona/TopicLive_Enhanced/raw/main/TopicLive_Enhanced.user.js
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
        if (TL.mobile) {
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

    // Récupère l'URL de l'avatar pour l'afficher.
    fixAvatar() {
        let avatar = this.trouver('.user-avatar-msg');
        avatar.attr('src', avatar.data('src'));
    }

    // Ré-attache la fonctionnalité de "blacklistage" au bouton correspondant.
    fixBlacklist() {
        this.trouver('.bloc-options-msg > .picto-msg-tronche, .msg-pseudo-blacklist .btn-blacklist-cancel').on('click', function() {
            // ... (code AJAX pour blacklister) ...
        });
    }

    // Ré-attache la fonctionnalité de citation au bouton correspondant.
    fixCitation() {
        this.$message.find('.bloc-options-msg .picto-msg-quote').on('click', () => {
            $.ajax({
                type: 'POST',
                url: '/forums/ajax_citation.php',
                // ... (données de la requête) ...
                success: ({ txt }) => {
                    const $msg = TL.formu.obtenirMessage();
                    let nvmsg = `> Le ${this.date} ${this.pseudo} a écrit :\n>`;
                    nvmsg += `${txt.split('\n').join('\n> ')}\n\n`;
                    // ... (insertion du texte dans le formulaire) ...
                },
                error: this.fixCitation.bind(this)
            });
        });
    }

    // Ré-attache la fonctionnalité pour déplier les longues citations.
    fixDeroulerCitation() {
        this.trouver('blockquote').click(function() {
            $(this).attr('data-visible', '1');
        });
    }

    // Correction spécifique à la version mobile pour afficher les messages en entier.
    fixMobile() {
        this.trouver('.message').addClass('show-all');
    }

    // Raccourci pour trouver un élément à l'intérieur de ce message.
    trouver(chose) {
        return this.$message.find(chose);
    }

    // Met à jour le contenu d'un message s'il a été édité.
    update(nvMessage) {
        if (this.edition == nvMessage.edition) return; // Pas de changement.

        this.edition = nvMessage.edition;
        this.trouver(TL.class_contenu).html(nvMessage.trouver(TL.class_contenu).html());

        // Déclenche un événement pour signaler l'édition.
        dispatchEvent(new CustomEvent('topiclive:edition', {
            'detail': { id: this.id_message, jvcake: TL.jvCake }
        }));

        // Fait flasher le message pour signaler visuellement la mise à jour.
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

    // Affiche les erreurs retournées par JVC.
    afficherErreurs(msg) {
        // ... (logique d'affichage des erreurs) ...
    }

    // Envoie le formulaire via AJAX.
    envoyer(e) {
        // ... (logique d'envoi du formulaire via AJAX) ...
    }

    // "Hook" (s'accroche) au formulaire pour remplacer son comportement par défaut.
    hook() {
        const $form = this.obtenirFormulaire();
        const $bouton = $form.find('.btn-poster-msg');
        $bouton.off(); // Retire les écouteurs d'événements de JVC.
        $bouton.removeAttr('data-push');
        $bouton.attr('type', 'button'); // Empêche l'envoi classique.
        $bouton.on('click', this.verifMessage.bind(this)); // Attache notre propre logique.
    }

    // Met à jour le formulaire avec les nouvelles informations (captcha, tokens).
    maj($nvform) {
        // ... (logique de mise à jour des champs cachés et du captcha) ...
        this.hook(); // Ré-attache notre hook après la mise à jour.
    }

    // Raccourci pour obtenir le captcha.
    obtenirCaptcha($form) {
        // ...
    }

    // Raccourci pour obtenir le champ de texte du message.
    obtenirMessage($form) {
        if (typeof $form == 'undefined') $form = this.obtenirFormulaire();
        return $form.find('#message_topic');
    }

    // Raccourci pour obtenir l'élément du formulaire.
    obtenirFormulaire($page) {
        if (typeof $page === 'undefined') $page = $(document);
        return $page.find('#forums-post-message-editor');
    }

    // Vérifie que le message est valide avant de l'envoyer.
    verifMessage() {
        $.ajax({
            type: 'POST',
            url: '/forums/ajax_check_poste_message.php',
            // ... (données de vérification) ...
            success: this.envoyer.bind(this),
            error: this.verifMessage.bind(this)
        });
        return false;
    }

    // ... (Autres méthodes de la classe Formulaire) ...
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

    // Efface le canvas.
    clear() {
        this.context.clearRect(0, 0, this.canv.width, this.canv.height);
        if (this.imageLoaded) {
            this.context.drawImage(this.image, 0, 0);
        }
    }

    // Met à jour le favicon avec le texte du compteur.
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

    // Remplace le favicon existant de la page par notre version sur canvas.
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

    // Ajoute les options personnalisables au menu de JVC.
    ajouterOptions() {
        if (this.mobile) return;
        this.options = {
            optionSon: new TLOption('Son', 'topiclive_son'),
            optionFavicon: new TLOption('Compteur Favicon', 'topiclive_favicon'),
            optionScrollButton: new TLOption('Bouton "Nouveaux messages"', 'topiclive_scrollbutton')
        };
    }

    // Charge les nouvelles données de la page.
    charger() {
        if (this.oldInstance != this.instance) return;
        TL.GET(data => { new Page(data).scan(); });
    }

    // Initialise le script pour la page courante.
    init() {
        if (typeof $ === 'undefined') return;
        this.instance++;
        this.ajaxTs = $('#ajax_timestamp_liste_messages').val();
        this.ajaxHash = $('#ajax_hash_liste_messages').val();
        this.url = document.URL;
        this.mobile = document.URL.includes('//m.jeuxvideo.com');
        this.class_msg = this.mobile ? '.post' : '.bloc-message-forum';
        // ... (définition des autres classes CSS) ...
        this.ajouterOptions();

        const analysable = document.URL.match(/\/forums\/\d/);
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

    // Initialise le bouton de scroll vers les nouveaux messages.
    initScrollButton() {
        // ... (injection du CSS et de l'élément bouton) ...
    }

    // Met à jour les compteurs (favicon, bouton de scroll).
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

    // Initialise les composants statiques et globaux du script (une seule fois).
    initStatic() {
        this.favicon = new Favicon();
        this.son = new Audio('https://github.com/moyaona/TopicLive_Enhanced/raw/refs/heads/main/notification.ogg');
        this.suivreOnglets();
        this.initScrollButton();
        this.init();

        // Écoute les changements d'options pour réagir instantanément.
        addEventListener('topiclive:optionchanged', (e) => {
            const { id, actif } = e.detail;
            if (id === 'topiclive_favicon' && !actif) this.favicon.maj('');
            if (id === 'topiclive_scrollbutton' && !actif) this.hideScrollButton();
        });

        // Écoute l'événement de JVC pour se ré-initialiser lors d'une navigation "instantanée".
        addEventListener('instantclick:newpage', this.init.bind(this));

        // Injecte les styles CSS nécessaires au fonctionnement visuel.
        $("head").append(`
            <style type='text/css'>
                /* ... (styles pour l'indicateur de chargement et l'alignement des options) ... */
            </style>
        `);

        console.log('[TopicLive] Initialisation terminée.');
    }

    // Décode les liens "JvCare".
    jvCake(classe) {
        // ... (logique de décodage) ...
    }

    // Gère la boucle de rafraîchissement automatique.
    loop() {
        if (typeof this.idanalyse !== 'undefined') window.clearTimeout(this.idanalyse);
        let duree = this.ongletActif ? 5000 : 10000;
        if (this.mobile) duree = 10000;
        this.oldInstance = this.instance;
        this.idanalyse = setTimeout(this.charger.bind(this), duree);
    }

    // Détecte si l'onglet du navigateur est actif ou en arrière-plan.
    suivreOnglets() {
        document.addEventListener('visibilitychange', () => {
            this.ongletActif = !document.hidden;
        });
    }

    // Fonction utilitaire pour effectuer une requête GET.
    GET(cb) {
        // ... (logique de la requête AJAX avec indicateur de chargement) ...
    }

    // ... (Autres méthodes de la classe TopicLive) ...
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
