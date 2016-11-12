function JvCake() {}

// Code de jeuxvideo.com
JvCake.prototype.Transformation = function(elem) {
  console.log('[TurboJv] Transformation');
  try {
      for (var t, n, i, a, r, s, c, l, d, u, f, m, h, p = document.querySelectorAll(".JvCare"), v = p.length, g = "0A12B34C56D78E9F", _ = ["charset", "name", "rel", "rev", "target", "accesskey", "id", "style", "tabindex", "title"], b = ["blur", "click", "dblclick", "focus", "mousedown", "mousemove", "mouseover", "mouseup", "keydown", "keyppress", "keyup"], y = "", w = null, j = 0, k = v; k--;)
          if (n = p[k], l = n.className, c = l.indexOf(" "), j = l.indexOf(" ", c + 1), -1 === j && (j = l.length), /[0A12B34C56D78E9F]+/.test(l.substr(c + 1, j - c - 1))) {
              if (y = "", c > 0)
                  for (t = l.substr(c + 1, j - c - 1), s = 0; s < t.length; s += 2) a = g.indexOf(t.charAt(s)), r = g.indexOf(t.charAt(s + 1)), y += String.fromCharCode(16 * a + r);
              for (i = "xXx " + l.substr(j + 1, l.length - j - 1), w = document.createElement("a"), w.href = y, s = _.length; s--;) try {
                  c = _[s], j = n.getAttribute(c), j && (w[c] = j)
              } catch (x) {}
              for (d = 0, u = n.attributes, f = u.length; f > d; d++)
                  if ("data-" === u[d].nodeName.substring(0, 5)) try {
                      w.setAttribute(u[d].nodeName, u[d].nodeValue)
                  } catch (x) {}
                  for (s = b.length; s--;) try {
                      c = b[s], j = n["on" + c], j && (w.addEventListener ? w.addEventListener(c, j, !1) : w.attachEvent && w.attachEvent("on" + c, j))
                  } catch (x) {}
                  for (w.className = i, h = document.createDocumentFragment(), h.appendChild(w), d = 0, m = n.childNodes.length; m > d; d++) w.appendChild(n.childNodes[d].cloneNode(!0));
              n.parentNode.replaceChild(w, n)
          }
  } catch (x) {
    console.log('Erreur JvCake : ' + x);
  }
};
