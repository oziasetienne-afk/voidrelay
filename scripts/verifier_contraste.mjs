/* ============================================================================
   VoidRelay — GARDE-FOU contraste AA (bloque une régression déjà vécue) :
   09/07/2026, une refonte a rendu certains fonds de carte thématisables
   (var(--surface)) sans mettre à jour le texte fixe pensé pour l'ancien fond
   toujours sombre (.fcard h3{color:#fff} → titres invisibles en thème clair).
   Un sweep exhaustif a ensuite trouvé 8+ variantes du même bug de classe,
   dont une planquée dans un fallback de variable CSS jamais définie
   (var(--panel,#0e141b)). Ce script calcule le contraste RÉELLEMENT rendu
   par le navigateur (pas les tokens supposés), en clair ET en sombre, sur
   les trois systèmes CSS du site :
     - css/pandaahh.css   : toutes les pages (découverte dynamique par grep)
     - css/style.css      : toute arborescence "pages objet" détectée
       dynamiquement (dossier .html à plat + sous-dossier c/ + réf. style.css)
       échantillonnée par taille de fichier — voir lib_decouverte_pages.mjs
       pour la justification complète (le type d'objet n'a AUCUN impact
       structurel, vérifié par diff ; seule la longueur du texte compte).
       Couvre /o/ aujourd'hui et /en/o/ (ou toute arborescence future)
       automatiquement, sans liste figée.
     - css/hub.css        : les pages (découverte dynamique), toujours
       sombre (pas de bascule de thème atteignable) → un seul thème testé

   Usage : node scripts/verifier_contraste.mjs [BASE_URL]
     BASE_URL par défaut : http://localhost:8901 (voir verifier_contraste.sh
     qui démarre un serveur statique temporaire si besoin).
   Sortie : 0 = 0 échec AA confirmé · 1 = au moins un échec (bloque).
   Dépendance : playwright (npx playwright install chromium si absent).
   ========================================================================== */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverPagesLinking, samplePagesLinking, sampleAllObjectTrees } from './lib_decouverte_pages.mjs';
import { bloquerExterne, noteBlocage } from './lib_blocage_externe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = process.argv[2] || 'http://localhost:8901';

// widget/index.html a sa propre surcouche de style en plus de style.css —
// page unique, pas une arborescence qui grandit, donc listée explicitement
// (le problème que ce garde-fou résout, c'est la dérive d'une liste qui DEVRAIT
// grandir avec le catalogue, pas l'existence de quelques pages ponctuelles).
const STYLE_CSS_EXTRA = ['/widget/index.html'];

const GROUPS = [
  {
    name: 'css/pandaahh.css',
    pages: samplePagesLinking(ROOT, 'pandaahh.css'),
    themes: ['dark', 'light'],
    setTheme: (page, t) => page.evaluate(th => document.documentElement.setAttribute('data-theme', th), t),
  },
  {
    name: 'css/style.css (échantillon dynamique)',
    pages: [...sampleAllObjectTrees(ROOT), ...STYLE_CSS_EXTRA].filter(p => fs.existsSync(path.join(ROOT, p.slice(1)))),
    themes: ['dark', 'light'],
    /* 26/09/2026 : bascule par data-theme sur <html>, comme le fait VRAIMENT le site
       (localStorage vr-theme → attribut, depuis le 16/07). L'ancienne bascule par
       body.light testait le clair de l'ex-SPA, que plus aucun visiteur ne voit : elle
       donnait au h1 un dégradé marine lisible, pendant que le vrai clair l'affichait en
       blanc sur fond clair sur 3 838 pages. */
    setTheme: (page, t) => page.evaluate(th => { document.body.classList.remove('light'); document.documentElement.setAttribute('data-theme', th); }, t),
  },
  {
    name: 'css/hub.css',
    pages: discoverPagesLinking(ROOT, 'css/hub.css'),
    themes: ['dark'], // pas de bascule de thème atteignable sur ces pages
    setTheme: async () => {},
  },
];

