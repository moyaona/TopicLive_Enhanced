// Code de Spawnkill
function Favicon()
{
  // TL.log('new favicon');
  try {
    this.canvas = $('<canvas>').get(0);
    this.canvas.width = 16;
    this.canvas.height = 16;
    this.image = new Image();
    this.image.src = '/favicon.ico';
    this.lien = null;

    this.maj('');
  } catch(err) {
    console.log(err);
  }
}

Favicon.prototype.maj = function(txt)
{
  // TL.log('favicon.maj : ' + txt);
  var ctx = this.canvas.getContext('2d');
  var textWidth = ctx.measureText(txt).width;
  ctx.drawImage(this.image, 0, 0);

  if(txt !== '')
  {
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, textWidth + 3, 11);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px Verdana';
    ctx.textBaseline = 'bottom';
    ctx.fillText(txt, 1, 11);
  }

  var newFavicon = this.canvas.toDataURL('image/png');

  if(this.lien !== null) this.lien.remove();

  this.lien = $('<link>', {
    href: newFavicon,
    rel: 'shortcut icon',
    type: 'image/png'
  });

  $('head').append(this.lien);
};
