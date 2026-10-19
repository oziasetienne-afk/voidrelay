/* VoidRelay — warp.js (16/07/2026) : navigation instantanée, 100% progressive.
   Au survol (ou au premier toucher) d'un lien interne, la page cible est préchargée
   pour que le clic paraisse immédiat :
   - Chromium avec Speculation Rules (quand la CSP de la page autorise les scripts
     inline) : PRERENDER complet — la cible est déjà rendue au moment du clic.
   - Sinon : <link rel="prefetch"> (même origine, couvert par default-src 'self' —
     aucun bruit console sur les pages à CSP stricte, contrairement à un script
     speculationrules injecté qui y serait bloqué).
   Garde-fous : Save-Data et connexions 2g respectés (rien n'est préchargé),
   intention de survol 65 ms (pas de rafale en traversant un menu), un seul
   préchargement par URL, plafond par page. Tout est same-origin : le coût est
   celui d'une page statique Cloudflare, jamais un appel API. */
(function () {
  "use strict";
  var conn = navigator.connection || {};
  if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return;

  var seen = Object.create(null);
  var count = 0, MAX = 48;
  var PRERENDER_MAX = 3, prerendered = 0;

  // Speculation Rules seulement si le navigateur les gère ET que la CSP de la page
  // autorise les scripts inline (le JSON injecté est un script inline au sens CSP ;
  // sur les coques outils à CSP stricte, l'injection serait bloquée avec une erreur
  // console — on lit donc la politique déclarée dans le <meta> de la page).
  var canSpeculate = (function () {
    try {
      if (!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules"))) return false;
      var meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (!meta) return true; // pas de CSP déclarée : l'injection passe
      var csp = meta.getAttribute("content") || "";
      var m = /(?:^|;)\s*script-src\s([^;]*)/.exec(csp) || /(?:^|;)\s*default-src\s([^;]*)/.exec(csp);
      if (!m) return true;
      return m[1].indexOf("'unsafe-inline'") !== -1;
    } catch (e) { return false; }
  })();

  var SKIP_EXT = /\.(png|jpe?g|webp|gif|svg|ico|xml|json|txt|zip|pdf|webmanifest)([?#]|$)/i;

  function urlFor(a) {
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return null;
    if (a.hasAttribute("download") || a.hasAttribute("data-no-warp")) return null;
    var u;
    try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin) return null;
    if (u.pathname === location.pathname && u.search === location.search) return null;
    if (SKIP_EXT.test(u.pathname)) return null;
    return u.pathname + u.search;
  }

  function speculate(url) {
    var s = document.createElement("script");
    s.type = "speculationrules";
    s.textContent = JSON.stringify({ prerender: [{ urls: [url] }] });
    document.head.appendChild(s);
  }
  function prefetch(url) {
    var l = document.createElement("link");
    l.rel = "prefetch";
    l.href = url;
    l.as = "document";
    document.head.appendChild(l);
  }
  function warm(a) {
    if (count >= MAX) return;
    var url = urlFor(a);
    if (!url || seen[url]) return;
    seen[url] = 1; count++;
    if (canSpeculate && prerendered < PRERENDER_MAX) { prerendered++; speculate(url); }
    else prefetch(url);
  }

  // Intention de survol : 65 ms (le temps de « passer au travers » d'un lien sans
  // intention est plus court ; les préchargements parasites disparaissent).
  var timer = null, pending = null;
  document.addEventListener("mouseover", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a || a === pending) return;
    clearTimeout(timer);
    pending = a;
    timer = setTimeout(function () { warm(a); pending = null; }, 65);
  }, { passive: true });
  document.addEventListener("mouseout", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a && a === pending) { clearTimeout(timer); pending = null; }
  }, { passive: true });
  // Tactile : précharger dès le premier contact (le doigt annonce le clic ~90 ms avant).
  document.addEventListener("touchstart", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a) warm(a);
  }, { passive: true });
})();

