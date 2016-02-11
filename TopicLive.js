function TopicLive()
{
  this.log('Initialisation.');
  this.debug = true;
  this.instance = 0;
  this.ongletActif = true;
}

TopicLive.prototype.ajouterOptions = function()
{
  // this.log('ajouterOptions()');
  this.options = {
    optionSon: new TLOption('Son TopicLive', 'topiclive_son')
  };
};

TopicLive.prototype.charger = function()
{
  // this.log('TL.charger()');
  if(this.oldInstance == this.instance) {
    $('#bloc-formulaire-forum .titre-bloc').text('Répondre ○');
    $.ajax({
      type: 'GET',
      url: this.url,
      timeout: 5000,
      success: (function(data) {
        if(this.oldInstance == this.instance)
	{
          $('#bloc-formulaire-forum .titre-bloc').text('Répondre ●');
          new Page($(data.substring(data.indexOf('<!DOCTYPE html>')))).scan();
          setTimeout((function() {
            $('#bloc-formulaire-forum .titre-bloc').text('Répondre');
          }).bind(this), 100);
        } else {
	  this.log('Nouvelle instance detectee : arret du chargement');
	}
      }).bind(this),
      error: this.loop.bind(this)
    });
  } else {
    this.log('Nouvelle instance detectee : arret du chargement');
  }
};

// Sera initialise a chaque changement de page
TopicLive.prototype.init = function()
{
  this.log('Reinitialisation');
  if(typeof $ === 'undefined') {
    return this.log('### jQuery introuvable !');
  }

  this.instance++;
  this.ajaxTs = $('#ajax_timestamp_liste_messages').val();
  this.ajaxHash = $('#ajax_hash_liste_messages').val();
  this.estMP = $('.mp-page').length;
  this.url = this.estMP ? document.URL.substring(0, document.URL.indexOf('&')) : document.URL;

  this.ajouterOptions();

  // Si on est sur les forums ou en MP
  if(document.URL.match(/\/forums\//) || document.URL.match(/\/messages-prives\//)) {
    this.log('Il y a des messages dans la page.');
    this.page = new Page($(document));
    this.formu = new Formulaire();
    this.messages = this.page.obtenirMessages();
    this.nvxMessages = 0;
    this.page.scan();
    this.loop();
  } else {
    this.log('TopicLive sera inactif sur cette page');
  }
};

// Ne sera pas initialise a chaque changement de page
TopicLive.prototype.initStatic = function()
{
  this.log('Premiere initialisation');
  this.favicon = new Favicon();
  this.son = new Audio('https://raw.githubusercontent.com/Kiwec/TopicLive/master/notification.ogg');

  this.suivreOnglets();
  this.init();
  addEventListener('instantclick:newpage', this.init.bind(this));
  this.log('Fin de l\'initialisation de TopicLive');
};

// Transforme une classe chiffree par JvCare en un lien
TopicLive.prototype.jvCake = function(classe)
{
  // this.log('jvCake()');
  var base16 = '0A12B34C56D78E9F', lien = '', s = classe.split(' ')[1];
  for (var i = 0; i < s.length; i += 2) {
    lien += String.fromCharCode(base16.indexOf(s.charAt(i)) * 16 + base16.indexOf(s.charAt(i + 1)));
  }
  return lien;
};

TopicLive.prototype.log = function(message)
{
  if(this.debug) {
    console.log('[TopicLive] ' + message);
  }
};

TopicLive.prototype.loop = function()
{
  // this.log('loop()');
  if(typeof this.idanalyse !== 'undefined') window.clearTimeout(this.idanalyse);

  var duree = this.ongletActif ? 5000 : 10000;
  this.oldInstance = this.instance;
  this.idanalyse = setTimeout(this.charger.bind(this), duree);
};

TopicLive.prototype.majUrl = function(page)
{
  // this.log('majUrl()');
  if(this.estMP) return;

  var $bouton = page.trouver('.pagi-fin-actif');
  var numPage = page.trouver('.page-active:first').text();
  var testUrl = this.url.split('-');

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
};

TopicLive.prototype.suivreOnglets = function()
{
  this.log('Suivi des onglets active');

  $(window).bind('focus', (function() {
    if(!this.ongletActif) {
      this.ongletActif = true;
      this.favicon.maj('');
      this.nvxMessages = 0;
    }
  }).bind(this));
  $(window).bind('blur', (function() {
    if(this.ongletActif) {
      this.ongletActif = false;
      this.favicon.maj('');
      this.nvxMessages = 0;
    }
  }).bind(this));
};
