/* VoidRelay — interrupteur publicité (Google AdSense, Auto ads).
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  POUR ACTIVER LA PUB : colle ton ID AdSense ci-dessous (CLIENT),         │
 * │  ex : "ca-pub-1234567890123456", puis redéploie. C'est tout.             │
 * │  Tant que CLIENT est vide → aucune pub, aucun appel réseau (no-op).      │
 * │  Auto ads : Google place les annonces automatiquement (rien d'autre à    │
 * │  faire). Pense aussi à remplir ads.txt (à la racine) avec le même ID.    │
 * └────────────────────────────────────────────────────────────────────────┘
 */
(function () {
  var CLIENT = ""; // <= colle ici "ca-pub-XXXXXXXXXXXXXXXX"
  if (!/^ca-pub-\d{16}$/.test(CLIENT)) return; // désactivé tant que non configuré
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + CLIENT;
  s.crossOrigin = "anonymous";
  (document.head || document.documentElement).appendChild(s);
})();
