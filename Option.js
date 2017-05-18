function TLOption(nom, id)
{
  this.actif = localStorage[id] == 'true';
  this.nom = nom;
  this.id = id;

  this.injecter();
}

TLOption.prototype.injecter = function()
{
  TL.log("Ajout de l'option '" + this.nom + "'");

  // Ajout de l'option aux options JVC
  var option = '<li><span class="pull-left">TopicLive - ' + this.nom + '</span>';
  option += '<input type="checkbox" class="input-on-off" id="' + this.id + '" ';
  option += this.actif ? 'checked>' : '>';
  option += '<label for="' + this.id + '" class="btn-on-off"></label></li>';
  $('.menu-user-forum').append(option);

  // Register des events lors du toggle de l'option
  this.bouton = $('#' + this.id);
  this.bouton.change((function() {
    this.actif = !this.actif;
    localStorage[this.id] = this.actif;
  }).bind(this));
};
