/* VoidRelay — recherche instantanée du header (accueil, desktop + panneau mobile) :
   autocomplete 100% client-side sur l'index statique data/wf_index.json (~3800 objets,
   généré au build, mis en cache par le service worker comme toute requête même origine).
   Aucun appel réseau par frappe : chargé une fois au premier focus, puis filtré en mémoire.
   Prix affiché "si dispo" via data/market.json (même logique de cache, best-effort). */
(function () {
  "use strict";
  // Deux familles de champs : la recherche du header (.vr-search-input) et les filtres
  // locaux des catalogues marqués data-vr-suggest (16/07/2026, demande de l'admin : « au bout
  // de trois lettres, devine ce que je veux dire ») — ces derniers gardent leur filtrage
  // local ET reçoivent les mêmes suggestions en menu déroulant, créé ici s'il n'existe pas.
  var inputs = Array.prototype.slice.call(document.querySelectorAll(".vr-search-input, [data-vr-suggest]"));
  if (!inputs.length) return;

  // i18n minimale : messages + routage selon la langue de la page. Sur les pages EN,
  // les résultats "build" mènent vers /en/builds/ (les 749 fiches EN existent toutes).
  // Les objets : /en/o/<slug> SI une page EN existe (les ~250 plus échangés, listés dans
  // data/en_objects_selection.json), SINON /o/<slug> (le catalogue FR est complet — jamais
  // de 404). Ainsi un trader anglophone qui cherche « Mesa Prime Set » reste en anglais.
  var isEn = document.documentElement.lang === "en";
  var enSet = null; // Set des slugs objets ayant une page EN ; rempli à loadIndex si isEn.
  function itemBase(slug) { return (isEn && enSet && enSet.has(slug)) ? "/en/o/" : "/o/"; }
  var MSG = isEn
    ? { none: "No results", recent: "Recently viewed", build: "⚙ build", page: "↦ page",
        count: function (n) { return n === 0 ? "No results" : n + " result" + (n > 1 ? "s" : "") + " available"; },
        buildsBase: "/en/builds/" }
    : { none: "Aucun résultat", recent: "Récemment consulté", build: "⚙ build", page: "↦ page",
        count: function (n) { return n === 0 ? "Aucun résultat" : n + " résultat" + (n > 1 ? "s" : "") + " disponible" + (n > 1 ? "s" : ""); },
        buildsBase: "/builds/" };

  // Actions ⌘K (16/07/2026) : deux gestes qui ne sont PAS des pages — bascule de thème
  // et changement de langue (vers l'équivalent hreflang de la page courante quand il
  // existe, sinon l'accueil de l'autre langue). Proposées en tête des résultats quand la
  // requête matche leurs mots-clés ; badge « ⚡ ». Tout le reste (outils, sections, guides)
  // passe déjà par pages_index / en_pages_index.
  function altLangHref() {
    var want = isEn ? "fr" : "en";
    var l = document.querySelector('link[rel="alternate"][hreflang="' + want + '"]');
    if (l) { try { return new URL(l.href).pathname; } catch (e) {} }
    return isEn ? "/" : "/en/";
  }
  var ACTIONS = isEn
    ? [{ n: "Toggle dark / light theme", k: "theme dark light mode night day toggle", act: "theme" },
       { n: "Version française", k: "french francais fr langue language version", act: "lang" }]
    : [{ n: "Basculer thème sombre / clair", k: "theme sombre clair nuit jour mode basculer", act: "theme" },
       { n: "English version", k: "english anglais en langue language version", act: "lang" }];
  ACTIONS.forEach(function (a) { a.nn = normalize(a.n); a.kk = normalize(a.k); });
  function matchActions(qn) {
    if (qn.length < 2) return [];
    return ACTIONS.filter(function (a) { return a.nn.indexOf(qn) !== -1 || a.kk.indexOf(qn) !== -1; });
  }
  function runAction(a) {
    if (a.act === "lang") { location.href = altLangHref(); return; }
    var t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("vr-theme", t); } catch (e) {}
    var b = document.getElementById("themebtn");
    if (b) b.textContent = t === "dark" ? "☾" : "☀";
  }

  var indexData = null, indexPromise = null, priceMap = null;
  var RECENT_KEY = "vr-recent-objets";
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { return []; }
  }

  function normalize(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function loadIndex() {
    if (indexPromise) return indexPromise;
    // Trois index fusionnés : objets du marché (/o/) + fiches builds (/builds/, drapeau b)
    // + pages du site (outils, sections, guides — drapeau p, URL absolue, mots-clés kk).
    indexPromise = Promise.all([
      fetch("/data/wf_index.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      fetch("/data/builds_index.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      // Pages du site : libellés dans la langue de la page (16/07/2026 — avant, la
      // recherche des pages EN proposait les intitulés français).
      fetch(isEn ? "/data/en_pages_index.json" : "/data/pages_index.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      // Slugs objets ayant une page EN : chargé uniquement sur les pages anglaises.
      isEn ? fetch("/data/en_objects_selection.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }) : Promise.resolve([])
    ]).then(function (all) {
        if (isEn) { var _en = {}; (all[3] || []).forEach(function (s) { _en[s] = 1; }); enSet = { has: function (k) { return _en[k] === 1; } }; }
        var list = (all[0] || [])
          .concat((all[1] || []).map(function (b) { return { s: b.s, n: b.n, b: 1 }; }))
          .concat((all[2] || []).map(function (g) { return { s: g.u, n: g.n, p: 1, k: g.k || "" }; }));
        indexData = list.map(function (it) {
          var nn = normalize(it.n);
          var kk = it.k ? normalize(it.k) : "";
          return { s: it.s, n: it.n, b: it.b, p: it.p, nn: nn, kk: kk,
                   words: (nn + (kk ? " " + kk : "")).split(/[^a-z0-9]+/).filter(Boolean) };
        });
        return indexData;
      }).catch(function () { indexData = []; return indexData; });
    fetch("/data/market.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      var m = new Map();
      // ancien format {categories:{cat:[{name,price}]}}
      if (d.categories) Object.keys(d.categories).forEach(function (k) {
        (d.categories[k] || []).forEach(function (row) {
          if (row && row.name && row.price != null) m.set(normalize(row.name), row.price);
        });
      });
      // nouveau format (update_warframe_data.py) {items:[{slug,median,...}]} — même compat que marche/trade
      if (Array.isArray(d.items)) d.items.forEach(function (it) {
        if (it && it.slug && it.median != null) m.set(normalize(String(it.slug).replace(/_/g, " ")), it.median);
      });
      if (m.size) priceMap = m;
    }).catch(function () {});
    return indexPromise;
  }

  function highlight(name, qn) {
    var nn = normalize(name);
    var i = qn ? nn.indexOf(qn) : -1;
    if (i < 0) return escapeHtml(name);
    return escapeHtml(name.slice(0, i)) + "<mark>" + escapeHtml(name.slice(i, i + qn.length)) + "</mark>" + escapeHtml(name.slice(i + qn.length));
  }

  // Damerau-Levenshtein bornée (transposition adjacente incluse), avec sortie anticipée
  // dès qu'une ligne entière dépasse maxDist — reste rapide même sur de longs noms.
  function boundedEditDistance(a, b, maxDist) {
    var al = a.length, bl = b.length;
    if (Math.abs(al - bl) > maxDist) return maxDist + 1;
    var prevPrev, prev = new Array(bl + 1), curr = new Array(bl + 1);
    for (var j = 0; j <= bl; j++) prev[j] = j;
    for (var i = 1; i <= al; i++) {
      curr[0] = i;
      var rowMin = curr[0];
      for (var j = 1; j <= bl; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        var val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
          val = Math.min(val, prevPrev[j - 2] + 1);
        }
        curr[j] = val;
        if (val < rowMin) rowMin = val;
      }
      if (rowMin > maxDist) return maxDist + 1; // toute la ligne dépasse déjà le seuil : abandon
      prevPrev = prev; prev = curr; curr = new Array(bl + 1);
    }
    return prev[bl];
  }

  function rank(list, qn) {
    var exact = [], prefix = [], contains = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i], idx = it.nn.indexOf(qn);
      if (it.nn === qn) exact.push(it);
      else if (idx === 0) prefix.push(it);
      else if (idx > 0) contains.push(it);
      // Pages : les mots-clés comptent aussi (« baro » → Convertisseur de ducats, guide Baro…).
      else if (it.kk && it.kk.indexOf(qn) !== -1) contains.push(it);
    }
    // Une page qui matche passe devant les objets du même panier : peu nombreuses,
    // ce sont les meilleures réponses aux requêtes de navigation (« codex », « marché »).
    var pageFirst = function (arr) {
      // Puis noms courts d'abord : « vol » doit proposer Volt avant Volatile Parasite.
      return arr.slice().sort(function (a, b) {
        var pa = a.p ? 0 : 1, pb = b.p ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return a.nn.length - b.nn.length;
      });
    };
    exact = pageFirst(exact); prefix = pageFirst(prefix); contains = pageFirst(contains);
    var exact_prefix_contains = exact.length + prefix.length + contains.length;
    var fuzzy = [];
    // Flou uniquement en repli, et seulement pour une requête assez longue pour être fiable.
    if (exact_prefix_contains < 6 && qn.length >= 3) {
      var maxDist = qn.length <= 5 ? 1 : 2;
      var known = exact.concat(prefix, contains);
      var scored = [];
      for (var k = 0; k < list.length; k++) {
        var it2 = list[k];
        if (known.indexOf(it2) !== -1) continue;
        var best = maxDist + 1;
        for (var w = 0; w < it2.words.length; w++) {
          var word = it2.words[w];
          if (Math.abs(word.length - qn.length) > maxDist) continue;
          var d = boundedEditDistance(qn, word, maxDist);
          if (d < best) best = d;
          if (best === 0) break;
        }
        if (best <= maxDist) scored.push({ it: it2, d: best });
      }
      scored.sort(function (a, b) { return a.d - b.d; });
      fuzzy = scored.slice(0, 8).map(function (x) { return x.it; });
    }
    return exact.concat(prefix, contains, fuzzy).slice(0, 8);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  var suggestSeq = 0;
  inputs.forEach(function (input) {
    var suggestOnly = input.hasAttribute("data-vr-suggest");
    var resultsId = input.getAttribute("aria-controls");
    var results = resultsId && document.getElementById(resultsId);
    if (!results && suggestOnly) {
      // Filtre local : on fabrique le menu déroulant nous-mêmes, ancré sur un
      // conteneur dédié qui épouse l'input (son parent peut être tout <main>,
      // un top:100% s'y référerait et enverrait le menu en bas de page).
      resultsId = "vr-suggest-" + (++suggestSeq);
      var anchor = document.createElement("div");
      anchor.style.position = "relative";
      var mw = getComputedStyle(input).maxWidth;
      if (mw && mw !== "none") anchor.style.maxWidth = mw;
      input.parentNode.insertBefore(anchor, input);
      anchor.appendChild(input);
      results = document.createElement("div");
      results.className = "vr-search-results";
      results.id = resultsId; results.hidden = true;
      results.setAttribute("role", "listbox");
      input.setAttribute("aria-controls", resultsId);
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-expanded", "false");
      anchor.appendChild(results);
    }
    if (!results) return;
    var activeIndex = -1, currentItems = [];

    // Zone annoncée aux lecteurs d'écran (nombre de résultats), séparée du dropdown visuel
    // pour ne pas faire lire tout le HTML des résultats à chaque frappe.
    var live = document.createElement("div");
    live.className = "sr-only"; live.setAttribute("aria-live", "polite");
    results.insertAdjacentElement("afterend", live);
    function announce(n) {
      live.textContent = MSG.count(n);
    }

    function close() {
      results.hidden = true; results.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1; currentItems = [];
    }
    function open() { results.hidden = false; input.setAttribute("aria-expanded", "true"); }

    function optHtml(it, i, qn) {
      var badge;
      if (it.act) badge = '<span class="vr-search-build">⚡ action</span>';
      else if (it.p) badge = '<span class="vr-search-build">' + MSG.page + '</span>';
      else if (it.b) badge = '<span class="vr-search-build">' + MSG.build + '</span>';
      else { var price = priceMap && priceMap.get(it.nn); badge = price != null ? '<span class="vr-search-price">' + price + " PL</span>" : ""; }
      var url = it.act ? "#" : it.p ? it.s : it.b ? MSG.buildsBase + encodeURIComponent(it.s) : itemBase(it.s) + encodeURIComponent(it.s);
      return '<a href="' + url + '"' + (it.act ? ' data-act="' + it.act + '"' : "") + ' class="vr-search-opt" role="option" id="' + resultsId + '-opt-' + i + '" tabindex="-1">'
        + '<span class="vr-search-name">' + (qn ? highlight(it.n, qn) : escapeHtml(it.n)) + "</span>" + badge + "</a>";
    }

    function renderResults(items, qn) {
      currentItems = items; activeIndex = -1;
      announce(items.length);
      if (!items.length) { results.innerHTML = '<div class="vr-search-empty">' + MSG.none + '</div>'; open(); return; }
      results.innerHTML = items.map(function (it, i) { return optHtml(it, i, qn); }).join("");
      open();
    }

    function renderRecent() {
      var recent = getRecent();
      currentItems = recent.map(function (r) { return { s: r.s, n: r.n, nn: normalize(r.n) }; });
      activeIndex = -1;
      if (!currentItems.length) { close(); return; }
      results.innerHTML = '<div class="vr-search-label">' + MSG.recent + '</div>'
        + currentItems.map(function (it, i) { return optHtml(it, i, ""); }).join("");
      open();
    }

    function setActive(i) {
      var opts = results.querySelectorAll(".vr-search-opt");
      if (!opts.length) return;
      if (activeIndex >= 0 && opts[activeIndex]) opts[activeIndex].classList.remove("active");
      activeIndex = (i + opts.length) % opts.length;
      opts[activeIndex].classList.add("active");
      input.setAttribute("aria-activedescendant", opts[activeIndex].id);
      opts[activeIndex].scrollIntoView({ block: "nearest" });
    }

    var onInput = debounce(function () {
      var q = input.value.trim();
      if (!q) { suggestOnly ? close() : renderRecent(); return; }
      if (suggestOnly && q.length < 2) { close(); return; }
      loadIndex().then(function (list) {
        var qn = normalize(q);
        // Actions (thème, langue) en tête quand la requête matche — jamais sur les
        // filtres locaux data-vr-suggest (ils filtrent un catalogue, pas le site).
        var acts = suggestOnly ? [] : matchActions(qn);
        renderResults(acts.concat(rank(list, qn)).slice(0, 9), qn);
      });
    }, 120);

    input.addEventListener("focus", function () {
      loadIndex();
      if (!input.value.trim() && !suggestOnly) renderRecent();
    });
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { if (!results.hidden) { e.preventDefault(); setActive(activeIndex + 1); } }
      else if (e.key === "ArrowUp") { if (!results.hidden) { e.preventDefault(); setActive(activeIndex - 1); } }
      else if (e.key === "Enter") {
        if (!results.hidden && currentItems.length) {
          e.preventDefault();
          var idx = activeIndex >= 0 ? activeIndex : 0;
          var picked = currentItems[idx];
          if (picked.act) { runAction(picked); close(); return; }
          location.href = picked.p ? picked.s : (picked.b ? MSG.buildsBase : itemBase(picked.s)) + encodeURIComponent(picked.s);
        }
      } else if (e.key === "Escape") { close(); input.blur(); }
    });
    // Clic sur une action (href="#") : exécuter au lieu de naviguer.
    results.addEventListener("click", function (e) {
      var opt = e.target && e.target.closest && e.target.closest(".vr-search-opt[data-act]");
      if (!opt) return;
      e.preventDefault();
      runAction({ act: opt.getAttribute("data-act") });
      close();
    });
    document.addEventListener("click", function (e) {
      if (!e.target || !e.target.closest) return;
      if (e.target === input || results.contains(e.target)) return;
      if (!e.target.closest(".search") && !e.target.closest(".topnav-search")) close();
    });
  });

  // Raccourcis ⌘K / Ctrl+K (badge "K" du champ) et "/" (habitude héritée de l'ancienne app) :
  // focus la recherche visible la plus pertinente (ouvre le menu mobile au besoin).
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "");
    var slash = e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey;
    if (!slash && !((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K"))) return;
    var visible = inputs.filter(function (el) { return el.offsetParent !== null; })[0];
    if (!visible) {
      var burger = document.getElementById("navburger");
      if (burger && getComputedStyle(burger).display !== "none") burger.click();
      visible = inputs.filter(function (el) { return el.offsetParent !== null; })[0];
    }
    if (visible) { e.preventDefault(); visible.focus(); visible.select(); }
  });
})();
