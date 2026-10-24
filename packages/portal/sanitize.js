// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike Portal — HTML Sanitization Utilities
 *
 * Escapes user/API content before inserting into the DOM via innerHTML.
 * Usage:
 *   el.innerHTML = '<div>' + MAPLESPIKE.esc(userContent) + '</div>';
 *   el.innerHTML = MAPLESPIKE.sanitizeHtml(richContent);
 */

window.MAPLESPIKE = window.MAPLESPIKE || {};

/**
 * Escape HTML entities so content renders as text, not markup.
 * Use for ANY value interpolated into an innerHTML template.
 */
MAPLESPIKE.esc = function (str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

/**
 * Sanitize HTML via DOMParser (does NOT execute scripts).
 * Allows only whitelisted formatting/layout tags.
 * Strips event handlers and javascript:/data: URLs.
 */
MAPLESPIKE.sanitizeHtml = function (html) {
  if (!html) return '';
  if (typeof html !== 'string') html = String(html);

  var safeTags = [
    'a', 'b', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td',
    'th', 'thead', 'tr', 'ul',
  ];

  var doc;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch (e) {
    return html.replace(/<[^>]*>/g, '');
  }

  function sanitizeNode(node) {
    if (node.nodeType === 1) {
      var tag = node.tagName.toLowerCase();
      if (safeTags.indexOf(tag) === -1) {
        var parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
        return;
      }

      for (var i = node.attributes.length - 1; i >= 0; i--) {
        var name = node.attributes[i].name.toLowerCase();
        var val = node.attributes[i].value.toLowerCase().trim();
        if (name === 'style' || name === 'class' || name === 'target') continue;
        if (name.indexOf('on') === 0) { node.removeAttribute(node.attributes[i].name); continue; }
        if ((name === 'href' || name === 'src') &&
            (val.indexOf('javascript:') === 0 || val.indexOf('data:') === 0)) {
          node.setAttribute(node.attributes[i].name, '#');
        }
      }
    }
    var children = Array.prototype.slice.call(node.childNodes);
    for (var j = 0; j < children.length; j++) sanitizeNode(children[j]);
  }

  var body = doc.body;
  if (body) {
    var children = Array.prototype.slice.call(body.childNodes);
    for (var k = 0; k < children.length; k++) sanitizeNode(children[k]);
    return body.innerHTML;
  }
  return doc.documentElement ? doc.documentElement.textContent : '';
};
