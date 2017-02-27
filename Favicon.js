// Code de Spawnkill
function Favicon()
{
  try {
    this.init();
  } catch(err) {
    TL.log('### Erreur init favicon : ' + err);
  }
}

Favicon.prototype.clear = function()
{
  this.context.clearRect(0, 0, this.canv.width, this.canv.height);
  this.context.drawImage(this.image, 0, 0);
};

Favicon.prototype.init = function()
{
  TL.log('Initialisation du Favicon');
  this.canv = $('<canvas>').get(0);
  this.canv.width = 16;
  this.canv.height = 16;
  this.context = this.canv.getContext('2d');
  this.image = new Image();
  this.image.src = '/favicon.ico';

  try { this.maj(''); }
  catch(err) { TL.log('### Erreur favicon (init) : ' + err); }
};

Favicon.prototype.maj = function(txt)
{
  this.clear();

  if(txt !== '')
  {
    this.context.fillStyle = 'red';
    this.context.fillRect(0, 0, this.context.measureText(txt).width + 3, 11);
    this.context.fillStyle = 'white';
    this.context.font = 'bold 10px Verdana';
    this.context.textBaseline = 'bottom';
    this.context.fillText(txt, 1, 11);
  }

  this.replace();
};

Favicon.prototype.replace = function()
{
  if(typeof this.lien !== 'undefined') this.lien.remove();
  this.lien = $('<link>', {
    href: this.canv.toDataURL('image/png'),
    rel: 'shortcut icon',
    type: 'image/png'
  });
  $('head').append(this.lien);
};
