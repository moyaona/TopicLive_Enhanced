function TLOption(nom, id)
{
  this.actif = localStorage[id] == 'true';
  this.nom = nom;
  this.id = id;

  this.injecter();
}

TLOption.prototype.injecter = function()
{
  TL.log('Ajout de l\'option ' + this.nom);

  // Ajout de l'option aux options JVC
  var option = '<li><span class="pull-left">' + this.nom + '</span>';
  option += '<span class="interrupteur-inline ';
  option += (this.actif ? 'actif' : 'pointer') + ' ' + this.id + '" id="';
  option += this.id + '_ON">OUI</span><span class="interrupteur-inline ';
  option += (this.actif ? 'pointer' : 'actif');
  option += ' ' + this.id + '" id="' + this.id + '_OFF">NON</span></li>';
  $('.menu-user-forum').append(option);

  // Register des events lors du toggle de l'option
  $('#' + this.id + '_ON').on('click', (function() {
    localStorage[this.id] = 'true';
    $('#' + this.id + '_ON').attr('class', 'interrupteur-inline actif');
    $('#' + this.id + '_OFF').attr('class', 'interrupteur-inline pointer');
  }).bind(this));
  $('#' + this.id + '_OFF').on('click', (function() {
    localStorage[this.id] = 'false';
    $('#' + this.id + '_ON').attr('class', 'interrupteur-inline pointer');
    $('#' + this.id + '_OFF').attr('class', 'interrupteur-inline actif');
  }).bind(this));
};
