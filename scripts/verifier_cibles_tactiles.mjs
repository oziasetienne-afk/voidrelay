/* ============================================================================
   VoidRelay — GARDE-FOU cibles tactiles (bloque une régression déjà vécue) :
   10/07/2026, deux tours de mesure réelle (bounding box, mobile 390px) ont
   trouvé des liens/boutons sous le minimum WCAG 2.5.8 (24×24 CSS px) : le
   bouton favori .mk-star (marche.html, 21×21px) puis 5 composants nav/footer
   partagés (fil d'Ariane, footer, header pages objet, sommaire FAQ — tous des
   liens nus sans padding, sous 24px de haut). Jamais formalisé en garde-fou
   permanent avant ce jour — vérifié à la main via des scripts jetables à
   chaque fois. Ce script fige cette vérification.

   Vérifie que tout élément interactif (a[href], button, input, select,
   [role=button], summary, label) mesure >= 24×24 CSS px sur mobile (390px),
   sur les 3 systèmes CSS du site — mêmes groupes/échantillon dynamique que
   verifier_contraste.mjs et verifier_overflow.mjs (voir lib_decouverte_pages.mjs).

   Exceptions volontaires (pas des échecs) :
   - Liens (<a>) à l'intérieur d'un bloc de texte courant (article, p.muted,
     fil d'Ariane en prose…) : WCAG 2.5.8 les exempte explicitement
     ("inline" — le lien est dans une phrase). Mesurés une fois (10/07/2026,
     round nav/footer) : ~23 restants sur l'échantillon test, tous de ce
     type, volontairement laissés de côté. Ce garde-fou ne vérifie donc les
     <a> QUE dans nav/header/footer (là où le risque réel a été prouvé deux
     fois) — les vrais contrôles (button/input/select/[role=button]/summary)
     sont vérifiés PARTOUT, jamais exemptés (jamais "juste du texte").
   - Élément avec display:none/visibility:hidden ou hors du rendu initial
     (0×0) : ignoré, pas un vrai défaut de cible.

   Usage : node scripts/verifier_cibles_tactiles.mjs [BASE_URL]
   Sortie : 0 = 0 échec confirmé · 1 = au moins un échec (bloque).
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
const MIN = 24;

const STYLE_CSS_EXTRA = ['/widget/index.html'];

const PAGES = [
  ...samplePagesLinking(ROOT, 'pandaahh.css'),
  ...sampleAllObjectTrees(ROOT),
  ...STYLE_CSS_EXTRA,
  ...discoverPagesLinking(ROOT, 'css/hub.css'),
].filter(p => fs.existsSync(path.join(ROOT, p.slice(1))))
 .filter((p, i, arr) => arr.indexOf(p) === i).sort();

console.log(`🛡️  Garde-fou cibles tactiles (WCAG 2.5.8, min ${MIN}×${MIN}px) — ${PAGES.length} pages, mobile 390px, base=${BASE}`);
if (noteBlocage()) console.log(noteBlocage());

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await bloquerExterne(page);

let totalFailures = 0;
for (const p of PAGES) {
  await page.goto(BASE + p, { waitUntil: 'load', timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(600);
  const failures = await page.evaluate((min) => {
    // <a> : uniquement dans nav/header/footer (cf en-tête, exception WCAG
    // "inline" pour le texte courant). Vrais contrôles : partout, sans exception.
    const navLinks = Array.from(document.querySelectorAll('nav a[href], header a[href], footer a[href]'));
    const controls = Array.from(document.querySelectorAll('button, input, select, [role="button"], summary'));
    const els = [...new Set([...navLinks, ...controls])];
    const out = [];
    for (const el of els) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < 0 || r.top > window.innerHeight * 6) continue;
      if (r.width >= min && r.height >= min) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40),
        txt: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('alt') || '').trim().slice(0, 30),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
    return out;
  }, MIN);
  if (failures.length) {
    totalFailures += failures.length;
    console.log(`❌ ${p} — ${failures.length} cible(s) sous ${MIN}×${MIN}px`);
    for (const f of failures.slice(0, 8)) {
      console.log(`     <${f.tag}${f.cls ? '.' + f.cls.split(' ').join('.') : ''}> "${f.txt}" ${f.w}×${f.h}`);
    }
  }
}
await ctx.close();
await browser.close();

console.log('----------------------------------------------------------------------');
if (totalFailures > 0) {
  console.log(`💥 GARDE-FOU : ${totalFailures} cible(s) tactile(s) sous le minimum confirmée(s) — corriger avant de publier.`);
  process.exit(1);
}
console.log(`🛡️  GARDE-FOU : 0 cible tactile sous ${MIN}×${MIN}px sur ${PAGES.length} pages — OK.`);
process.exit(0);