/* ---- Module LANGUE (17/07/2026) — chargé partout via warp.js -------------
   1) Bouton de langue visible dans l'en-tête de TOUTES les pages : la jumelle
      est lue dans <link rel="alternate" hreflang> (déjà posé par les pages
      bilingues) ; sans jumelle, le bouton mène à l'accueil de l'autre langue.
   2) Redirection automatique À L'ENTRÉE du site (referrer vide ou externe
      uniquement — jamais pendant la navigation interne, jamais pour les
      robots) : préférence mémorisée (vr-lang), sinon langue du navigateur.
      Cliquer un lien/bouton hreflang met à jour la préférence — le choix
      humain gagne toujours sur la détection. */
(function () {
  "use strict";
  var LK = "vr-lang";
  var pageLang = (document.documentElement.lang || "fr").slice(0, 2);
  function autreLang() { return pageLang === "fr" ? "en" : "fr"; }
  function litPref() { try { return localStorage.getItem(LK); } catch (e) { return null; } }
  function garde(l) { try { localStorage.setItem(LK, l); } catch (e) {} }
  function altPour(lang) {
    var l = document.querySelector('link[rel="alternate"][hreflang="' + lang + '"]');
    if (!l) return null;
    // les alternates pointent toujours vers NOTRE site : on garde le chemin
    // (fonctionne à l'identique en prod et en local, et reste same-origin).
    try { return new URL(l.getAttribute("href"), location.href).pathname; } catch (e) { return null; }
  }

  // Tout clic vers l'autre langue (lien hreflang ou bouton injecté) = choix explicite.
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[hreflang]");
    if (a) garde((a.getAttribute("hreflang") || "").slice(0, 2) || autreLang());
  }, true);

  // 1) Bouton visible, à côté du bouton de thème (topbar ET pages objets vrtop).
  var theme = document.getElementById("themebtn");
  if (theme && !document.querySelector(".langbtn")) {
    var cibleUrl = altPour(autreLang()) || (pageLang === "fr" ? "/en/" : "/");
    var b = document.createElement("a");
    b.className = "langbtn";
    b.href = cibleUrl;
    b.setAttribute("hreflang", autreLang());
    b.title = pageLang === "fr" ? "Switch to English" : "Passer en français";
    b.setAttribute("aria-label", b.title);
    b.textContent = pageLang === "fr" ? "EN" : "FR";
    b.style.cssText = "display:inline-flex;align-items:center;justify-content:center;" +
      "min-width:34px;height:30px;padding:0 7px;margin-right:6px;border-radius:8px;" +
      "border:1px solid var(--line,#26314a);color:var(--gold-2,#e8c95c);background:none;" +
      "font:700 .72rem/1 Oswald,Inter,sans-serif;letter-spacing:.08em;text-decoration:none";
    theme.parentNode.insertBefore(b, theme);
  }

  // 2) Redirection d'entrée (une fois par arrivée externe, humains seulement).
  if (navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent)) return;
  var ref = document.referrer;
  var entree = !ref || (function () { try { return new URL(ref).host !== location.host; } catch (e) { return true; } })();
  if (!entree) return;
  var pref = litPref();
  if (!pref) {
    pref = /^fr/i.test(navigator.language || "") ? "fr" : "en";
    garde(pref);
  }
  if (pref === pageLang) return;
  var jumelle = altPour(pref);
  if (!jumelle || jumelle === location.pathname) return; // pas d'équivalent : on reste
  location.replace(jumelle + location.search + location.hash);
})();

/* Service worker PARTOUT (17/07/2026) : il ne s'enregistrait que sur l'accueil —
   un visiteur arrivé directement sur /arsenal (ou toute page profonde) n'avait
   jamais de mode hors-ligne. warp.js est chargé sur tout le site : on
   enregistre ici, une fois, sans bloquer (register est idempotent). */
(function () {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
})();

/* ==== AMBIANCE 3D/4D GLOBALE (17/07/2026, demande de l'admin : « riche et moderne
   partout ») — chargé sur TOUT le site via warp.js. Trois effets, tous coupés
   par prefers-reduced-motion, Save-Data et les écrans tactiles :
   1) tilt 3D des cartes au survol (pointeur fin seulement) ;
   2) apparition en fondu-remontée au défilement (opacity/transform : zéro CLS) ;
   3) la feuille de style pose le fond étoilé + l'aurore (CSS pur). */
