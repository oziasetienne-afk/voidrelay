/* VoidRelay — noms français des mods et arcanes pour les gabarits FR (21/10/2026).

   Source : data/noms_fr.json, produit par scripts/generer_noms_fr.mjs depuis l'i18n FR
   du projet WFCD warframe-items (textes du jeu). Les générateurs lisent ce fichier à
   froid : aucun réseau à la génération.

   Trois usages, tous réservés aux pages FR (les pages EN n'appellent rien d'ici) :
   • nomFr(en)            → le nom FR, ou null s'il n'existe pas / est identique à l'anglais.
   • nomBilingue(en)      → HTML « Nom FR <span class="en">Nom EN</span> » pour une carte ou
                            un titre : le joueur lit le français et garde l'anglais sous les
                            yeux pour chercher sur warframe.market (qui ne connaît que l'EN).
   • franciserProse(html) → dans un paragraphe déjà en HTML, remplace chaque nom EN connu
                            par « <span class="nmfr" title="EN">FR</span> » (infobulle).
                            Ne touche qu'aux nœuds texte : jamais une balise, un attribut,
                            un <script> ni un <style>. Le nom le plus long gagne (« Umbral
                            Vitality » avant « Vitality », « Arcane Fury » avant « Fury »).

   Règle de fond : on n'invente rien. Un nom absent du fichier reste en anglais, et il est
   compté dans sansNomFr() pour que le rapport de génération le liste. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DONNEES = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "noms_fr.json"), "utf8"));
const MODS = new Map(Object.entries(DONNEES.mods || {}));
const ARCANES = new Map(Object.entries(DONNEES.arcanes || {}));
const IDENTIQUES = new Set(DONNEES.identiques || []);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Compteurs pour les preuves de génération : occurrences remplacées par type, noms
   distincts, et noms demandés sans traduction (avec la raison). */
const stats = { mods: 0, arcanes: 0, distincts: new Set() };
const sansFr = new Map(); // en → "identique" | "absent"

function typeDe(en) { return MODS.has(en) ? "mods" : ARCANES.has(en) ? "arcanes" : null; }

/* suivre = false pour un objet qui n'est ni mod ni arcane (pièce Prime, relique…) : il n'a
   pas vocation à avoir un nom dans ce catalogue, on ne le compte pas comme un manque. */
export function nomFr(en, suivre = true) {
  const fr = MODS.get(en) || ARCANES.get(en) || null;
  if (!fr && suivre) sansFr.set(en, IDENTIQUES.has(en) ? "identique" : "absent");
  return fr;
}

function compter(en) {
  const t = typeDe(en);
  if (t) { stats[t]++; stats.distincts.add(en); }
}

export function nomBilingue(en, { suivre = true } = {}) {
  const fr = nomFr(en, suivre);
  if (!fr) return esc(en);
  compter(en);
  return `${esc(fr)} <span class="en" lang="en">${esc(en)}</span>`;
}

/* Alternance regex de tous les noms connus, du plus long au plus court. Limites : pas de
   lettre ni de chiffre de part et d'autre (l'apostrophe compte comme limite : « l'Intensify »). */
/* Noms de mods qui désignent AUSSI autre chose dans le jeu et qu'on laisse tels quels dans la
   prose (les cartes, elles, désignent sans ambiguïté le mod). Liste construite en mesurant les
   remplacements réellement produits sur les 735 builds et 14 guides FR, pas en devinant :
   • Sanctuary — « Elite Sanctuary Onslaught » (mode de jeu) devenait « Elite Sanctuaire Onslaught » ;
   • Neutralize — aussi un pouvoir de Warframe (data/arsenal/warframes.json), seule autre collision
     trouvée entre ce dictionnaire et les noms de Warframes, d'armes et de pouvoirs. */
const AMBIGUS_PROSE = new Set(["Sanctuary", "Neutralize"]);
const TOUS = [...MODS.keys(), ...ARCANES.keys()].filter(n => !AMBIGUS_PROSE.has(n)).sort((a, b) => b.length - a.length);
const MOTIF = new RegExp("(?<![\\p{L}\\p{N}])(?:" + TOUS.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![\\p{L}\\p{N}])", "gu");

function franciserTexte(texte, visible) {
  return texte.replace(MOTIF, en => {
    const fr = MODS.get(en) || ARCANES.get(en);
    compter(en);
    return visible
      ? `<span class="nmfr">${esc(fr)} <span class="en" lang="en">${esc(en)}</span></span>`
      : `<span class="nmfr" title="${esc(en)}">${esc(fr)}</span>`;
  });
}

/* visible = true : l'anglais est écrit en petit à côté du français (pastilles d'arcanes,
   que le joueur recopie sur warframe.market) ; false : l'anglais est en infobulle (prose). */
export function franciserProse(html, { visible = false } = {}) {
  const morceaux = String(html ?? "").split(/(<[^>]+>)/);
  let brut = false; // à l'intérieur de <script> ou <style>
  return morceaux.map(m => {
    if (m.startsWith("<")) {
      if (/^<(script|style)\b/i.test(m)) brut = true;
      else if (/^<\/(script|style)\s*>/i.test(m)) brut = false;
      return m;
    }
    return brut || !m ? m : franciserTexte(m, visible);
  }).join("");
}

export function statsFrancisation() {
  return { mods: stats.mods, arcanes: stats.arcanes, distincts: stats.distincts.size };
}
export function sansNomFr() {
  return [...sansFr.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([en, raison]) => ({ en, raison }));
}
/* Ligne de rapport commune aux générateurs : ce qui a été francisé et ce qui reste en anglais. */
export function rapportFrancisation(prefixe) {
  const s = statsFrancisation(), manques = sansNomFr();
  const detail = manques.length
    ? ` · restés en anglais (${manques.length}) : ${manques.map(m => `${m.en} [${m.raison}]`).join(", ")}`
    : " · tout a un nom FR";
  console.log(`🇫🇷 ${prefixe} : ${s.mods} noms de mods et ${s.arcanes} d'arcanes affichés en français (${s.distincts} noms distincts)${detail}`);
}
