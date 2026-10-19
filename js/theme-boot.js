/* VoidRelay — amorce de thème pour /warframe (16/07/2026).
   Le reste du site pose data-theme sur <html> via un script inline en tête de page ;
   la CSP de warframe.html interdit l'inline (script-src 'self'), d'où ce fichier,
   chargé SANS defer tout en haut pour éviter un flash de header clair.
   Migration : l'app utilisait sa propre clé "theme" ("light"/"dark") — si vr-theme
   n'existe pas encore, on la reprend pour que le choix de l'utilisateur suive. */
(function () {
  try {
    var t = localStorage.getItem("vr-theme");
    if (!t) {
      t = localStorage.getItem("theme") === "light" ? "light" : "dark";
      localStorage.setItem("vr-theme", t);
    }
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