(function () {
  var reduit = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var eco = navigator.connection && navigator.connection.saveData;
  if (reduit || eco) return;

  // --- 2) apparitions au défilement (toutes surfaces) ---
  var CIBLES_IN = ".scard,.panel,.modc,.card,.vp-tier,.modslot,.wc,.btier,.ars-vit";
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("amb-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    var arme = function () {
      document.querySelectorAll(CIBLES_IN).forEach(function (el) {
        if (!el.classList.contains("amb-obs")) { el.classList.add("amb-obs"); io.observe(el); }
      });
    };
    arme();
    // contenus injectés après coup (catalogues, marché…)
    var mo = new MutationObserver(function () { clearTimeout(mo._t); mo._t = setTimeout(arme, 300); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // --- 1) tilt 3D des cartes (souris uniquement) ---
  if (!(window.matchMedia && matchMedia("(pointer:fine)").matches)) return;
  var CIBLES_TILT = ".scard,.modc,.card,.modslot,.wc,.ars-vit";
  var carte = null, pend = null;
  document.addEventListener("pointermove", function (e) {
    var c = e.target && e.target.closest ? e.target.closest(CIBLES_TILT) : null;
    if (c && c.closest("#arsenal")) c = null; // l'arsenal a déjà son tilt
    if (c !== carte) {
      if (carte) { carte.style.removeProperty("--ambRx"); carte.style.removeProperty("--ambRy"); carte.classList.remove("amb-tilt"); }
      carte = c;
      if (carte) carte.classList.add("amb-tilt");
    }
    if (!carte || pend) return;
    pend = requestAnimationFrame(function () {
      pend = null;
      if (!carte) return;
      var r = carte.getBoundingClientRect();
      if (!r.width) return;
      carte.style.setProperty("--ambRy", (((e.clientX - r.left) / r.width - 0.5) * 5).toFixed(2) + "deg");
      carte.style.setProperty("--ambRx", ((0.5 - (e.clientY - r.top) / r.height) * 5).toFixed(2) + "deg");
    });
  }, { passive: true });
})();

/* Mesure de l'engagement (26/09/2026) — voir functions/api/evt.js.
   Cloudflare Web Analytics compte déjà les pages vues ; ici on compte ce que les
   visiteurs FONT : partir vers warframe.market (la conversion d'un site de
   trading), ouvrir un résultat de recherche, mettre en favori, comparer, copier
   un nom, partager, changer de langue. Un compteur par jour, rien d'autre : ni
   cookie, ni identifiant, ni IP — il est impossible de suivre une personne.
   Bloc INDÉPENDANT du reste de ce fichier : warp.js s'arrête tôt en Save-Data ou
   sans souris, et la mesure doit tourner partout. N'envoie QUE depuis voidrelay.fr :
   ni les tests locaux ni les aperçus de branche ne salissent les chiffres. */
(function () {
  "use strict";
  if (!/^(www\.)?voidrelay\.fr$/.test(location.hostname)) return;
  if (!navigator.sendBeacon) return;
  function envoie(e, d) {
    try {
      navigator.sendBeacon("/api/evt", JSON.stringify({ e: e, d: d || "", p: location.pathname }));
    } catch (x) { /* la mesure ne doit jamais casser la page */ }
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null;
    if (!t) return;
    var marque = t.closest("[data-evt]");
    if (marque) return envoie(marque.getAttribute("data-evt"));
    if (t.closest(".vr-search-opt")) return envoie("recherche");
    if (t.closest(".langbtn")) return envoie("langue");
    var net = t.closest("[data-share] [data-net]");
    if (net) return envoie("partage", net.getAttribute("data-net"));
    var a = t.closest("a[href]");
    if (a && a.host && a.host !== location.host && /^https?:$/.test(a.protocol)) {
      envoie("sortie", a.hostname.replace(/^www\./, ""));
    }
  }, true);
  // Entrée dans la recherche ouvre le résultat actif sans clic : on le compte aussi.
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" || !ev.target || !ev.target.classList || !ev.target.classList.contains("vr-search-input")) return;
    var liste = document.getElementById(ev.target.getAttribute("aria-controls") || "");
    if (liste && !liste.hidden && liste.querySelector(".vr-search-opt")) envoie("recherche");
  }, true);
})();
