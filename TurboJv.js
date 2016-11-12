function TurboJv() {
  this.log('Demarrage de TurboJv');

  this.jvCake = new JvCake();

  this.update(document.querySelector('#content'));
}

TurboJv.prototype.log = function(msg) {
  console.log('[TurboJv] ' + msg);
};

TurboJv.prototype.parse = function(raw) {
  var el = document.createElement('html');
  el.innerHTML = raw;
  return el;
};

TurboJv.prototype.switchTo = function(page, newUrl) {
  this.log('Changement de page : ' + newUrl);
  page = this.parse(page);

  var oldContent = document.querySelector('.container').parentNode;
  var newContent = page.querySelector('.container').parentNode;
  oldContent.innerHTML = newContent.innerHTML;

  this.jvCake.Transformation(oldContent);
  this.update(oldContent);
  if (newUrl.indexOf('#') == -1) window.scrollTo(0, 0);
  document.title = page.querySelector('title').innerHTML;

  this.log('Changement URL');
  window.history.pushState({ path: newUrl }, '', newUrl);

  this.log('Dispatch Event');
  var ev = new CustomEvent('instantclick:newpage', {detail:{isTurboJv:true}});
  document.dispatchEvent(ev);

  this.log('Changement de page termine');
};

TurboJv.prototype.update = function(page) {
  this.log('Enregistrement des liens');
  for (var a of page.querySelectorAll('a')) {
    if(!a.href) return;
    var L = new Link(a.href, this.switchTo.bind(this));
    a.addEventListener('click', L.click.bind(L));
    a.addEventListener('mouseleave', L.cancel.bind(L));
    a.addEventListener('mouseenter', L.preload.bind(L));
  }
};
