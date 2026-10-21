/* Garde-fou des cartes de mods des pages de builds (data/mods_cards.json), 21/10/2026.

   Deux défauts qui n'affichaient aucune erreur :
     1. un mod cité par generer_builds.mjs sans carte → la page tombait sur une pastille
        texte (modc-txt) sans image ni rang. 9 mods Primed manquaient (Primed Flow…) parce
        que le filtre de generer_mods_cards.py excluait /Expert/, où vivent tous les Primed ;
     2. un rang faux : Intensify et Stretch affichaient « 10/10 » (variante /Expert/) alors
        que le jeu et warframe.market disent 5.

   Les sources de mods sont lues avec les mêmes motifs que generer_mods_cards.py.

   node scripts/verifier_cartes_mods.mjs
*/
import { readFileSync, existsSync } from "node:fs";

const lire = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const src = lire("scripts/generer_builds.mjs");
const cartes = JSON.parse(lire("data/mods_cards.json"));

const cites = new Set();
for (const m of src.matchAll(/(?:mods|claws): \[([^\]]+)\]/g))
  for (const x of m[1].matchAll(/"([^"]+)"/g)) cites.add(x[1]);
for (const m of src.matchAll(/\.\.\.[\w.]+, "([^"]+)"\]/g)) cites.add(m[1]);
for (const m of src.matchAll(/(?:aura|exilus): "([^"]+)"/g)) cites.add(m[1]);

let ok = 0, ko = 0;
const dit = (b, t, d) => { if (b) { ok++; console.log("  ✓ " + t + (d ? " — " + d : "")); }
                           else { ko++; console.log("  ✗ " + t + (d ? " — " + d : "")); } };

const sans = [...cites].filter(n => !cartes[n]).sort();
dit(cites.size > 100, "mods cités lus dans generer_builds.mjs", cites.size + " noms");
dit(sans.length === 0, "chaque mod cité a sa carte", sans.length ? "sans carte : " + sans.join(", ") : cites.size + "/" + cites.size);

// Rangs max du jeu (wiki / maxRank warframe.market v2)
const RANGS = { "Primed Flow": "10/10", "Primed Continuity": "10/10", "Intensify": "5/5", "Stretch": "5/5",
                "Hellfire": "5/5", "Organ Shatter": "5/5" };
for (const [n, r] of Object.entries(RANGS)) dit(cartes[n]?.rk === r, `${n} = ${r}`, cartes[n]?.rk || "absent");

const jpg = Object.entries(cartes).filter(([, c]) => !c.img);
dit(jpg.length === 0, "chaque carte porte une image");
const manquantes = Object.values(cartes).map(c => c.img).filter(i => i && !existsSync(new URL("../assets/wfimg/" + i, import.meta.url)));
dit(manquantes.length === 0, "les images des cartes existent sur le disque", manquantes.slice(0, 5).join(", "));

console.log(`\n${ok} ✓ · ${ko} ✗`);
process.exit(ko ? 1 : 0);
