function Formulaire()
{
  TL.log('Nouveau formulaire.');

  this.forcerMaj = false;
}

Formulaire.prototype.envoyer = function(e)
{
  // Si le message est invalide selon JVC
  if(typeof e !== 'undefined' && e.erreurs.length !== 0) {
    var message_erreur = '';
    for(var i = 0; i < e.erreurs.length; i++) {
      message_erreur += e.erreurs[i];
      if(i < e.erreurs.length) message_erreur += '<br />';
    }
    try {
      modal('erreur', { message: message_erreur });
      TL.log('Envoi annule car message invalide : ' + message_erreur);
    } catch(err) { TL.log('### Erreur modal() (formulaire) : ' + err); }
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
        var nvPage = new Page($(data.substring(data.indexOf('<!DOCTYPE html>'))));
        this.forcerMaj = true;

        var $formu = this.obtenirFormulaire(nvPage.$page);
        if($formu.find('.alert-danger').length !== 0) {
          this.maj($formu);
          this.forcerMaj = false;
        }

        TL.majUrl(nvPage);
        nvPage.scan();
      }).bind(this),
      error: function() {
        try { modal('message', { message: 'Erreur lors de l\'envoi du message.' }); }
        catch(err) { TL.log('### Erreur envoi du message : ' + err); }
      }
    });
  }
};

Formulaire.prototype.maj = function($nvform)
{
  // TL.log('Mise a jour du formulaire');
  var $form = this.obtenirFormulaire();
  var $cap = this.obtenirCaptcha($form);
  var $ncap = this.obtenirCaptcha($nvform);

  // Si on doit maj le formulaire
  if(this.forcerMaj || ($cap.length != $ncap.length && $cap.find('#code_captcha').val() === '')) {
    TL.log('Maj data formulaire !');

    // Remplacement hashs formulaire
    this.trouver('input[type="hidden"]').remove();
    $nvform.find('input[type="hidden"]').each(function() {
      TL.log($(this).attr('name') + ':' + $(this).attr('value'));
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
    if(this.forcerMaj) {
      this.obtenirMessage().val(this.obtenirMessage($nvform).val());
    }
  }

  // Remplacement du bouton de post
  $bouton = $form.find('.btn-poster-msg');
  $bouton.off();
  $bouton.removeAttr('data-push');
  $bouton.attr('type', 'button');
  $bouton.on('click', this.verifMessage.bind(this));
};

Formulaire.prototype.obtenirCaptcha = function($form)
{
  if(typeof $form === 'undefined') $form = this.obtenirFormulaire();
  return $form.find(TL.estMP ? '.bloc-cap' : '.captcha-boot-jv').parent();
};

Formulaire.prototype.obtenirMessage = function($form)
{
  if(typeof $form == 'undefined') $form = this.obtenirFormulaire();
  return $form.find(TL.estMP ? '#message' : '#message_topic');
};

Formulaire.prototype.obtenirFormulaire = function($page)
{
  if(typeof $page === 'undefined') $page = $(document);
  return $page.find(TL.estMP ? '.form-post-topic' : '.form-post-message');
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
  return this.obtenirFormulaire().find(chose);
};
