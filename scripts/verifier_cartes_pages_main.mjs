/* Garde-fou des 22 builds FR faits main (sans marqueur vr-builds-gen), 21/10/2026.

   Ces pages échappent au générateur : elles avaient gardé 192 noms de mods en anglais malgré
   data/noms_fr.json et 34 rangs faux (10/10 au lieu de 5/5). Pour chaque carte .modc :
     • si un nom FR existe, le nom affiché est le nom FR (et l'anglais reste dans le title) ;
     • le rang vaut celui de data/mods_cards.json ;
     • la polarité (svg) est dans <span class="pol"> (sinon elle n'est pas positionnée, donc invisible) ;
     • un mod qui a une image dans mods_cards.json n'est pas une carte texte.
   Pour corriger : node scripts/harmoniser_pages_main.mjs

   node scripts/verifier_cartes_pages_main.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nomFr } from "./lib_noms_fr.mjs";
import { pagesMain } from "./harmoniser_pages_main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARTES = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "mods_cards.json"), "utf8"));
const dec = s => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const CARTE = /<div class="modc( modc-txt)?" title="([^"]*)">((?:(?!<\/div>).)*)<\/div>/gs;

const erreurs = [];
const pages = pagesMain();
for (const rel of pages) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  for (const [, txt, titre, corps] of html.matchAll(CARTE)) {
    const nm = (corps.match(/<span class="nm">(.*?)<\/span>(?=<span class="fx">|$)/s) || [])[1] || "";
    const en = dec((nm.match(/<span class="en" lang="en">(.*?)<\/span>/) || [])[1] || titre);
    const fr = nomFr(en, false);
    if (fr && !nm.includes('class="en"')) erreurs.push(`${rel} : « ${en} » affiché en anglais (FR : ${fr})`);
    if (/<svg/.test(corps.replace(/<span class="pol"><svg.*?<\/svg><\/span>/gs, ""))) erreurs.push(`${rel} : « ${en} » polarité (svg) hors de <span class="pol"> : elle ne s'affiche pas`);
    const m = CARTES[en], rk = (corps.match(/<span class="rk">(.*?)<\/span>/) || [])[1];
    if (m && rk !== m.rk) erreurs.push(`${rel} : « ${en} » rang ${rk} au lieu de ${m.rk}`);
    if (m && txt) erreurs.push(`${rel} : « ${en} » est une carte texte alors qu'une image existe`);
  }
}
console.log(`${pages.length} pages faites main, ${erreurs.length} écart(s)`);
erreurs.slice(0, 15).forEach(e => console.log("  ✗ " + e));
process.exit(erreurs.length ? 1 : 0);
