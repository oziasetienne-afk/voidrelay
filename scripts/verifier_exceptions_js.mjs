/* ============================================================================
   VoidRelay — GARDE-FOU : aucune page ne doit lever d'exception JavaScript.

   LE TROU QUE ÇA BOUCHE. Les quatre garde-fous de rendu (contraste,
   débordement, cibles tactiles, CLS) chargent déjà les pages dans un vrai
   navigateur — mais chacun ne regarde QUE sa mesure. Une exception JavaScript
   non rattrapée les laisse tous verts : la page s'affiche, sa mise en page est
   correcte, son contraste aussi… et la moitié de ses fonctions ne marche pas.
   Sur ce site, ça veut dire un estimateur qui ne calcule plus, une recherche
   qui n'ouvre plus, un build qui ne se charge plus — sans que rien ne le dise.

   Deux familles sont surveillées, et aucune n'est une question de goût :
     • une exception JS non rattrapée (`pageerror`) ;
     • une ressource DU SITE demandée et absente (404 sur localhost) — un
       script ou une feuille de style renommée casse la page en silence.

   Ce qui vient de l'EXTÉRIEUR est explicitement ignoré : polices Google,
   régie publicitaire, warframestat, warframe.market. Leur indisponibilité est
   un fait du réseau, pas un défaut du site, et la faire échouer ici rendrait
   le garde-fou ininterprétable — c'est exactement le piège documenté dans
   lib_blocage_externe.mjs.

   ON N'ACCUSE LE SITE QUE QUAND ON PEUT LE MONTRER (05/09/2026). La première
   version de ce garde-fou comptait TOUTE exception, d'où qu'elle vienne. En CI
   — où les ressources tierces se chargent vraiment, contrairement au scan local
   — elle a déclaré 109 pages fautives sur 112, toutes avec le même message :
   « Uncaught (in promise) undefined ». Les 3 rescapées étaient EXACTEMENT les
   3 pages de l'échantillon qui ne portent pas le script publicitaire (404,
   embed, offline). La corrélation est parfaite : le rejet vient de la régie,
   pas du site.

   Un rejet de promesse avec une valeur qui n'est pas une Error n'a AUCUNE pile
   d'appel — il est donc impossible d'en désigner l'auteur. La règle est
   maintenant : une exception ne compte que si sa pile mentionne un script
   SERVI PAR LE SITE. Ce qu'on perd est assumé et dit ici : une erreur du site
   lancée comme `throw undefined` passerait entre les mailles. C'est une
   pratique que ce dépôt n'a nulle part, et l'alternative — accuser le site de
   ce que fait la régie — rend le garde-fou inutilisable, donc ignoré.

   Les rejets non attribuables ne sont pas cachés pour autant : ils sont
   comptés et affichés en fin de scan.

   Usage : node scripts/verifier_exceptions_js.mjs [BASE_URL]
   Sortie : 0 = aucune page fautive · 1 = au moins une (bloque).
   Dépendance : playwright (même montage que verifier_overflow.mjs).
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

/* Même échantillon que le garde-fou de débordement : les trois systèmes CSS
   du site, plus une détection générique des arborescences de pages objet. Une
   liste figée ne verrait jamais /en/o/ ni ce qui viendra après. */
const PAGES = [
  ...samplePagesLinking(ROOT, 'pandaahh.css'),
  ...sampleAllObjectTrees(ROOT),
  '/widget/index.html',
  ...discoverPagesLinking(ROOT, 'css/hub.css'),
  '/embed/index.html', '/offline.html', '/404.html',
].filter(p => fs.existsSync(path.join(ROOT, p.slice(1))))
 .filter((p, i, arr) => arr.indexOf(p) === i).sort();

console.log(`🛡️  Garde-fou exceptions JavaScript — ${PAGES.length} pages, base=${BASE}`);
if (noteBlocage()) console.log(noteBlocage());

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const fautives = [];

/* Une ligne toutes les 20 pages : le scan dure plusieurs minutes et n'affichait
   RIEN jusqu'au verdict — impossible de distinguer « ça travaille » de « c'est
   bloqué ». Assez rare pour ne pas noyer la sortie en CI. */
let faites = 0;
let nonAttribuables = 0;
for (const p of PAGES) {
  if (faites && faites % 20 === 0) console.log(`   … ${faites}/${PAGES.length} pages`);
  faites++;
  const page = await ctx.newPage();
  await bloquerExterne(page);
  const exceptions = [];
  const manquants = [];
  page.on('pageerror', e => {
    const pile = (e && e.stack) || '';
    /* La pile désigne-t-elle un fichier servi par le site ? Sans pile, on ne
       peut désigner personne — et accuser le site serait une invention. */
    if (pile.includes(BASE)) exceptions.push(String(e).split('\n')[0].slice(0, 160));
    else nonAttribuables++;
  });
  /* Uniquement les ressources SERVIES PAR LE SITE : une 404 externe ne nous
     appartient pas, une 404 interne est toujours notre faute. */
  page.on('response', r => {
    if (r.status() >= 400 && r.url().startsWith(BASE)) manquants.push(r.status() + ' ' + r.url().slice(BASE.length));
  });
  await page.goto(BASE + p, { waitUntil: 'load', timeout: 30000 }).catch(e => exceptions.push('navigation : ' + e.message.split('\n')[0].slice(0, 100)));
  /* Laisser tourner l'initialisation : la plupart des scripts du site
     travaillent après DOMContentLoaded (recherche, thème, profil, hydratation
     des prix). Une exception levée là est aussi grave qu'une au chargement. */
  await page.waitForTimeout(1200);
  const lignes = [...new Set([...exceptions, ...manquants])];
  if (lignes.length) fautives.push({ page: p, lignes });
  await page.close();
}
await navigateur.close();

if (fautives.length) {
  console.log('----------------------------------------------------------------------');
  for (const f of fautives) {
    console.log('  ✗ ' + f.page);
    for (const l of f.lignes.slice(0, 5)) console.log('      ' + l);
  }
  console.log('----------------------------------------------------------------------');
  if (nonAttribuables) console.log('   (' + nonAttribuables + " rejet(s) sans pile d'appel ignorés, non imputables au site)");
  console.log('💥 GARDE-FOU : ' + fautives.length + ' page(s) lèvent une exception imputable au site ou demandent un fichier absent.');
  process.exit(1);
}
console.log('----------------------------------------------------------------------');
if (nonAttribuables) console.log('   (' + nonAttribuables + " rejet(s) sans pile d'appel, non imputables au site — régie publicitaire et scripts tiers)");
console.log('🛡️  GARDE-FOU : les ' + PAGES.length + ' pages se chargent sans une seule exception imputable au site — OK.');
process.exit(0);
