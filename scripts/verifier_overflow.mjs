/* ============================================================================
   VoidRelay — GARDE-FOU débordement horizontal (bloque une régression déjà
   vécue) : 09/07/2026, sweep exhaustif "ce qui est réellement rendu" cherchant
   la classe de bug la plus dangereuse suivante après le contraste AA. Trouvée :
   .foot .links (enfant flex de .foot .in{display:flex}) n'avait pas
   min-width:0 → piège flexbox/grid classique, un enfant flex/grid ne rétrécit
   jamais sous la largeur intrinsèque de son contenu même avec flex-wrap:wrap
   sur le parent. 12 pages débordaient de 21 à 180px en mobile (390px) —
   scroll horizontal invisible en desktop, cassé partout en mobile.

   Vérifie document.documentElement.scrollWidth <= innerWidth (+2px tolérance
   sous-pixel) sur les 3 systèmes CSS du site, en desktop ET mobile — un
   débordement horizontal n'a JAMAIS de raison d'exister sur un site
   responsive (hors carrousel explicitement scrollable, aucun ici).

   10/07/2026 : css/style.css passé à un échantillon DYNAMIQUE (détection
   d'arborescence + tri par taille de fichier, voir lib_decouverte_pages.mjs)
   — couvre /en/o/ ou toute arborescence future sans édition manuelle.

   Usage : node scripts/verifier_overflow.mjs [BASE_URL]
   Sortie : 0 = 0 débordement confirmé · 1 = au moins un (bloque).
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

// échantillon dynamique css/style.css (voir lib_decouverte_pages.mjs) : couvre
// /o/ et toute arborescence future (/en/o/…) sans liste figée à maintenir.
const ALL_PAGES = [
  ...samplePagesLinking(ROOT, 'pandaahh.css'),
  ...sampleAllObjectTrees(ROOT),
  '/widget/index.html', // page unique, pas une arborescence — listée en dur volontairement
  ...discoverPagesLinking(ROOT, 'css/hub.css'),
  '/embed/index.html', '/offline.html', '/404.html',
].filter(p => fs.existsSync(path.join(ROOT, p.slice(1))))
 .filter((p, i, arr) => arr.indexOf(p) === i).sort();

// 320 et 768 ajoutés le 28/09/2026 (v101) : à 390 seul, ce garde-fou restait vert alors que
// /hub (+64 px), /taches (+28), /compagnon (+36) débordaient à 320 et /marche (+40) à 768 —
// sa grille passe à 2 colonnes à 761 px, largeur qu'aucune des deux tailles ne touchait.
const VIEWPORTS = [['desktop', 1440, 900], ['tablette', 768, 1024], ['mobile', 390, 844], ['petit mobile', 320, 640]];

console.log(`🛡️  Garde-fou débordement horizontal — ${ALL_PAGES.length} pages × ${VIEWPORTS.length} tailles d'écran, base=${BASE}`);
if (noteBlocage()) console.log(noteBlocage());

const browser = await chromium.launch();
let totalOverflow = 0;

for (const [vp, w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await bloquerExterne(page);
  for (const p of ALL_PAGES) {
    await page.goto(BASE + p, { waitUntil: 'load', timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      if (docW <= winW + 2) return null;
      const culprits = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > winW + 2 && r.width > 0) {
          culprits.push({ tag: el.tagName, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40), right: Math.round(r.right) });
        }
      }
      culprits.sort((a, b) => b.right - a.right);
      return { docW, winW, overflow: docW - winW, culprits: culprits.slice(0, 2) };
    });
    if (result) {
      totalOverflow++;
      console.log(`❌ [${vp}] ${p} — déborde de ${result.overflow}px (doc=${result.docW} vs viewport=${result.winW})`);
      for (const c of result.culprits) console.log(`     <${c.tag.toLowerCase()}${c.cls ? '.' + c.cls.split(' ').join('.') : ''}> right=${c.right}px`);
    }
  }
  await ctx.close();
}
await browser.close();

console.log('----------------------------------------------------------------------');
if (totalOverflow > 0) {
  console.log(`💥 GARDE-FOU : ${totalOverflow} débordement(s) horizontal(aux) confirmé(s) — corriger avant de publier.`);
  process.exit(1);
}
console.log(`🛡️  GARDE-FOU : 0 débordement horizontal sur ${ALL_PAGES.length} pages × ${VIEWPORTS.length} tailles — OK.`);
process.exit(0);
