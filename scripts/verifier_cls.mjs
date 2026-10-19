/* ============================================================================
   VoidRelay — GARDE-FOU CLS / Cumulative Layout Shift (bloque une régression
   déjà vécue) : 10/07/2026, deux bugs trouvés à la main via mesure réelle
   répétée (PerformanceObserver, l'API que Google utilise pour le score Core
   Web Vitals) : le swap de police web (65 pages, CLS jusqu'à 1.03) et des
   sections remplies en JS après le 1er rendu sans espace réservé (hub.html
   #grid, marche.html .mk-col — CLS 0.19 et 0.12 constants). Jamais formalisé
   en garde-fou permanent avant ce jour — mesuré à la main à chaque round.

   MÉTHODE ANTI-BRUIT (leçon vécue plusieurs fois cette session) : les pages
   avec AdSense en direct ont un CLS qui varie énormément d'un chargement à
   l'autre (0.11 à 1.00 vus sur la MÊME page/conditions). Une seule mesure
   ne prouve rien. Ce script répète chaque page 3× et prend la MÉDIANE (pas
   la moyenne, pas le max) — un pic isolé de bruit pub ne fait pas basculer
   la médiane, un vrai bug de layout, lui, est constant sur les 3 essais.

   ÉCHANTILLONNAGE (coût : mesurer le CLS est lent — page.goto + 2.5s
   d'attente × 3 répétitions par page — contrairement au contraste/débordement
   qui sont quasi instantanés) :
     - css/pandaahh.css : UNIQUEMENT les pages qui chargent un script de
       données dynamiques (js/api.js, js/data.js, js/app.js, js/views.js,
       js/alerts.js) ou contiennent fetch(...) — le risque CLS "section
       async" ne touche QUE les pages qui rendent du contenu après le 1er
       paint. Les pages de contenu statique (guides, FAQ texte) n'ont pas ce
       risque structurel (vérifié : le bug trouvé était toujours un
       conteneur vide->rempli par fetch, jamais du contenu statique qui bouge).
     - css/style.css : même échantillon dynamique (taille de fichier) que les
       autres garde-fous — voir lib_decouverte_pages.mjs.
     - css/hub.css : toutes les pages (4-5, peu coûteux de tout tester).
   Mobile uniquement (390px) : dans toutes les mesures de cette session, le
   CLS mobile a toujours été >= au CLS desktop sur les mêmes pages — le pire
   cas est mobile, donc le cas testé par ce garde-fou.

   Seuil : médiane >= 0.1 (seuil "bon" officiel Core Web Vitals) = échec.

   Usage : node scripts/verifier_cls.mjs [BASE_URL]
   Sortie : 0 = 0 échec confirmé · 1 = au moins un échec médian (bloque).
   Dépendance : playwright (voir scripts/verifier_contraste.mjs, même setup).
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
const THRESHOLD = 0.1;
const REPS = 3;

const FETCH_RISK = /fetch\(|js\/api\.js|js\/data\.js|js\/app\.js|js\/views\.js|js\/alerts\.js/;
function hasFetchRisk(relPath) {
  try { return FETCH_RISK.test(fs.readFileSync(path.join(ROOT, relPath.slice(1)), 'utf8')); }
  catch { return false; }
}

const PAGES = [
  ...samplePagesLinking(ROOT, 'pandaahh.css').filter(hasFetchRisk),
  ...sampleAllObjectTrees(ROOT),
  '/widget/index.html',
  ...discoverPagesLinking(ROOT, 'css/hub.css'),
].filter(p => fs.existsSync(path.join(ROOT, p.slice(1))))
 .filter((p, i, arr) => arr.indexOf(p) === i).sort();

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

console.log(`🛡️  Garde-fou CLS (Cumulative Layout Shift, seuil ${THRESHOLD}) — ${PAGES.length} pages × ${REPS} essais (médiane), mobile 390px, base=${BASE}`);
if (noteBlocage()) console.log(noteBlocage());

const browser = await chromium.launch();
let totalFailures = 0;

for (const p of PAGES) {
  const samples = [];
  const coupables = [];
  const chronos = [];
  for (let i = 0; i < REPS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await bloquerExterne(page);
    // QUI a bougé, pas seulement de combien (03/09/2026) : sans le nom des
    // éléments déplacés, un échec ici ne dit pas s'il vient d'un conteneur
    // rempli en JS, d'une image sans dimensions ou du script publicitaire —
    // trois causes aux correctifs opposés, et impossible à départager en
    // local puisqu'aucune ressource externe n'y est joignable.
    await page.addInitScript(() => {
      window.__cls = 0;
      window.__src = {};
      const nom = (n) => {
        if (!n || n.nodeType !== 1) return '?';
        return n.tagName.toLowerCase()
          + (n.id ? '#' + n.id : '')
          + (n.classList && n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '');
      };
      window.__chrono = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__cls += e.value;
          // Distance réelle du plus gros déplacement de cette secousse : c'est
          // elle qui dit s'il s'agit d'un bandeau inséré (~100 px et plus) ou
          // d'un simple reflow de texte.
          let dist = 0;
          for (const s of e.sources || []) {
            const k = nom(s.node);
            window.__src[k] = +((window.__src[k] || 0) + e.value).toFixed(4);
            if (s.previousRect && s.currentRect) {
              dist = Math.max(dist, Math.abs(s.currentRect.top - s.previousRect.top));
            }
          }
          // Compté À L'INSTANT DE LA SECOUSSE, et non à la fin de la mesure :
          // Auto ads insère un bloc, ne le remplit pas, puis le replie à 0 —
          // lu 2,5 s plus tard il paraît innocent. Erreur commise le
          // 03/09/2026, corrigée ici.
          var pubN = document.querySelectorAll('ins.adsbygoogle, .google-auto-placed, [data-google-query-id]');
          var pubH = 0;
          pubN.forEach(function (n) { pubH += n.getBoundingClientRect().height; });
          window.__chrono.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), d: Math.round(dist),
            pn: pubN.length, ph: Math.round(pubH) });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(BASE + p, { waitUntil: 'load', timeout: 45000 }).catch(() => null);
    await page.waitForTimeout(2500);
    const mesure = await page.evaluate(() => ({
      cls: window.__cls,
      src: window.__src,
      chrono: window.__chrono,
      // Une annonce Auto ads insérée dans le flux est la seule cause de
      // décalage qu'on ne maîtrise pas depuis le HTML : il faut savoir si
      // elle est là AVANT de conclure que la mise en page est en cause.
      pub: document.querySelectorAll('ins.adsbygoogle, .google-auto-placed, [data-google-query-id]').length,
      // Leur HAUTEUR : si elle égale le déplacement mesuré, la démonstration
      // est close — c'est le bloc inséré qui a poussé la page, pas nous.
      pubH: [...document.querySelectorAll('ins.adsbygoogle, .google-auto-placed, [data-google-query-id]')]
        .map((e) => Math.round(e.getBoundingClientRect().height)),
    }));
    samples.push(mesure.cls);
    coupables.push(mesure.src);
    chronos.push(mesure);
    await ctx.close();
  }
  const med = median(samples);
  if (med >= THRESHOLD) {
    totalFailures++;
    console.log(`❌ ${p} — CLS médian ${med.toFixed(4)} (essais: ${samples.map(s => s.toFixed(4)).join(', ')})`);
    const cumul = {};
    for (const s of coupables) for (const [k, v] of Object.entries(s || {})) cumul[k] = (cumul[k] || 0) + v;
    const top = Object.entries(cumul).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [k, v] of top) console.log(`     ${(v / REPS).toFixed(4)} <${k}>`);
    const pire = chronos.reduce((a, c) => (c.cls > (a ? a.cls : -1) ? c : a), null);
    if (pire) {
      console.log(`     essai le pire : ${pire.pub} bloc(s) publicitaire(s) en FIN de mesure` +
        (pire.pubH && pire.pubH.length ? ` — hauteur(s) ${pire.pubH.join(', ')}px` : '') +
        ' (la hauteur au moment de la secousse est la seule qui compte, voir ci-dessous)');
      for (const c of (pire.chrono || []).slice(0, 5)) {
        console.log(`       t=${c.t}ms  valeur ${c.v}  deplacement ${c.d}px` +
          `  · pub à cet instant : ${c.pn} bloc(s), ${c.ph}px`);
      }
    }
  }
}
await browser.close();

console.log('----------------------------------------------------------------------');
if (totalFailures > 0) {
  console.log(`💥 GARDE-FOU : ${totalFailures} page(s) avec CLS médian >= ${THRESHOLD} confirmée(s) — corriger avant de publier.`);
  process.exit(1);
}
console.log(`🛡️  GARDE-FOU : CLS médian < ${THRESHOLD} sur ${PAGES.length} pages — OK.`);
process.exit(0);
