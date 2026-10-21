/* VoidRelay — hydratation des pages objet (/o/<slug>) :
   prix live (warframe.market), ducats + ratio ducats/platine, et pour les sets
   Prime un comparateur « acheter les pièces vs le set complet ». Via proxy CORS. */
(function () {
  const root = document.getElementById("objet"); if (!root) return;
  const slug = root.dataset.slug; if (!slug) return;
  const MK1 = "https://api.warframe.market/v1", MK2 = "https://api.warframe.market/v2";
  const CUSTOM = "https://voidrelay-proxy.vercel.app";
  const PROXIES = [
    u => `${CUSTOM}/?url=${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  ];
  const $ = id => document.getElementById(id);
  const set = (id, t) => { const e = $(id); if (e) e.textContent = t; };
  const titleCase = s => String(s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  // /en/o/ (10/07/2026) : ce script est partagé FR/EN. Le contenu SERVEUR (describe(),
  // FAQ, badges) est déjà traduit dans le générateur ; ce qui reste ici est injecté côté
  // client APRÈS coup (tendance, phrase FAQ calculée, horodatage) — sans ce drapeau, une
  // page /en/o/ affichait "▲ en hausse" / "vendus/48 h" / "màj" en français malgré
  // lang="en", repéré en vérifiant le rendu réel (pas juste le HTML source).
  const isEn = document.documentElement.lang === "en";

  /* ACTIVÉ (10/07/2026) — répartition tranchée par le Chef : tout ce qui est injecté par
   * ce script (JS) est de mon périmètre ; le bot design garde header/footer/nav (rendus par
   * le template, jamais traduits ici). Un seul mécanisme par périmètre, pas de recouvrement.
   * Table centralisée pour éviter la duplication : une seule table FR/EN, pas de fichier
   * objet-en.js séparé.
   */
  const UI_LABELS = {
    copyName: { fr: "📋 Copier le nom", en: "📋 Copy name" },
    copyNameAria: { fr: n => `Copier le nom « ${n} »`, en: n => `Copy the name "${n}"` },
    copied: { fr: "✓ Copié", en: "✓ Copied" },
    favAdd: { fr: "☆ Favoris", en: "☆ Favorite" },
    favActive: { fr: "★ Favori", en: "★ Favorited" },
    favAriaAdd: { fr: n => `Ajouter « ${n} » des favoris`, en: n => `Add "${n}" to favorites` },
    favAriaRemove: { fr: n => `Retirer « ${n} » des favoris`, en: n => `Remove "${n}" from favorites` },
    favPanelBtn: { fr: (n) => "★ Favoris" + (n ? ` (${n})` : ""), en: (n) => "★ Favorites" + (n ? ` (${n})` : "") },
    favPanelEmpty: { fr: "Aucun favori pour l’instant. Clique ☆ sur une page objet.", en: "No favorites yet. Click ☆ on an item page." },
    favRemoveAria: { fr: "Retirer des favoris", en: "Remove from favorites" },
    cmpAdd: { fr: "🛒 Comparer", en: "🛒 Compare" },
    cmpActive: { fr: "🛒 Dans le comparateur", en: "🛒 In comparison" },
    cmpAriaAdd: { fr: (n, full) => `Ajouter « ${n} » du comparateur${full ? " (limite atteinte)" : ""}`, en: (n, full) => `Add "${n}" to comparison${full ? " (limit reached)" : ""}` },
    cmpAriaRemove: { fr: (n, full) => `Retirer « ${n} » du comparateur${full ? " (limite atteinte)" : ""}`, en: (n, full) => `Remove "${n}" from comparison${full ? " (limit reached)" : ""}` },
    cmpPanelBtn: { fr: (n) => "🛒 Comparateur" + (n ? ` (${n})` : ""), en: (n) => "🛒 Comparison" + (n ? ` (${n})` : "") },
    cmpPanelEmpty: { fr: "Comparateur vide. Clique 🛒 Comparer sur une page objet pour additionner leurs prix.", en: "Comparison list is empty. Click 🛒 Compare on an item page to add up their prices." },
    cmpRemoveAria: { fr: "Retirer du comparateur", en: "Remove from comparison" },
    cmpTotal: { fr: (resolved, total) => `Total (${resolved}/${total})`, en: (resolved, total) => `Total (${resolved}/${total})` },
    cmpPending: { fr: "chargement des prix…", en: "loading prices…" },
    cmpFailed: { fr: (n) => `${n} objet(s) sans prix trouvé`, en: (n) => `${n} item(s) with no price found` },
    cmpClear: { fr: "Vider le comparateur", en: "Clear comparison" },
  };
  const t = key => UI_LABELS[key][isEn ? "en" : "fr"];

  async function fetchJSON(target) {
    for (const w of PROXIES) { try { const r = await fetch(w(target), { headers: { Accept: "application/json" } }); if (r.ok) return await r.json(); } catch (e) {} }
    return null;
  }
  function spark(vals) {
    if (!vals || vals.length < 2) return "";
    const w = 160, h = 40, min = Math.min(...vals), max = Math.max(...vals), sp = (max - min) || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - ((v - min) / sp) * h).toFixed(1)}`).join(" ");
    const up = vals[vals.length - 1] >= vals[0];
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${up ? '#34d399' : '#f87171'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  /* Médiane des ventes (48 h) d'un slug → {med, min, vol, hist, rang, rangs} ou null.

     v69 — CE CALCUL PRENAIT LE DERNIER SEAU DU TABLEAU, SANS REGARDER LE RANG.
     Sur un objet à rangs, ce n'était même pas « le rang max » ou « le plus
     échangé » : c'était CELUI QUE L'API RENVOIE EN DERNIER, donc un accident.
     Relevé le 04/09/2026 sur les 3838 pages objet :

       Arcane Energize  affiché   9 p (rang 0)  ·  rang 5 : 150 p   → x17
       Arcane Grace     affiché   7 p (rang 0)  ·  rang 5 : 115 p   → x16
       Primed Flow      affiché  45 p (rang 0)  ·  rang 10 : 115 p  → x2,6

     Ce sont les pages qui sortent sur « prix Arcane Energize » dans un moteur
     de recherche. Un joueur y lisait NEUF platine pour un arcane qui en vaut
     cent cinquante. Et comme rien ne fixait le rang retenu, le chiffre pouvait
     changer du simple au décuple sans qu'une ligne de code ait bougé.

     Même parti pris qu'en v67 pour l'estimateur : le chiffre principal est
     celui du rang MAX (celui qu'on cite), et le détail par rang est rendu pour
     que la page puisse le DIRE. On ne choisit pas en silence. */
  async function median(s) {
    const d = await fetchJSON(`${MK1}/items/${s}/statistics`);
    let live = []; try { live = (d && d.payload && d.payload.statistics_live && d.payload.statistics_live["48hours"]) || []; } catch (e) {}
    const sells = (live || []).filter(x => x.order_type === "sell");
    if (sells.length) {
      const rangs = [...new Set(sells.map(x => x.mod_rank).filter(r => typeof r === "number"))].sort((a, b) => a - b);
      const dansRang = rangs.length ? sells.filter(x => x.mod_rank === rangs[rangs.length - 1]) : sells;
      const last = dansRang[dansRang.length - 1];
      if (!last) return null;
      return {
        med: Math.round(last.median), min: Math.round(last.min_price), vol: last.volume || 0,
        hist: dansRang.slice(-14).map(x => x.median),
        rang: rangs.length ? rangs[rangs.length - 1] : null,
        rangs: rangs.map(function (r) {
          const xs = sells.filter(x => x.mod_rank === r);
          const der = xs[xs.length - 1] || {};
          return { r: r, med: Math.round(der.median || 0), vol: xs.reduce((a, x) => a + (x.volume || 0), 0) };
        }).filter(x => x.med > 0),
      };
    }
    // v1/statistics en panne (la v1 se fait démonter endpoint par endpoint) OU objet
    // sans vente récente : repli v2 = carnet d'offres du moment (volume inconnu → 0).
    // Le carnet porte AUSSI un rang par ordre : sans filtre, on mélangerait ici
    // ce qu'on vient de séparer au-dessus.
    const top = await fetchJSON(`${MK2}/orders/item/${s}/top`);
    let ordres = (((top || {}).data || {}).sell || []);
    const rgs = [...new Set(ordres.map(o => o.rank).filter(r => typeof r === "number"))];
    const rang = rgs.length ? Math.max(...rgs) : null;
    if (rang !== null) ordres = ordres.filter(o => o.rank === rang);
    const prices = ordres.map(o => o.platinum).sort((a, b) => a - b);
    if (!prices.length) return null;
    return { med: Math.round(prices[Math.floor(prices.length / 2)]), min: Math.round(prices[0]),
             vol: 0, hist: [], rang: rang, rangs: [] };
  }

  // Bouton "copier le nom" (indépendant du prix, ne dépend d'aucune requête réseau).
  const h1 = root.querySelector("h1");
  const itemName = titleCase(slug);

  // Historique local "récemment consulté" (alimente les suggestions de la recherche accueil).
  try {
    const RECENT_KEY = "vr-recent-objets";
    const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter(r => r.s !== slug);
    recent.unshift({ s: slug, n: itemName });
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 8)));
  } catch (e) {}
  if (h1 && navigator.clipboard) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "copyname"; btn.dataset.evt = "copie";
    btn.setAttribute("aria-label", t("copyNameAria")(itemName));
    btn.textContent = t("copyName");
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(itemName).then(() => {
        btn.classList.add("copied"); btn.textContent = t("copied");
        setTimeout(() => { btn.classList.remove("copied"); btn.textContent = t("copyName"); }, 1600);
      }).catch(() => {});
    });
    h1.appendChild(document.createTextNode(" "));
    h1.appendChild(btn);
  }

  // --- Favoris locaux (localStorage, aucun compte, aucune donnée envoyée) ---
  // Clé partagée "favs" (objet {nom: {name,cat,target,url}}) : la même liste alimente
  // aussi /favoris, /marche et /estimateur — favoriser un objet ici le fait apparaître
  // là-bas, et inversement (avant : deux systèmes de favoris étanches, vr-fav-objets vs favs).
  const FAV_KEY = "favs";
  (function migrateLegacyFavs() {
    try {
      if (localStorage.getItem(FAV_KEY) !== null) return;
      const legacy = JSON.parse(localStorage.getItem("vr-fav-objets") || "null");
      if (!Array.isArray(legacy) || !legacy.length) return;
      const migrated = {};
      legacy.forEach(f => { if (f && f.s && f.n) migrated[f.n] = { name: f.n, cat: "", target: 0, url: f.s }; });
      localStorage.setItem(FAV_KEY, JSON.stringify(migrated));
    } catch (e) {}
  })();
  // Repli identique à celui de /favoris quand un favori vient de /marche ou /estimateur
  // (ces pages ne stockent pas toujours "url" — juste le nom affiché sur Warframe Market).
  const slugify = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  function readFavStore() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); } catch (e) { return {}; } }
  function writeFavStore(obj) { try { localStorage.setItem(FAV_KEY, JSON.stringify(obj)); } catch (e) {} }
  function getFavs() {
    const store = readFavStore();
    return Object.keys(store).reverse().map(n => ({ s: store[n].url || slugify(n), n }));
  }
  function isFav(s) { const store = readFavStore(); return Object.keys(store).some(n => (store[n].url || slugify(n)) === s); }
  function toggleFav(s, n) {
    const store = readFavStore();
    const key = Object.keys(store).find(k => (store[k].url || slugify(k)) === s);
    if (key) delete store[key]; else store[n] = { name: n, cat: "", target: 0, url: s };
    writeFavStore(store);
  }
  function removeFav(s) {
    const store = readFavStore();
    const key = Object.keys(store).find(k => (store[k].url || slugify(k)) === s);
    if (key) delete store[key];
    writeFavStore(store);
  }

  let renderFavsPanel = null, renderFavBtn = null;

  if (h1) {
    const favBtn = document.createElement("button");
    favBtn.type = "button"; favBtn.className = "favbtn"; favBtn.dataset.evt = "favori";
    renderFavBtn = function () {
      const fav = isFav(slug);
      favBtn.classList.toggle("active", fav);
      favBtn.textContent = fav ? t("favActive") : t("favAdd");
      favBtn.setAttribute("aria-pressed", fav ? "true" : "false");
      favBtn.setAttribute("aria-label", fav ? t("favAriaRemove")(itemName) : t("favAriaAdd")(itemName));
    };
    renderFavBtn();
    favBtn.addEventListener("click", () => {
      toggleFav(slug, itemName);
      renderFavBtn();
      if (renderFavsPanel) renderFavsPanel();
    });
    h1.appendChild(document.createTextNode(" "));
    h1.appendChild(favBtn);
  }

  // Bouton "★ Favoris" dans l'en-tête (vrtop), injecté en JS : accès à la liste sans changer
  // le HTML des 3800+ pages générées. Panneau local, aucune requête réseau.
  const vrtop = document.querySelector(".vrtop");
  if (vrtop) {
    const wrap = document.createElement("div");
    wrap.className = "vr-favs-wrap";
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "vr-favs-btn";
    const panel = document.createElement("div");
    panel.className = "vr-favs-panel"; panel.hidden = true;

    renderFavsPanel = function () {
      const favs = getFavs();
      btn.textContent = t("favPanelBtn")(favs.length);
      if (!favs.length) { panel.innerHTML = '<p class="vr-favs-empty">' + t("favPanelEmpty") + '</p>'; return; }
      panel.innerHTML = favs.map(f =>
        '<div class="vr-favs-row"><a href="/o/' + encodeURIComponent(f.s) + '">' + f.n.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])) + '</a>'
        + '<button type="button" class="vr-favs-rm" data-s="' + f.s + '" aria-label="' + t("favRemoveAria") + '">×</button></div>'
      ).join("");
    };
    renderFavsPanel();

    btn.addEventListener("click", () => { panel.hidden = !panel.hidden; });
    panel.addEventListener("click", (e) => {
      const rm = e.target.closest(".vr-favs-rm");
      if (!rm) return;
      removeFav(rm.dataset.s);
      renderFavsPanel();
      if (rm.dataset.s === slug && renderFavBtn) renderFavBtn();
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".vr-favs-wrap")) panel.hidden = true; });

    wrap.appendChild(btn); wrap.appendChild(panel);
    vrtop.appendChild(wrap);
  }

  // --- Comparateur / panier local (localStorage, aucun compte, aucune donnée envoyée) ---
  // Prix récupérés à la demande (à l'ouverture du panneau seulement), via la même fonction
  // median() que le reste de la page — aucun nouveau domaine, aucun changement de connect-src.
  const CMP_KEY = "vr-compare-objets", CMP_MAX = 12;
  function getCmp() { try { return JSON.parse(localStorage.getItem(CMP_KEY) || "[]"); } catch (e) { return []; } }
  function setCmp(list) { try { localStorage.setItem(CMP_KEY, JSON.stringify(list)); } catch (e) {} }
  function isInCmp(s) { return getCmp().some(c => c.s === s); }
  function toggleCmp(s, n) {
    const list = getCmp();
    const i = list.findIndex(c => c.s === s);
    if (i >= 0) list.splice(i, 1); else list.unshift({ s, n });
    setCmp(list.slice(0, CMP_MAX));
  }
  function removeCmp(s) { setCmp(getCmp().filter(c => c.s !== s)); }
  const cmpPriceCache = new Map(); // slug -> médiane (nombre) ou null (échec), pour la session en cours

  let renderCmpPanel = null, renderCmpBtn = null;

  if (h1) {
    const cmpBtn = document.createElement("button");
    cmpBtn.type = "button"; cmpBtn.className = "favbtn"; cmpBtn.dataset.evt = "comparer";
    renderCmpBtn = function () {
      const inCmp = isInCmp(slug);
      const full = !inCmp && getCmp().length >= CMP_MAX;
      cmpBtn.classList.toggle("active", inCmp);
      cmpBtn.textContent = inCmp ? t("cmpActive") : t("cmpAdd");
      cmpBtn.disabled = full;
      cmpBtn.setAttribute("aria-pressed", inCmp ? "true" : "false");
      cmpBtn.setAttribute("aria-label", inCmp ? t("cmpAriaRemove")(itemName, full) : t("cmpAriaAdd")(itemName, full));
    };
    renderCmpBtn();
    cmpBtn.addEventListener("click", () => {
      toggleCmp(slug, itemName);
      renderCmpBtn();
      if (renderCmpPanel) renderCmpPanel();
    });
    h1.appendChild(document.createTextNode(" "));
    h1.appendChild(cmpBtn);
  }

  if (vrtop) {
    const wrap = document.createElement("div");
    wrap.className = "vr-favs-wrap";
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "vr-favs-btn";
    const panel = document.createElement("div");
    panel.className = "vr-favs-panel vr-cmp-panel"; panel.hidden = true;

    function cmpRowHtml(c) {
      const cached = cmpPriceCache.get(c.s);
      const priceHtml = cached === undefined ? '<span class="vr-cmp-price muted">…</span>'
        : cached === null ? '<span class="vr-cmp-price muted">—</span>'
        : `<span class="vr-cmp-price">${cached} PL</span>`;
      return '<div class="vr-favs-row"><a href="/o/' + encodeURIComponent(c.s) + '">' + c.n.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])) + '</a>'
        + priceHtml
        + '<button type="button" class="vr-favs-rm" data-s="' + c.s + '" aria-label="' + t("cmpRemoveAria") + '">×</button></div>';
    }
    function cmpTotalHtml(list) {
      const resolved = list.map(c => cmpPriceCache.get(c.s)).filter(v => typeof v === "number");
      const pending = list.some(c => cmpPriceCache.get(c.s) === undefined);
      const failed = list.filter(c => cmpPriceCache.get(c.s) === null).length;
      const total = resolved.reduce((a, b) => a + b, 0);
      let note = pending ? t("cmpPending") : (failed ? t("cmpFailed")(failed) : "");
      return '<div class="vr-cmp-total"><span>' + t("cmpTotal")(resolved.length, list.length) + '</span><b>' + total + ' PL</b></div>'
        + (note ? '<p class="vr-favs-empty" style="text-align:left;padding:.2rem .6rem">' + note + '</p>' : "")
        + '<button type="button" class="vr-cmp-clear">' + t("cmpClear") + '</button>';
    }

    renderCmpPanel = function () {
      const list = getCmp();
      btn.textContent = t("cmpPanelBtn")(list.length);
      if (!list.length) { panel.innerHTML = '<p class="vr-favs-empty">' + t("cmpPanelEmpty") + '</p>'; return; }
      panel.innerHTML = list.map(cmpRowHtml).join("") + cmpTotalHtml(list);
      list.forEach(c => {
        if (cmpPriceCache.has(c.s)) return;
        cmpPriceCache.set(c.s, undefined);
        median(c.s).then(m => {
          cmpPriceCache.set(c.s, m ? m.med : null);
          if (!panel.hidden) renderCmpPanel();
        });
      });
    };
    renderCmpPanel();

    btn.addEventListener("click", () => { panel.hidden = !panel.hidden; if (!panel.hidden) renderCmpPanel(); });
    panel.addEventListener("click", (e) => {
      if (e.target.closest(".vr-cmp-clear")) { setCmp([]); cmpPriceCache.clear(); renderCmpPanel(); if (renderCmpBtn) renderCmpBtn(); return; }
      const rm = e.target.closest(".vr-favs-rm");
      if (!rm) return;
      removeCmp(rm.dataset.s);
      cmpPriceCache.delete(rm.dataset.s);
      renderCmpPanel();
      if (rm.dataset.s === slug && renderCmpBtn) renderCmpBtn();
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".vr-favs-wrap")) panel.hidden = true; });

    wrap.appendChild(btn); wrap.appendChild(panel);
    vrtop.appendChild(wrap);
  }

  (async () => {
    const wrap = $("px-wrap");
    const main = await median(slug);
    if (!main) {
      if (wrap) wrap.innerHTML = isEn
        ? `<p class="muted">Price unavailable right now. <a href="https://warframe.market/items/${slug}" target="_blank" rel="noopener noreferrer nofollow">See on Warframe Market ↗</a></p>`
        : `<p class="muted">Prix indisponible pour le moment. <a href="https://warframe.market/items/${slug}" target="_blank" rel="noopener noreferrer nofollow">Voir sur Warframe Market ↗</a></p>`;
    } else {
      set("px-median", main.med + " PL"); set("px-min", main.min + " PL");
      set("px-vol", main.vol + (isEn ? " sold/48h" : " vendus/48 h"));
      const first = main.hist[0] || main.med;
      const dir = main.med > first ? "up" : (main.med < first ? "down" : "");
      const trend = main.med > first ? (isEn ? "▲ rising" : "▲ en hausse") : (main.med < first ? (isEn ? "▼ falling" : "▼ en baisse") : (isEn ? "→ stable" : "→ stable"));
      set("px-trend", trend);
      const trendEl = $("px-trend"); if (trendEl && dir) trendEl.classList.add(dir);
      const sp = $("px-spark"); if (sp) sp.innerHTML = spark(main.hist);
      set("faq-prix-val", isEn
        ? `around ${main.med} platinum (lowest sale ${main.min} PL, ${main.vol} sales in 48h)`
        : `environ ${main.med} platine (vente la plus basse ${main.min} PL, ${main.vol} ventes sur 48 h)`);
      const u = $("px-updated");
      if (u) {
        const maj = isEn
          ? "upd " + new Date().toLocaleString("en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
          : "màj " + new Date().toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        /* v69 — dire QUEL rang porte le chiffre, et donner l'autre. On écrit
           dans un élément qui existe déjà et qui était déjà rempli après coup :
           aucune surface nouvelle, donc aucun décalage de mise en page. */
        const det = (main.rangs && main.rangs.length > 1)
          ? (isEn
              ? " — this item trades by rank; the price above is rank " + main.rang + ". "
                + main.rangs.map(x => "rank " + x.r + ": " + x.med + " PL").join(" · ")
              : " — cet objet se négocie par rang ; le prix ci-dessus est celui du rang " + main.rang + ". "
                + main.rangs.map(x => "rang " + x.r + " : " + x.med + " PL").join(" · "))
          : "";
        u.textContent = maj + det;
      }
      if (wrap) wrap.classList.add("px-ready");
    }

    // --- détails objet : ducats + ratio + comparateur de set ---
    const det = await fetchJSON(`${MK2}/item/${slug}`);
    const d = det && (det.data || det);
    if (d && d.ducats) {
      let txt = d.ducats + " ducats";
      if (main && main.med) txt += ` · ${(d.ducats / main.med).toFixed(2)} ducats/PL`;
      set("px-ducats", txt);
    }
    const sec = $("set-compare");
    if (sec && !(d && d.setRoot)) { sec.remove(); }
    else if (sec && d && d.setRoot) {
      const sr = await fetchJSON(`${MK2}/item/${slug}/set`);
      const items = (sr && ((sr.data && sr.data.items) || sr.items)) || [];
      const parts = items.filter(p => p && !p.setRoot && p.slug);
      if (!parts.length) return;
      /* v70 — LE COMPARATIF PIÈCES/SET PEUT ÊTRE INCOMPLET, ET LE DIRE VAUT
         MIEUX QUE DE CONCLURE. warframe.market modélise « Aklex Prime Set »
         comme plan + lien : les DEUX LEX PRIME entières n'en font pas partie
         pour lui, parce qu'elles se vendent comme leur propre objet. Son API
         ne les renvoie donc pas.

         Mesuré le 04/09/2026 sur /o/akbronco-prime-set : plan 2 p + lien 4 p
         = 6 p contre 10 p pour le set, d'où le verdict « acheter les pièces
         revient moins cher, économie ~4 p ». Le joueur qui suit ce conseil
         dépense 6 platine et N'A PAS L'ARME — il lui faut encore deux Bronco
         Prime, qui coûtent bien davantage. Cohérent avec le modèle de
         warframe.market, et malgré tout un mauvais conseil.

         On ne va pas inventer les prix manquants : on retire le verdict et on
         nomme ce qui manque. data/sets_imbriques.json (quelques centaines
         d'octets, chargé uniquement sur une page de set) vient de la recette
         de JEU, la seule source qui connaisse ces composants. */
      const manque = await (async () => {
        try {
          const j = await fetchJSON("/data/sets_imbriques.json");
          return ((j || {}).sets || {})[slug] || null;
        } catch (e) { return null; }
      })();
      const prices = await Promise.all(parts.map(p => median(p.slug)));
      let sum = 0, complete = true;
      const rows = parts.map((p, i) => {
        const m = prices[i], q = p.quantityInSet || 1;
        if (!m) { complete = false; return `<div class="kv"><span class="k">${titleCase(p.slug)}${q > 1 ? " ×" + q : ""}</span><span class="v muted">—</span></div>`; }
        sum += m.med * q;
        return `<div class="kv"><span class="k"><a href="/o/${encodeURIComponent(p.slug)}">${titleCase(p.slug)}</a>${q > 1 ? " ×" + q : ""}</span><span class="v">${m.med * q} PL</span></div>`;
      }).join("");
      const setMed = main && main.med;
      let verdict = "";
      if (manque && manque.length) {
        const liste = manque.map(x => (x.n > 1 ? x.n + "× " : "") + x.nom).join(", ");
        verdict = isEn
          ? `<p class="verdict">⚠️ <b>This comparison is incomplete.</b> Warframe Market does not count ${liste} among this set's parts — they are sold as their own item — yet the in-game recipe needs them. Buying only the parts listed above does <b>not</b> give you the weapon.</p>`
          : `<p class="verdict">⚠️ <b>Cette comparaison est incomplète.</b> Warframe Market ne compte pas ${liste} parmi les pièces de ce set — elles se vendent comme leur propre objet — alors que la recette du jeu les exige. Acheter seulement les pièces ci-dessus ne donne <b>pas</b> l'arme.</p>`;
      } else if (setMed && complete) {
        verdict = sum < setMed
          ? (isEn
            ? `<p class="verdict good">💡 Buying the parts (~${sum} PL) is <b>cheaper</b> than the full set (${setMed} PL) — save ~${setMed - sum} PL.</p>`
            : `<p class="verdict good">💡 Acheter les pièces (~${sum} PL) revient <b>moins cher</b> que le set complet (${setMed} PL) — économie ~${setMed - sum} PL.</p>`)
          : (isEn
            ? `<p class="verdict">💡 The full set (${setMed} PL) is <b>just as good or cheaper</b> than the parts (~${sum} PL).</p>`
            : `<p class="verdict">💡 Acheter le set complet (${setMed} PL) est <b>aussi avantageux ou moins cher</b> que les pièces (~${sum} PL).</p>`);
      } else if (setMed && !(manque && manque.length)) {
        verdict = isEn
          ? `<p class="muted">Full set: ${setMed} PL · estimated parts total: ~${sum} PL (some parts have no active price).</p>`
          : `<p class="muted">Set complet : ${setMed} PL · total pièces estimé : ~${sum} PL (certaines pièces sans prix actif).</p>`;
      }
      const heading = isEn ? "Buy the parts or the set?" : "Acheter les pièces ou le set ?";
      const totalLabel = isEn ? "Parts total" : "Total pièces";
      sec.innerHTML = `<h2 style="margin-top:0;font-size:1.1rem">${heading}</h2>${rows}<div class="kv" style="border-top:1px solid #1c2530;margin-top:.4rem;padding-top:.4rem"><span class="k"><b>${totalLabel}</b></span><span class="v"><b>${sum} PL</b></span></div>${verdict}`;
      sec.style.display = "";
    }

    // --- Historique de prix (bakée au build, aucun appel supplémentaire côté client) + badge "bon plan" ---
    // Couverture limitée : data/market_history.json est un instantané périodique pour
    // quelques objets phares (sets Prime, arcanes), pas les 3800+ pages — section absente
    // silencieusement sinon (même logique que le comparateur de set ci-dessus).
    if (main && wrap) {
      try {
        const hist = await fetch("/data/market_history.json").then(r => r.ok ? r.json() : null).catch(() => null);
        // Seulement les points du rang affiché (champ r, depuis le 20/10/2026) : un
        // point sans r sur un objet à rangs date de l'époque où le rang basculait
        // 0 ↔ max d'une passe à l'autre, sa médiane ne décrit pas cet objet-ci.
        const rows = hist && (hist[slug] || []).filter(p => main.rang != null ? p.r === main.rang : p.r === undefined);
        if (rows && rows.length >= 3) {
          const medians = rows.map(r => r.median);
          const sorted = medians.slice().sort((a, b) => a - b);
          const baseline = sorted[Math.floor(sorted.length / 2)];
          const histEl = document.createElement("section");
          histEl.className = "card pad pxhist";
          histEl.innerHTML = isEn
            ? `<h2 style="margin:0 0 .5rem;font-size:1rem">History (last ${rows.length} days)</h2>`
              + `<div class="vrspark">${spark(medians)}</div>`
              + `<p class="muted" style="margin:.4rem 0 0">Median over the period: ${baseline} PL</p>`
            : `<h2 style="margin:0 0 .5rem;font-size:1rem">Historique (${rows.length} derniers jours)</h2>`
              + `<div class="vrspark">${spark(medians)}</div>`
              + `<p class="muted" style="margin:.4rem 0 0">Médiane sur la période : ${baseline} PL</p>`;
          wrap.insertAdjacentElement("afterend", histEl);
          if (baseline > 0 && main.med <= Math.round(baseline * 0.85)) {
            const badges = root.querySelector(".objbadges");
            if (badges) {
              const deal = document.createElement("span");
              deal.className = "badge dealbadge";
              deal.textContent = isEn ? "🔥 Good deal" : "🔥 Bon plan";
              badges.appendChild(deal);
            }
          }
        }
      } catch (e) {}
    }
  })();
})();
