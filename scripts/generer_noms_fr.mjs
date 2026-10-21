#!/usr/bin/env node
/* VoidRelay — noms FRANÇAIS officiels des mods et arcanes → data/noms_fr.json (21/10/2026).

   Pourquoi : les pages FR (builds, guides, fiches /o/) affichaient les noms anglais des
   mods et arcanes (« Enhanced Vitality », « Arcane Energize ») alors que le public joue en
   français. Le catalogue de l'arsenal (data/arsenal/mods.json, 605 mods) a déjà ces noms
   mais ne couvre que les mods simulés : 33 des 137 cartes de builds y manquaient (Vacuum,
   Guardian, Regen, Cutting Edge…). Ici on lit la MÊME source, en entier : les fichiers
   i18n du projet communautaire WFCD warframe-items (textes du jeu), 1 809 mods + 172 arcanes.

   Règle : aucun nom inventé. Un objet sans traduction, ou dont la traduction est identique
   à l'anglais, n'est PAS dans `mods`/`arcanes` : les gabarits gardent alors l'anglais.
   Les noms identiques sont listés dans `identiques` pour que le rapport puisse les distinguer
   d'un objet inconnu du catalogue.

   À relancer à la main après une mise à jour du jeu (pas de cron : les noms bougent peu) :
     node scripts/generer_noms_fr.mjs
   puis `node scripts/generer_builds.mjs` et `node scripts/generer_pages_objets.mjs --force`. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "noms_fr.json");
// i18n.json (fichier unique) a disparu du dépôt WFCD : les traductions sont par langue depuis
// 2026 (data/json/i18n/fr.json, ~4,5 Mo). generer_arcanes.mjs pointe encore l'ancien chemin.
const RAW = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/";

async function lire(nom) {
  const r = await fetch(RAW + nom, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${nom} : HTTP ${r.status}`);
  return r.json();
}

/* « Même nom » au sens utile : on ignore la casse, les espaces et la ponctuation, mais PAS les
   accents (« Préparation » est bien une traduction de « Preparation »). Mesuré sur la source :
   « Full Contact » → « Full-Contact », « Rain Of Arrows » → « Rain of Arrows », « Kaal-Zidi » →
   « Kaal-zidi » ne sont pas des traductions ; « PROTECTIVE SLING » (tout en capitales) non plus. */
const forme = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const pseudoTraduction = (en, fr) => forme(en) === forme(fr) || (fr === fr.toUpperCase() && /\p{L}{4,}/u.test(fr));

function tableau(items, fr) {
  const noms = {}, identiques = new Set();
  for (const it of items) {
    if (!it.name || !it.uniqueName) continue;
    const t = fr[it.uniqueName];
    const nomFr = t && typeof t.name === "string" ? t.name.trim() : "";
    if (!nomFr) continue;
    if (pseudoTraduction(it.name, nomFr)) { identiques.add(it.name); continue; }
    // Deux uniqueName pour un même nom EN (variantes de cartes) : la 1re traduction gagne,
    // et on n'écrase jamais une traduction par une autre différente sans le dire.
    if (noms[it.name] && noms[it.name] !== nomFr) { console.warn(`⚠️ ${it.name} : « ${noms[it.name]} » vs « ${nomFr} » — la 1re est gardée`); continue; }
    noms[it.name] = nomFr;
  }
  return { noms, identiques };
}

async function main() {
  const [mods, arcanes, fr] = await Promise.all([lire("Mods.json"), lire("Arcanes.json"), lire("i18n/fr.json")]);
  if (!Array.isArray(mods) || mods.length < 1000 || !Array.isArray(arcanes) || arcanes.length < 100) {
    throw new Error(`source suspecte : ${mods.length} mods, ${arcanes.length} arcanes — abandon (on garde l'ancien fichier)`);
  }
  const m = tableau(mods, fr), a = tableau(arcanes, fr);
  // i18n/fr.json vide, tronqué ou d'un autre schéma → zéro nom, et une régénération repasserait
  // tout le site FR en anglais sans qu'aucun test rougisse. Mesuré le 21/10/2026 : 1 363 et 151.
  if (Object.keys(m.noms).length < 1000 || Object.keys(a.noms).length < 100) {
    throw new Error(`traductions suspectes : ${Object.keys(m.noms).length} mods, ${Object.keys(a.noms).length} arcanes — abandon (on garde l'ancien fichier)`);
  }
  const trie = o => Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)));
  const sortie = {
    source: "WFCD warframe-items (data/json/Mods.json, Arcanes.json, i18n/fr.json)",
    mods: trie(m.noms),
    arcanes: trie(a.noms),
    identiques: [...new Set([...m.identiques, ...a.identiques])].sort(),
  };
  fs.writeFileSync(OUT, JSON.stringify(sortie, null, 1) + "\n");
  console.log(`✅ data/noms_fr.json : ${Object.keys(sortie.mods).length} mods et ${Object.keys(sortie.arcanes).length} arcanes avec un nom FR distinct, ${sortie.identiques.length} noms identiques FR = EN (sur ${mods.length} mods + ${arcanes.length} arcanes WFCD).`);
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
