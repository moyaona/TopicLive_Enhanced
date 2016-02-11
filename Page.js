function Page($page)
{
  TL.log('Nouvelle page.');
  this.$page = $page;
}

Page.prototype.obtenirMessages = function()
{
  // TL.log('page.obtenirMessages()');
  var msgs = [];
  this.trouver('.bloc-message-forum:not(.msg-pseudo-blacklist)').each(function() {
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

  TL.log('Envoi de topiclive:doneprocessing');
  dispatchEvent(new CustomEvent('topiclive:doneprocessing', {
    'detail': { jvcake: TL.jvCake }
  }));
};

Page.prototype.scan = function()
{
  TL.log('Scan de la page');
  TL.ajaxTs = this.trouver('#ajax_timestamp_liste_messages').val();
  TL.ajaxHash = this.trouver('#ajax_hash_liste_messages').val();

  // Maj du nombre de connectes
  $('.nb-connect-fofo').text(this.trouver('.nb-connect-fofo').text());

  if($('.conteneur-message').length === 0 || $('.pagi-fin-actif').length !== 0) {
    TL.log('Pas sur une derniere page : loop');
    TL.majUrl(this);
    TL.loop();
    return;
  }

  TL.formu.maj(TL.formu.obtenirFormulaire(this.$page).clone());
  var maj = false;

  // Liste de messages
  var nvMsgs = this.obtenirMessages();
  var anciensMsgs = TL.messages;

  TL.log('Verification des messages supprimes');
  try {
  if(!TL.estMP) {
    for(var i in anciensMsgs) {
      if(!anciensMsgs.hasOwnProperty(i)) continue; // fix chrome
      var supprimer = true;
      for(var j in nvMsgs) {
        if(!nvMsgs.hasOwnProperty(j)) continue; // fix chrome
        if(anciensMsgs[i].id_message == nvMsgs[j].id_message) {
          supprimer = false;
          break;
        }
      }
      if(supprimer) TL.messages[i].supprimer();
    }
  }
  } catch(err) { TL.log('### Erreur messages supprimes : ' + err); }

  TL.log('Verification des nouveaux messages et editions');
  try {
  for(var k in nvMsgs) {
    if(!nvMsgs.hasOwnProperty(k)) continue; // fix chrome
    var nv = true;
    for(var l in anciensMsgs) {
      if(!anciensMsgs.hasOwnProperty(l)) continue; // fix chrome
      if(TL.estMP) {
        if(anciensMsgs[l].trouver('.bloc-spoil-jv').length !== 0) {
	      var ancienneDate = anciensMsgs[l].trouver('.bloc-date-msg').text();
        var nouvelleDate = nvMsgs[k].trouver('.bloc-date-msg').text();
        if(ancienneDate == nouvelleDate) {
            nv = false;
            break;
          }
        } else if(anciensMsgs[l].$message.text() == nvMsgs[k].$message.text()) {
          nv = false;
          break;
        }
      } else {
        if(anciensMsgs[l].id_message == nvMsgs[k].id_message) {
          nv = false;
          anciensMsgs[l].update(nvMsgs[k]);
          break;
        }
      }
    }
    if(nv) {
      TL.log('Nouveau message !');
      TL.messages.push(nvMsgs[k]);
      TL.nvxMessages++;
      nvMsgs[k].afficher();
      maj = true;
    }
  }
  } catch(err) { TL.log('Erreur nouveaux messages : ' + err); }

  // Doit etre avant TL.charger()
  TL.majUrl(this);

  if(maj) {
    this.maj();
    TL.formu.forcerMaj = false;
  } else {
    TL.log('Aucun nouveau message.');
    if(TL.formu.forcerMaj) setTimeout(TL.charger.bind(TL), 1000);
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
}

Page.prototype.trouver = function(chose)
{
  // TL.log('Page.trouver : ' + chose);
  return this.$page.find(chose);
};
