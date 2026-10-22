#!/usr/bin/env node
/* VoidRelay — noms FRANÇAIS officiels des pouvoirs (et descriptions) des Warframes → data/pouvoirs_fr.json (22/10/2026).

   Pourquoi : les pages de builds FR affichaient les pouvoirs en anglais (« Smoke Screen »,
   « Blade Storm ») alors que le joueur francophone lit « Écran de Fumée », « Tempête de Lames »
   en jeu. Source : l'export du jeu publié par WFCD warframe-items (Warframes.json + i18n/fr.json),
   la même que data/noms_fr.json pour les mods et arcanes. Vérifié le 22/10/2026 : Ash →
   Écran de Fumée, Téléportation, Tempête de Lames ; Mesa → Pacificateurs ; Nova → Lâcher d'Antimatière.

   Règle : aucun nom inventé. Seuls les pouvoirs dont le nom FR diffère de l'anglais sont écrits ;
   un pouvoir absent garde son nom anglais dans les gabarits.

   Usage :
     node scripts/generer_pouvoirs_fr.mjs                 # télécharge depuis GitHub
     WFCD_DIR=/chemin node scripts/generer_pouvoirs_fr.mjs  # fichiers déjà téléchargés
       (Warframes.json et fr.json dans ce dossier)
   puis `node scripts/generer_builds.mjs`. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "pouvoirs_fr.json");
const RAW = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/";

async function lire(distant, local) {
  if (process.env.WFCD_DIR) return JSON.parse(fs.readFileSync(path.join(process.env.WFCD_DIR, local), "utf8"));
  const r = await fetch(RAW + distant, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${distant} : HTTP ${r.status}`);
  return r.json();
}

const frames = await lire("Warframes.json", "Warframes.json");
const fr = await lire("i18n/fr.json", "fr.json");
if (!Array.isArray(frames) || !frames.length) throw new Error("Warframes.json vide ou illisible");

const pouvoirs = {}, descriptions = {};
let n = 0;
for (const w of frames) {
  // Description de la Warframe (texte du Codex) : les pages FR affichaient l'anglais (« Mirage's sleight of hand… »).
  const d = (fr[w.uniqueName] || {}).description;
  if (typeof d === "string" && d.trim() && d.trim() !== (w.description || "").trim()) descriptions[w.name] = d.trim();
  const trad = (fr[w.uniqueName] || {}).abilities || [];
  const parNom = {};
  for (const a of w.abilities || []) {
    const t = trad.find(b => b.abilityUniqueName === a.uniqueName);
    const nomFr = t && typeof t.abilityName === "string" ? t.abilityName.trim() : "";
    if (nomFr && nomFr !== a.name) { parNom[a.name] = nomFr; n++; }
  }
  if (Object.keys(parNom).length) pouvoirs[w.name] = parNom;
}
// Garde-fou : une source tronquée ne doit pas écraser une table complète.
if (Object.keys(pouvoirs).length < 50) throw new Error(`seulement ${Object.keys(pouvoirs).length} Warframes traduites : source incomplète, rien n'est écrit`);

const sortie = { source: "WFCD warframe-items (data/json/Warframes.json + i18n/fr.json)", pouvoirs, descriptions };
fs.writeFileSync(OUT, JSON.stringify(sortie, null, 0) + "\n");
console.log(`✅ ${Object.keys(pouvoirs).length} Warframes, ${n} noms de pouvoirs FR, ${Object.keys(descriptions).length} descriptions FR → ${path.relative(ROOT, OUT)}`);
