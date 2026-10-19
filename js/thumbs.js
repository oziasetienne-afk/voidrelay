/* thumbs.js — vignettes d'objets Warframe (slug -> image locale).
   Depuis la refonte WebP du 16/07/2026, les vignettes vivent en local
   (/assets/objets/<slug>.webp, 96 px, ~3 Ko pièce) : plus besoin de la carte
   wm_thumbs.json (310 Ko) ni d'un hotlink warframe.market — ready() est
   immédiat, plus aucun téléchargement ne bloque le rendu des pages outils.
   API inchangée : ready/url/img/slugify. Un slug sans vignette locale
   retombe sur _unknown.png via onerror (même repli que les pages /o/). */
(function (g) {
  function slugify(n) {
    return String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }
  function url(slug) {
    var s = slugify(slug);
    return s ? "/assets/objets/" + s + ".webp" : null;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function img(slug, cls, alt) {
    var u = url(slug);
    if (!u) return "";
    return '<img class="' + (cls || "wf-vig") + '" loading="lazy" decoding="async" alt="' +
      esc(alt || "") + '" src="' + esc(u) + '" onerror="this.onerror=null;this.src=\'/assets/objets/_unknown.png\'">';
  }
  g.Thumbs = { ready: function () { return Promise.resolve({}); }, url: url, img: img, slugify: slugify };
})(window);
