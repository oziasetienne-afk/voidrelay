#!/usr/bin/env node
/* Enrichit data/arsenal/warframes.json avec les STATS PAR CAPACITÉ du wiki
   officiel (17/07/2026, demande de l'admin : « je veux voir les stats des pouvoirs »).

   Source : la page wiki de chaque capacité (wiki.warframe.com/w/<Nom>?action=raw)
   porte un template {{AbilityUxx | strength = … | duration = … | range = … }}
   avec les valeurs PAR RANG (0/1/2/3) et leur libellé. Le NOM DU CHAMP dit quelle
   statistique de pouvoir le multiplie : strength → Puissance, duration → Durée,
   range → Portée (règle du jeu affichée sur ces mêmes pages via {{Stat|…}}).

   On garde le RANG MAX de chaque valeur + unité + libellé, taggée du type de
   scaling. Champ misc / lignes illisibles → PAS de chiffre inventé (honnêteté) :
   la capacité reste simplement sans cette ligne. Écrit abilities[k].st :
   [{t:"str"|"dur"|"rng", v:350, u:"%", l:"Scorn max armor bonus"}, …]. */
import fs from "node:fs";

const FICHIER = new URL("../data/arsenal/warframes.json", import.meta.url);
const frames = JSON.parse(fs.readFileSync(FICHIER, "utf8"));

const CHAMPS = { strength: "str", duration: "dur", range: "rng" };
const cache = new Map();

async function pageBrute(nom) {
  if (cache.has(nom)) return cache.get(nom);
  const url = `https://wiki.warframe.com/w/${encodeURIComponent(nom.replace(/ /g, "_"))}?action=raw`;
  let txt = null;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "voidrelay-data/1.0" } });
    if (r.ok) txt = await r.text();
  } catch {}
  cache.set(nom, txt);
  return txt;
}

function champTemplate(txt, champ) {
  // « | strength = … » jusqu'au prochain « \n| » de premier niveau du template
  const re = new RegExp(`\\|\\s*${champ}\\s*=\\s*([^\\n]*(?:\\n(?!\\s*\\|)[^\\n]*)*)`, "i");
  const m = re.exec(txt);
  return m ? m[1].trim() : null;
}

function parseLignes(brut, type) {
  // lignes séparées par <br> ; chaque ligne : « v0 / v1 / v2 / v3 unité (libellé) »
  const out = [];
  for (const ligne of brut.split(/<br\s*\/?\s*>/i)) {
    const propre = ligne.replace(/\{\{[^}]*\}\}/g, "").replace(/'''|''/g, "").trim();
    if (!propre) continue;
    const m = /^([\d.,]+(?:\s*\/\s*[\d.,]+)*)\s*([%a-zA-Z°\/]*)\s*(?:\(([^)]+)\))?/.exec(propre);
    if (!m) continue;
    const vals = m[1].split("/").map((v) => parseFloat(v.replace(",", ".").trim()));
    const v = vals[vals.length - 1]; // rang max de la capacité
    if (!Number.isFinite(v)) continue;
    out.push({ t: type, v, u: (m[2] || "").trim() || null, l: (m[3] || "").trim() || null });
  }
  return out;
}

let faits = 0, sans = 0, echecs = 0;
const noms = new Set();
for (const w of frames) for (const a of w.abilities || []) noms.add(a.n);
console.log(`${noms.size} capacités uniques à enrichir…`);

// petits paquets pour rester poli avec le wiki
const liste = [...noms];
const stats = new Map();
for (let i = 0; i < liste.length; i += 6) {
  await Promise.all(liste.slice(i, i + 6).map(async (nom) => {
    const txt = await pageBrute(nom);
    if (!txt || !/\{\{Ability/i.test(txt)) { echecs++; return; }
    const st = [];
    for (const [champ, type] of Object.entries(CHAMPS)) {
      const brut = champTemplate(txt, champ);
      if (brut) st.push(...parseLignes(brut, type));
    }
    if (st.length) stats.set(nom, st.slice(0, 8)); // garde-fou : 8 lignes max
  }));
  if (i % 60 === 0) console.log(`  … ${Math.min(i + 6, liste.length)}/${liste.length}`);
}

for (const w of frames) {
  for (const a of w.abilities || []) {
    const st = stats.get(a.n);
    if (st) { a.st = st; faits++; } else { delete a.st; sans++; }
  }
}
fs.writeFileSync(FICHIER, JSON.stringify(frames));
console.log(`capacités enrichies : ${faits} · sans stats (honnête) : ${sans} · pages illisibles : ${echecs}`);
