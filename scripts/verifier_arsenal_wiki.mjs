#!/usr/bin/env node
/* ============================================================================
 *  Garde-fou : les statistiques et les textes que /arsenal tient du wiki
 * ----------------------------------------------------------------------------
 *  Vécu le 05/09/2026. generer_arsenal_data.mjs découpait Module:Warframes/data
 *  sur « \n\t\t[ », alors que ce module indexe SANS crochets (« \t\tAsh = { »).
 *  Résultat : 59 blocs lus sur 126, les champs d'une entrée rattachés à une
 *  autre, et VINGT-CINQ frames affichant un chiffre de rang 30 faux — Hydroid
 *  Prime montrait 2310 PV (ceux d'Inaros) et 0 bouclier, Harrow Prime le
 *  bouclier de Hildryn. Rien ne criait : les chiffres restaient plausibles.
 *
 *  Ce garde-fou travaille sur les DONNÉES du disque, sans réseau : il tourne
 *  dans la porte d'entrée (verifier_invariants.sh) en quelques millisecondes.
 * ==========================================================================*/
import fs from "node:fs";

const frames = JSON.parse(fs.readFileSync("data/arsenal/warframes.json", "utf8"));
const MARQUEUR = /\|[A-Z_]{2,}\|/;
let err = 0;
const fail = (m) => { console.log("❌ " + m); err = 1; };
const ok = (m) => console.log("   ✓ " + m);

/* rang30() de js/arsenal.js, à l'identique : une valeur nulle retombe sur la
   formule générale. Recopiée sciemment — si elle change là-bas sans changer
   ici, ce garde-fou le dira en criant sur des chiffres qu'il croyait sûrs. */
const r30 = (f) => {
  const r = f.r30 || {};
  return {
    hp: r.hp != null ? r.hp : (f.hp > 0 ? f.hp + 100 : f.hp),
    sh: r.sh != null ? r.sh : (f.sh > 0 ? f.sh + 100 : f.sh),
    en: r.en != null ? r.en : Math.round(f.en * 1.5),
  };
};
const par = new Map(frames.map((f) => [f.n, f]));

/* 1) Les EXCEPTIONS à la formule générale (+100 PV / +100 bouclier / ×1,5
      énergie). Ce sont elles que le découpage cassé perdait, et elles seules
      prouvent que le module wiki est bien lu. Valeurs relevées le 05/09/2026
      dans Module:Warframes/data, et recoupées avec api.warframestat.us. */
const EXCEPTIONS = [
  ["Grendel",       { hp: 1295, sh: 95 },  "1095→1295 PV (+200) et 95→95 bouclier (+0) : la formule dirait 1195/195"],
  ["Hildryn",       { sh: 1780 },          "1280→1780 bouclier (+500) : la formule dirait 1380"],
  ["Hydroid Prime", { hp: 650, sh: 370 },  "affichait 2310 PV — ceux d'Inaros — et 0 bouclier ; valeurs inversées ici jusqu'au 19/10/2026, wiki = 650 PV / 370 boucliers au rang 30"],
  ["Harrow Prime",  { sh: 740, en: 210 },  "affichait le bouclier de Hildryn (1780) et 0 énergie"],
  ["Khora Prime",   { hp: 465, sh: 465 },  "affichait 1205 PV — ceux de Kullervo — et 0 bouclier"],
  ["Gauss Prime",   { hp: 370, sh: 650 },  "affichait 1295 PV — ceux de Grendel"],
  /* Grendel Prime garde 1295/95 : ses valeurs étaient justes PAR ACCIDENT dans
     les données d'avant. Un premier correctif écrit à la main les CASSAIT
     (1195/195, la formule générale) faute de voir son entrée — d'où ce contrôle,
     qui garde une valeur correcte autant qu'il en corrige une fausse. */
  ["Grendel Prime", { hp: 1295, sh: 95 },  "1095→1295 PV et 95→95 bouclier, comme Grendel"],
];
for (const [nom, attendu, pourquoi] of EXCEPTIONS) {
  const f = par.get(nom);
  if (!f) { fail(`frame « ${nom} » absente de warframes.json`); continue; }
  const v = r30(f);
  for (const [k, val] of Object.entries(attendu)) {
    if (v[k] !== val) fail(`${nom} : ${k} rang 30 = ${v[k]}, attendu ${val} — ${pourquoi}`);
  }
}
if (!err) ok(`${EXCEPTIONS.length} exceptions de rang 30 conformes au wiki (Grendel, Hildryn, 5 Prime)`);

/* 2) Aucun bouclier ni PV de rang 30 à zéro quand la base est positive : c'est
      la FORME que prenait la contamination (un champ absent chez le voisin). */
for (const f of frames) {
  const v = r30(f);
  if (f.hp > 0 && !(v.hp > 0)) fail(`${f.n} : PV rang 30 = ${v.hp} alors que la base vaut ${f.hp}`);
  if (f.sh > 0 && !(v.sh > 0)) fail(`${f.n} : bouclier rang 30 = ${v.sh} alors que la base vaut ${f.sh}`);
}

/* 3) Les textes affichés dans le panneau « Passif » et les capacités. Les
      balises de couleur du jeu ne doivent JAMAIS sortir : elles s'affichaient
      littéralement (« <DT_SLASH_COLOR>Tranchants ») sur 9 frames. */
const balise = frames.filter((f) => /<DT_|<[A-Z_]{3,}>/.test(f.passive || ""));
if (balise.length) fail(`${balise.length} passif(s) portent encore une balise du jeu : ${balise.slice(0, 3).map((f) => f.n).join(", ")}`);
else ok("aucun passif ne laisse passer une balise <DT_…> du jeu");

/* 4) Marqueurs de gabarit non résolus (« de |DAMAGE|% »). On en tolère un
      RÉSIDU, mesuré, et jamais davantage : là où le wiki ne donne pas le
      chiffre, on préfère le marqueur visible à une valeur inventée.
      Résidu du 05/09/2026 : Caliban et Caliban Prime (le wiki ne donne aucun
      chiffre), Orion & Sirius et Sirius & Orion (le wiki en donne trois là où
      la phrase française en attend deux). */
const RESIDU_PASSIFS = 4, RESIDU_CAPACITES = 2;
const troues = frames.filter((f) => MARQUEUR.test(f.passive || ""));
if (troues.length > RESIDU_PASSIFS) fail(`${troues.length} passifs à marqueur non résolu (résidu admis : ${RESIDU_PASSIFS}) : ${troues.map((f) => f.n).join(", ")}`);
else ok(`passifs à marqueur non résolu : ${troues.length} / ${RESIDU_PASSIFS} admis (${frames.length - troues.length} frames lisibles)`);

const capTrouees = frames.flatMap((f) => (f.abilities || []).filter((a) => MARQUEUR.test(a.d || "")).map((a) => `${f.n}/${a.n}`));
if (capTrouees.length > RESIDU_CAPACITES) fail(`${capTrouees.length} capacités à marqueur non résolu (résidu admis : ${RESIDU_CAPACITES}) : ${capTrouees.join(", ")}`);
else ok(`capacités à marqueur non résolu : ${capTrouees.length} / ${RESIDU_CAPACITES} admis`);

process.exit(err);
