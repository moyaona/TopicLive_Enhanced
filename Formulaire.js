/* exports Formulaire */
/* globals Page, TL */

function Formulaire()
{
	// TL.log('Nouveau formulaire.');
	this.hook();
}

Formulaire.prototype.afficherErreurs = function(msg)
{
	if(typeof msg !== 'undefined') {
		var message_erreur = '';
		for(var i = 0; i < msg.length; i++) {
			message_erreur += msg[i];
			if(i < msg.length) message_erreur += '<br />';
		}
		TL.alert(message_erreur);
	}
};

Formulaire.prototype.envoyer = function(e)
{
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
			success: (function(data) {
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
						TL.log('Redirection du formulaire vers ' + data.redirect_uri);
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
			}).bind(this),
			error: err => TL.alert("Erreur lors de l'envoi du message : " + err)
		});
	}
};

Formulaire.prototype.hook = function()
{
	// Remplacement du bouton de post
	var $form = this.obtenirFormulaire();
	var $bouton = $form.find('.btn-poster-msg');
	$bouton.off();
	$bouton.removeAttr('data-push');
	$bouton.attr('type', 'button');
	$bouton.on('click', this.verifMessage.bind(this));
};

Formulaire.prototype.maj = function($nvform)
{
	TL.log('Mise a jour du formulaire');
	var $form = this.obtenirFormulaire();
	var $cap = this.obtenirCaptcha($form);
	var $ncap = this.obtenirCaptcha($nvform);

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
};

Formulaire.prototype.obtenirCaptcha = function($form)
{
	if(typeof $form === 'undefined') $form = this.obtenirFormulaire();
	return $form.find('.jv-editor').next('div');
};

Formulaire.prototype.obtenirMessage = function($form)
{
	if(typeof $form == 'undefined') $form = this.obtenirFormulaire();
	return $form.find(TL.estMP ? '#message' : '#message_topic');
};

Formulaire.prototype.obtenirFormulaire = function($page)
{
	if(typeof $page === 'undefined') $page = $(document);
	return $page.find(TL.estMP ? '#repondre-mp > form' : '.form-post-message');
};

Formulaire.prototype.verifEnvoi = function(data)
{
	var nvPage = new Page(data);
	var $formu = this.obtenirFormulaire(nvPage.$page);
	this.maj($formu);
	TL.majUrl(nvPage);
	nvPage.scan();
};

Formulaire.prototype.verifMessage = function()
{
	TL.log('Verification du message avant envoi');

	if(TL.estMP) {
		this.envoyer();
	} else {
		$.ajax({
			type: 'POST',
			url: '/forums/ajax_check_poste_message.php',
			data: {
				id_topic: id_topic, /* globals id_topic */
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
};

Formulaire.prototype.trouver = function(chose)
{
	return this.obtenirFormulaire().find(chose);
};