async function checkPage(page, path_, setTheme, theme) {
  await page.goto(BASE + path_, { waitUntil: 'load', timeout: 30000 }).catch(() => null);
  // 15/07/2026 : neutralise transitions/animations AVANT la bascule de thème. Le flip à chaud
  // (setAttribute) + waitForTimeout(300) mesurait des couleurs À MI-TRANSITION quand la machine
  // est chargée (vu à 3124 chargements : topnav à 1.11:1 sur des pages ALÉATOIRES d'un run à
  // l'autre, alors qu'un chargement propre du même thème mesure 17:1). On veut vérifier l'état
  // FINAL du thème — pas la course entre le flip et la transition .15s de pandaahh.
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' }).catch(() => null);
  await setTheme(page, theme);
  await page.waitForTimeout(300);

  return page.evaluate(() => {
    function relLum([r, g, b]) {
      const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
      const [R, G, B] = [f(r), f(g), f(b)];
      return .2126 * R + .7152 * G + .0722 * B;
    }
    function parseRGB(str) {
      str = (str || '').trim();
      let m = str.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (m) return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), m[4] !== undefined ? parseFloat(m[4]) : 1];
      m = str.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
      if (m) {
        let hex = m[1]; if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
      }
      return null;
    }
    const rootBg = parseRGB(getComputedStyle(document.body).getPropertyValue('--bg').trim()) || [255, 255, 255, 1];
    function findBg(el) {
      let node = el, composite = false;
      while (node) {
        const st = getComputedStyle(node);
        const c = parseRGB(st.backgroundColor);
        if (c && c[3] > 0.5) return { bg: c.slice(0, 3), composite };
        if (st.backgroundImage && st.backgroundImage !== 'none') composite = true;
        node = node.parentElement;
      }
      return { bg: rootBg.slice(0, 3), composite };
    }
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.children.length > 0) continue;
      const text = (el.textContent || '').trim();
      if (!text || text.length < 2) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const fg = parseRGB(st.color);
      if (!fg) continue;
      const { bg, composite } = findBg(el);
      if (composite) continue; // fond gradient/image : hors périmètre mécanique, vérifié visuellement ailleurs
      const L1 = relLum(fg) + 0.05, L2 = relLum(bg) + 0.05;
      const ratio = Math.max(L1, L2) / Math.min(L1, L2);
      const fontSize = parseFloat(st.fontSize);
      const fontWeight = parseInt(st.fontWeight) || 400;
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const min = isLarge ? 3.0 : 4.5;
      if (ratio < min) {
        out.push({
          text: text.slice(0, 50), ratio: ratio.toFixed(2), min,
          cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40),
        });
      }
    }
    /* Texte peint par DÉGRADÉ (background-clip:text, couleur transparente) — 26/09/2026.
       Deux angles morts cumulés laissaient passer le titre des 3 838 pages /o/ en blanc
       sur fond clair : la boucle ci-dessus ne lit que les FEUILLES (ce h1 contient des
       boutons injectés) et prend `color`, qui vaut ici « transparent ». La couleur vue est
       celle des arrêts du dégradé : on mesure le PIRE arrêt contre le fond du PARENT (le
       dégradé de l'élément est son texte, pas son fond). */
    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      const clip = (st.webkitBackgroundClip || st.backgroundClip || '').includes('text');
      if (!clip || !/gradient/.test(st.backgroundImage)) continue;
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) === 0) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (own.length < 2) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const stops = (st.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(parseRGB).filter(Boolean);
      if (!stops.length) continue;
      /* Fond en dégradé (le body clair en est un) : on le ramène à --bg, sa teinte de
         base. Sauter, comme la boucle des feuilles, c'était précisément laisser passer
         un titre blanc sur un fond presque blanc. */
      const trouve = findBg(el.parentElement || document.body);
      const bg = trouve.composite ? rootBg.slice(0, 3) : trouve.bg;
      const L2 = relLum(bg) + 0.05;
      const pire = Math.min(...stops.map(c => { const L1 = relLum(c) + 0.05; return Math.max(L1, L2) / Math.min(L1, L2); }));
      const fontSize = parseFloat(st.fontSize), fontWeight = parseInt(st.fontWeight) || 400;
      const min = (fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)) ? 3.0 : 4.5;
      if (pire < min) out.push({ text: own.slice(0, 50), ratio: pire.toFixed(2), min,
        cls: 'dégradé ' + el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.slice(0, 30) : '') });
    }
    const seen = new Set();
    return out.filter(f => { const k = f.cls + f.text; if (seen.has(k)) return false; seen.add(k); return true; });
  });
}

const totalPageLoads = GROUPS.reduce((s, g) => s + g.pages.length * g.themes.length, 0);
console.log(`🛡️  Garde-fou contraste — 3 systèmes CSS, ${totalPageLoads} chargements de page, base=${BASE}`);
if (noteBlocage()) console.log(noteBlocage());
for (const g of GROUPS) console.log(`   ${g.name} : ${g.pages.length} page(s) × ${g.themes.length} thème(s)`);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await bloquerExterne(page);

let totalFailures = 0;
for (const g of GROUPS) {
  for (const p of g.pages) {
    for (const theme of g.themes) {
      const failures = await checkPage(page, p, g.setTheme, theme);
      if (failures.length) {
        totalFailures += failures.length;
        console.log(`❌ [${g.name}] ${p} [${theme}] — ${failures.length} échec(s) AA`);
        for (const f of failures.slice(0, 6)) {
          console.log(`     ${f.ratio}:1 (min ${f.min}) <.${f.cls || '(sans classe)'}> "${f.text}"`);
        }
      }
    }
  }
}
await browser.close();

console.log('----------------------------------------------------------------------');
if (totalFailures > 0) {
  console.log(`💥 GARDE-FOU : ${totalFailures} échec(s) AA confirmé(s) — corriger avant de publier.`);
  process.exit(1);
}
console.log(`🛡️  GARDE-FOU : 0 échec AA sur ${totalPageLoads} chargements de page — OK.`);
process.exit(0);
