/* VoidRelay — /warframe n'est plus une application (16/07/2026, décision de l'admin).
   Ses outils utiles vivent désormais comme de vraies pages du site ; cette page ne sert
   plus qu'à rediriger les anciens liens (favoris navigateur, PWA épinglée, liens #/route)
   vers la bonne destination. Par défaut : la page Outils. */
(function () {
  var MAP = {
    marche: "/marche", favoris: "/favoris", estimateur: "/estimateur", digest: "/digest",
    "bons-plans": "/bons-plans", trade: "/trade", courses: "/courses", ducats: "/ducats", endo: "/endo",
    codex: "/codex", foundry: "/fonderie", taches: "/taches", reliquecalc: "/calc-reliques",
    "relic-optim": "/reliques-ce-soir", assistant: "/assistant-farm", "riven-eval": "/outils",
    accueil: "/outils", builds: "/builds/", guide: "/guides/farmer-platine-gratuit",
    monde: "/hub", "mondes-ouverts": "/hub", actus: "/hub", historique: "/estimateur",
    rivens: "/outils", comparateur: "/o/", planner: "/builds/", farmer: "/marche",
    reglages: "/outils", compte: "/favoris",
  };
  var hash = location.hash || "";
  var route = /^#\//.test(hash) ? hash.slice(2).split("/")[0] : "";
  location.replace(MAP[route] || "/outils");
})();
