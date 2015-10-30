function Formulaire()
{
  TL.log('Nouveau formulaire.');

  this.forcerMaj = false;
}

Formulaire.prototype.envoyer = function()
{
  TL.log('formu.envoyer()');

  // Si le message est invalide selon JVC
  if(typeof e !== 'undefined' && e.erreurs.length !== 0) {
    var message_erreur = '';
    for(var i = 0; i < e.erreurs.length; i++) {
      message_erreur += e.erreurs[i];
      if(i < e.erreurs.length) message_erreur += '<br />';
    }
    try {
      modal('erreur', { message: message_erreur });
    } catch(err) {
      TL.log('Erreur lors de l\'envoi du message : ' + err);
    }
  } else {
    TL.log('Envoi du message...');
    this.trouver('.btn-poster-msg').attr('disabled', 'disabled');
    this.trouver('.conteneur-editor').fadeOut();
    $.ajax({
      type: 'POST',
      url: TL.url,
      data: this.obtenirFormulaire().serializeArray(),
      timeout: 5000,
      success: (function(data) {
        TL.log('Page de retour recue avec succes.');
        var nvPage = new Page($(data.substring(data.indexOf('<!DOCTYPE html>'))));
        this.forcerMaj = true;
        nvPage.scan();
      }).bind(this),
      error: function() {
        try {
          modal('message', {message:'Erreur lors de l\'envoi du message.'});
        } catch(err) {
          TL.log('Erreur lors de l\'envoi du message');
          console.log(err);
        }
      }
    });
  }
};

Formulaire.prototype.maj = function($nvform)
{
  TL.log('formulaire.maj()');
  var $form = this.obtenirFormulaire();
  var $cap = this.obtenirCaptcha($form);
  var $ncap = this.obtenirCaptcha($nvform);

  if(this.forcerMaj || ($cap.length != $ncap.length && $cap.find('#code_captcha').val() === '')) {
    TL.log('Maj data formulaire !');
    this.trouver('input[type="hidden"]').remove();
    $nvform.find('input[type="hidden"]').each(function() {
      TL.log($(this).attr('name') + ':' + $(this).attr('value'));
      $form.append($(this));
    });
    this.trouver('.btn-poster-msg').removeAttr('disabled');
    this.trouver('.conteneur-editor').fadeIn();
    $cap.remove(); // suppression du captcha
    this.trouver('.jv-editor').after($ncap); // remplacement du captcha

    if(this.forcerMaj) {
      this.obtenirMessage().val(this.obtenirMessage($nvform).val());
    }
  }

  $form.off('submit');
  $form.on('submit', this.verifMessage.bind(this));
  TL.log('formulaire.maj() : done');
};

Formulaire.prototype.obtenirCaptcha = function($form)
{
  TL.log('formulaire.obtenirCaptcha()');
  if(typeof $form === 'undefined') $form = this.obtenirFormulaire();
  return $form.find(TL.estMP ? '.bloc-cap' : '.captcha-boot-jv').parent();
};

Formulaire.prototype.obtenirMessage = function($form)
{
  TL.log('formulaire.obtenirMessage()');
  if(typeof $form == 'undefined') $form = this.obtenirFormulaire();
  return $form.find(TL.estMP ? '#message' : '#message_topic');
};

Formulaire.prototype.obtenirFormulaire = function($page)
{
  TL.log('formulaire.obtenirFormulaire()');
  if(typeof $page === 'undefined') $page = $(document);
  return $page.find(TL.estMP ? '.form-post-topic' : '.form-post-message');
};

Formulaire.prototype.verifMessage = function()
{
  TL.log('formulaire.verifEnvoi()');

  if(TL.estMP) {
    this.envoyer();
  } else {
    $.ajax({
      type: 'POST',
      url: '/forums/ajax_check_poste_message.php',
      data: {
        id_topic: id_topic, // global
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
  TL.log('formu.trouver : ' + chose);
  return this.obtenirFormulaire().find(chose);
};
