function Link(url, callback) {
  this.blacklist = ['/sso/'];
  this.callback = callback;
  this.clicked = false;
  this.timeout = -1;
  this.url = url;
  this.xhr = new XMLHttpRequest();

  this.xhr.addEventListener('readystatechange', (function () {
    if (this.xhr.readyState == 4 && this.xhr.status == 200) {
      this.loaded(this.xhr.responseText);
    }
  }).bind(this));
}

Link.prototype.cancel = function() {
  console.log('[TurboJv] Annulation de ' + this.url);
  clearTimeout(this.timeout);
  this.timeout = -1;
};

Link.prototype.canPreload = function() {
  if (this.url.indexOf(window.location.hostname) == -1) return false;
  for (var link of this.blacklist) if (this.url.indexOf(link) != -1) return false;
  return true;
};

Link.prototype.click = function(event) {
  if (!this.canPreload()) return;
  console.log('[TurboJv] Lien clique : ' + this.url);

  this.clicked = true;
  if (typeof this.responseText !== 'undefined') {
    this.callback(this.responseText, this.url);
  }

  // Cancel click event
  event.preventDefault();
  event.stopPropagation();
  return false;
};

Link.prototype.load = function () {
  console.log('[TurboJv] Chargement de ' + this.url);
  this.xhr.open('GET', this.url);
  this.xhr.send();
};

Link.prototype.loaded = function(text) {
  this.responseText = text;
  if (this.clicked) {
    this.callback(text, this.url);
  }
};

Link.prototype.preload = function() {
  if (!this.canPreload()) return;
  this.timeout = setTimeout(this.load.bind(this), 50);
};
