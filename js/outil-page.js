/* VoidRelay — socle des pages outils portées depuis l'ancienne app /warframe (16/07/2026).
   Décision l'admin : plus d'application séparée — chaque outil encore utile et fonctionnel
   (codex, fonderie, tâches, calc reliques, reliques ce soir, assistant farm, évaluateur
   riven) devient une vraie page du site, rendue par sa fonction de vue historique
   (js/views.js) dans <main id="app" data-view="renderX">.
   Ce fichier fournit ce que les vues attendaient de l'ancien js/app.js : la modale,
   les toasts, et le routage des liens internes hérités (#/route) vers les vraies pages. */
(function () {
  "use strict";

  /* ---------- Modale + toasts (repris de l'ancien app.js, comportement identique) ---------- */
  const _modal = () => document.getElementById("modal");
  window.openModal = function (html) {
    document.getElementById("modal-content").innerHTML = html;
    _modal().classList.remove("hide"); document.body.style.overflow = "hidden";
  };
  window.closeModal = function () {
    const m = _modal(); if (!m) return;
    m.classList.add("hide"); document.body.style.overflow = "";
  };
  window.toast = function (msg, type) {
    const c = document.getElementById("toasts"); if (!c) return;
    const t = document.createElement("div"); t.className = "toast" + (type ? " " + type : ""); t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, 2600);
  };

  /* ---------- Liens internes hérités de l'app (#/route) → vraies pages ---------- */
  const MAP = {
    marche: "/marche", favoris: "/favoris", estimateur: "/estimateur", digest: "/digest",
    "bons-plans": "/bons-plans", trade: "/trade", courses: "/courses", ducats: "/ducats", endo: "/endo",
    codex: "/codex", foundry: "/fonderie", taches: "/taches", reliquecalc: "/calc-reliques",
    "relic-optim": "/reliques-ce-soir", assistant: "/assistant-farm", "riven-eval": "/outils",
    accueil: "/outils", builds: "/builds/", guide: "/guides/farmer-platine-gratuit",
    monde: "/hub", "mondes-ouverts": "/hub", actus: "/hub", historique: "/estimateur",
    rivens: "/outils", comparateur: "/o/", planner: "/builds/", farmer: "/marche",
    reglages: "/outils", compte: "/favoris",
  };
  document.addEventListener("click", function (e) {
    const a = e.target && e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a) return;
    const r = a.getAttribute("href").slice(2).split("/")[0];
    if (MAP[r]) { e.preventDefault(); location.href = MAP[r]; }
  });

  /* Certaines vues naviguent en interne via location.hash (ex. les onglets du codex :
     #/codex/primary). Sur une vraie page il n'y a plus de routeur : si le hash désigne
     LA vue de cette page, on la re-rend avec le paramètre ; sinon on suit la carte. */
  window.addEventListener("hashchange", function () {
    const h = location.hash;
    if (!/^#\//.test(h)) return;
    const parts = h.slice(2).split("/");
    const main = document.getElementById("app");
    if (main && parts[0] === main.dataset.route) {
      const fn = window[main.dataset.view];
      if (typeof fn === "function") fn(parts[1]);
      return;
    }
    if (MAP[parts[0]]) location.replace(MAP[parts[0]]);
  });

  /* ---------- Thème : data-theme (site) pilote aussi body.light (composants des vues) ---------- */
  function syncTheme() {
    const light = document.documentElement.getAttribute("data-theme") === "light";
    document.body.classList.toggle("light", light);
    const b = document.getElementById("themebtn"); if (b) b.textContent = light ? "☀" : "☾";
  }

  document.addEventListener("DOMContentLoaded", function () {
    syncTheme();
    const tb = document.getElementById("themebtn");
    if (tb) tb.addEventListener("click", function () {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("vr-theme", next); } catch (_) {}
      syncTheme();
    });
    const m = _modal();
    if (m) {
      m.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", window.closeModal));
      document.addEventListener("keydown", e => { if (e.key === "Escape") window.closeModal(); });
    }
    // Rendu de la vue déclarée par la page — avec le paramètre du hash si on arrive
    // sur un ancien deep-link de la même vue (ex. /codex#/codex/relics).
    const main = document.getElementById("app");
    const fn = main && window[main.dataset.view];
    if (typeof fn === "function") {
      const h = location.hash;
      const parts = /^#\//.test(h) ? h.slice(2).split("/") : [];
      fn(parts[0] === main.dataset.route ? parts[1] : undefined);
    }
  });
})();
