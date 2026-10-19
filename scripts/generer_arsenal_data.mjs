#!/usr/bin/env node
/* ============================================================================
 * VoidRelay — generer_arsenal_data.mjs (16/07/2026)
 * Cuit les données du SIMULATEUR D'ARSENAL (/arsenal) dans data/arsenal/*.json.
 *
 * Sources (communauté WFCD « warframe-items » = les données du jeu extraites
 * par Digital Extremes, la même base que les grands outils de build) :
 *  - api.warframestat.us  /warframes /weapons /mods /arcanes  (?language=fr)
 *  - raw.githubusercontent.com/WFCD/warframe-items : Sentinels, Pets,
 *    SentinelWeapons, Misc (armes exaltées) — noms EN (pas de FR servi).
 *
 * Les effets de mods (levelStats, texte anglais même en ?language=fr) sont
 * PARSES ICI, au build : le client (js/arsenal.js) reçoit des nombres prêts
 * ({dmg:1.65} = +165%). Un mod dont l'effet n'est pas machine-lisible reste
 * équipable (drain/polarité vrais) mais est marqué fx:null → le client
 * l'affiche « effet non simulé » (honnêteté avant tout).
 *
 * Relance : node scripts/generer_arsenal_data.mjs   (réseau requis)
 * Ce fichier de données est un INSTANTANE (méta.date) — à rafraîchir après
 * les grosses mises à jour du jeu.
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tableLuaNommee, tableLuaRetournee } from "./lib_lua.mjs";
import { inversionsIPS } from "./lib_ips.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "data", "arsenal");
fs.mkdirSync(OUT, { recursive: true });

const WS = "https://api.warframestat.us";
const RAW = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json";

async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}
const round2 = (x) => Math.round(x * 100) / 100;

/* ---------- Parsing des effets de mods (texte EN de levelStats) ---------- */
// Motifs → clef d'effet. Valeurs stockées en fraction (+165% → 1.65).
const PATTERNS = [
  /* MODS DE LIEN du compagnon (Lien-Vitalité / -Redirection / -Fibre, 05/09/2026).
     « Increase Health by +125% of Warframe's Max Health » : le bonus se calcule
     sur les stats MODDÉES de la Warframe équipée, pas sur celles du compagnon.
     Clefs distinctes de hp/sh/ar, sciemment : les confondre appliquerait +125 %
     aux PV DU COMPAGNON, ce qui n'a rien à voir et serait faux dans les deux
     sens (un compagnon fragile paraîtrait solide, une frame tank ne servirait
     à rien). Les trois figurent dans les builds de compagnon recommandés par le
     site à TOUS les niveaux — c'est pour ça qu'ils passent avant les autres. */
  [/^Increase (?:Max )?Health by \+([\d.]+)% of Warframe's/i, "lnkhp"],
  [/^Increase (?:Max )?Shields? by \+([\d.]+)% of Warframe's/i, "lnksh"],
  [/^Increase (?:Max )?Armou?r by \+([\d.]+)% of Warframe's/i, "lnkar"],
  [/^\+([\d.]+)%\s+Damage$/i, "dmg"],
  [/^\+([\d.]+)%\s+Melee Damage$/i, "dmg"],
  [/^\+([\d.]+)%\s+Multishot$/i, "ms"],
  [/^\+([\d.]+)%\s+Critical Chance(?:\s+\(x[\d.]+ for (?:Bows|Heavy Attacks)\))?$/i, "cc"],
  [/^\+([\d.]+)%\s+Critical Damage$/i, "cm"],
  [/^\+([\d.]+)%\s+Status Chance$/i, "sc"],
  [/^\+([\d.]+)%\s+Fire Rate(?:\s+\(x[\d.]+ for (?:Bows|Heavy Attacks)\))?$/i, "fr"],
  [/^\+([\d.]+)%\s+Attack Speed$/i, "fr"],
  [/^\+([\d.]+)%\s+Magazine Capacity$/i, "mag"],
  [/^\+([\d.]+)%\s+Reload Speed$/i, "rel"],
  [/^\+([\d.]+)%\s+Heat(?:\s+Damage)?$/i, "e_heat"],
  [/^\+([\d.]+)%\s+Cold(?:\s+Damage)?$/i, "e_cold"],
  [/^\+([\d.]+)%\s+Electricity(?:\s+Damage)?$/i, "e_electricity"],
  [/^\+([\d.]+)%\s+Toxin(?:\s+Damage)?$/i, "e_toxin"],
  // Éléments composés donnés directement par un mod : ajoutés tels quels (pas de
  // combinaison — même comportement que le jeu pour un bonus composé fixe).
  [/^\+([\d.]+)%\s+Blast(?:\s+Damage)?$/i, "ec_blast"],
  [/^\+([\d.]+)%\s+Radiation(?:\s+Damage)?$/i, "ec_radiation"],
  [/^\+([\d.]+)%\s+Gas(?:\s+Damage)?$/i, "ec_gas"],
  [/^\+([\d.]+)%\s+Magnetic(?:\s+Damage)?$/i, "ec_magnetic"],
  [/^\+([\d.]+)%\s+Viral(?:\s+Damage)?$/i, "ec_viral"],
  [/^\+([\d.]+)%\s+Corrosive(?:\s+Damage)?$/i, "ec_corrosive"],
  [/^\+([\d.]+)%\s+Impact(?:\s+Damage)?$/i, "p_impact"],
  [/^\+([\d.]+)%\s+Puncture(?:\s+Damage)?$/i, "p_puncture"],
  [/^\+([\d.]+)%\s+Slash(?:\s+Damage)?$/i, "p_slash"],
  [/^\+([\d.]+)%\s+Ability Strength$/i, "str"],
  [/^\+([\d.]+)%\s+Ability Duration$/i, "dur"],
  [/^\+([\d.]+)%\s+Ability Efficiency$/i, "eff"],
  [/^\+([\d.]+)%\s+Ability Range$/i, "rng"],
  [/^\+([\d.]+)%\s+Health$/i, "hp"],
  [/^\+([\d.]+)%\s+Shield Capacity$/i, "sh"],
  [/^\+([\d.]+)%\s+Armor$/i, "ar"],
  [/^\+([\d.]+)%\s+Energy Max$/i, "en"],
  [/^\+([\d.]+)%\s+Sprint Speed$/i, "spr"],
  [/^\+([\d.]+)%\s+Parkour Velocity$/i, null], // reconnu mais non simulé

  /* ---- AURAS (v49, 03/09/2026) --------------------------------------------
     Les 36 auras du jeu étaient TOUTES « non simulées » : leur texte est
     rédigé côté escouade (« Squad receives +60% Melee Damage ») et aucun
     motif ne le lisait. Charge d'Acier, Physique, Unis, les Amplis…
     valaient donc zéro dans le moteur, alors que ce sont des bonus
     PERMANENTS (rien de conditionnel à supposer).
     Deux familles :
     • statistiques de Warframe (santé, armure, sprint) : l'aura est posée SUR
       la frame, elles tombent dans les clefs existantes et fonctionnent seules ;
     • dégâts par CATÉGORIE d'arme (a_melee, a_rifle, a_shotgun, a_pistol,
       a_sniper) : l'aura est sur la frame mais le bonus s'applique à l'ARME,
       additif avec les mods de dégâts de base (règle du jeu) — c'est le moteur
       qui fait le pont, voir bonusAuraArme() dans js/arsenal.js. */
  [/^Squad receives \+([\d.]+)%\s+Melee Damage$/i, "a_melee"],
  [/^Squad receives \+([\d.]+)%\s+Rifle Damage$/i, "a_rifle"],
  [/^Squad receives \+([\d.]+)%\s+Shotgun Damage$/i, "a_shotgun"],
  [/^Squad receives \+([\d.]+)%\s+Pistol Damage$/i, "a_pistol"],
  [/^Squad receives \+([\d.]+)%\s+Sniper Rifle Damage$/i, "a_sniper"],
  [/^Squad (?:receives|gains) \+([\d.]+)%\s+(?:Maximum )?Health$/i, "hp"],
  [/^Squad (?:receives|gains) \+([\d.]+)%\s+Armor$/i, "ar"],
  [/^Squad (?:receives|gains) \+([\d.]+)%\s+Shield Capacity$/i, "sh"],
  [/^Squad (?:receives|gains) \+([\d.]+)%\s+Sprint Speed$/i, "spr"],
  [/^Squad (?:receives|gains) \+([\d.]+)%\s+Ability Strength$/i, "str"],
  [/^Squad (?:receives|gains) \+([\d.]+)%\s+Ability Duration$/i, "dur"],
  [/^Squad (?:receives|gains) \+([\d.]+)%\s+Ability Efficiency$/i, "eff"],
  [/^Squad (?:receives|gains) \+([\d.]+)%\s+Ability Range$/i, "rng"],
  // Acier Préparé : le combo initial existe déjà (Charge Corrompue, v51), mais
  // seulement dans sa formulation solo. Même patron que le bug d'auras de v49 :
  // la valeur est là, c'est le libellé d'escouade qui n'était lu par personne.
  [/^Squad begins the mission with \+([\d.]+)\s+Initial Combo$/i, "icombo_n"],
  /* Coaction Drift — les DEUX moitiés du mod, et elles ne veulent pas dire la
     même chose (wiki, 03/09/2026) :
       « Aura Strength increases the effect of YOUR aura on everyone.
         Aura Effectiveness increases the effect of EVERYONE'S auras on yourself. »
     Pour le porteur elles se MULTIPLIENT : « this will increase your aura's
     strength to (1 + 15%)^2 for yourself » = ×1,3225, et non ×1,30. */
  [/^Squad benefits \+([\d.]+)% more from Auras$/i, "aurstr"],
  [/^You benefit an additional \+([\d.]+)% from Auras$/i, "aureff"],
  /* v56 — deux auras dont les clefs existent déjà, chacune avec DEUX valeurs
     dans la même phrase (d'où le support des clefs multiples ci-dessus).
     Élan Rapide (AURA) : la vitesse de charge et la durée de combo sont
     modélisées depuis v52 et v51 ; Dresseur : les PV et l'armure du compagnon
     depuis v54.
     Comme Acier Préparé, ce sont des auras : la valeur vit sur la FRAME et
     doit franchir un pont pour atteindre l'arme ou le compagnon. */
  [/^Squad receives \+([\d.]+)% Heavy Attack Wind Up Speed and \+([\d.]+)s Melee Combo Duration$/i,
    ["wup", "cdur_s"]],
  [/^Squad's Companions receive \+([\d.]+) Health and \+([\d.]+) Armor$/i,
    ["pethp_n", "petar_n"]],

  /* v57 — RÉSISTANCES par type de dégât (9 mods, tous permanents). Règle du
     wiki, relevée le 03/09/2026 sur Flame_Repellent :
       « Damage resistance works on both health and shields. It also works for
         damage over time effects. Damage resistance bonus is MULTIPLICATIVE
         with other sources of damage resistance such as Adaptation. »
     Elles ne s'additionnent donc ni entre elles ni avec Adaptation : le
     moteur les compose par 1 − (1 − a)(1 − b) (table FX_RES).
     Écartés volontairement : Manteau Chaud (« Environmental Ice Hazards », une
     condition de terrain qu'on ne modélise pas) et Concentration Résiliente
     (« on Stun », conditionnelle). */
  [/^\+([\d.]+)% Toxin Resistance$/i, "r_tox"],
  [/^\+([\d.]+)% Heat Resistance$/i, "r_heat"],
  [/^\+([\d.]+)% Cold Resistance$/i, "r_cold"],
  [/^\+([\d.]+)% Electricity Resistance$/i, "r_elec"],
  [/^\+([\d.]+)% Radiation Resistance$/i, "r_rad"],
  [/^\+([\d.]+)% Physical Damage Resistance$/i, "r_phys"],

  /* v58 — MUNITIONS DU CHASSEUR. Le texte du mod est laconique
     (« +30% chance to apply on Critical ») : c'est le wiki qui dit à quoi il
     s'applique — un statut Tranchant forcé sur coup CRITIQUE, pour les armes
     primaires. Le modèle de saignement vit dans js/arsenal.js. */
  [/^\+([\d.]+)% chance to apply on Critical$/i, "hm"],
  // v97 — Récupération du Chasseur : la frame récupère X % des dégâts du compagnon
  [/^Warframe healed for \+([\d.]+)% Companion Damage dealt$/i, "hrec"],

  /* v63 — DURÉE DE STATUT. Sept mods (Pistage du Chasseur, Agonie Perpétuelle,
     Piqûre Persistante, Misère Continue, Chercheur d'Augure, Tourment
     Persistant) allongent la durée des effets de statut, donc le NOMBRE de
     ticks d'un saignement. Wiki, page Hunter_Munitions : « Using Hunter Track
     in tandem with Hunter Munitions will increase the base 6-second duration
     to 11.4 seconds, allowing for 11 ticks of damage rather than the normal 6. »
     Le motif est ANCRÉ pour ne PAS attraper Résilience Rapide
     (« -75% Status Duration on Self »), qui parle des statuts subis par le
     joueur — l'inverse exact. */
  [/^\+([\d.]+)% Status Duration$/i, "sdur"],

  /* v64 — HÉMORRAGIE (pistolet) et HÉMORRAGIE INTERNE (fusil). Le texte porte
     TOUTE la règle : « Impact Status Effects have 35% chance to apply a Slash
     Status Effect (x2 when Fire Rate is below 2.5) ». Deux différences de
     fond avec Munitions du Chasseur (v58), et elles décident du calcul :
       • le déclencheur n'est pas le CRITIQUE mais un statut d'IMPACT, donc la
         part d'Impact dans les dégâts compte — et les mods élémentaires la
         DILUENT, là où ils étaient sans effet sur Munitions du Chasseur ;
       • la clause « x2 sous 2,5 de cadence » double la chance sur les armes
         lentes. Elle est portée par le moteur, qui seul connaît la cadence
         MODDÉE (un mod de cadence peut faire franchir le seuil dans les deux
         sens). On ne garde ici que les 35 % de base. */
  [/^Impact Status Effects have ([\d.]+)% chance to apply a Slash Status Effect/i, "hem"],

  /* v65 — ÉCONOMIE D'ÉNERGIE. Trois mods très joués que le moteur ignorait :
     Rage, Rage Prime et Adrénaline du Chasseur convertissent une part des
     dégâts REÇUS SUR LA SANTÉ en énergie. Le motif n'est pas ancré à la fin :
     la même ligne poursuit avec « Without Shields, ally Overguard imitates
     Health », qui ne porte aucune valeur. */
  [/^Convert \+([\d.]+)% of Damage on Health to Energy/i, "rage"],

  /* Équilibre : DEUX valeurs dans une phrase, donc une clef par groupe
     capturé (même mécanique qu'en v56 pour Élan Rapide). Les deux sens ne sont
     pas interchangeables — on ne fond pas les deux en une seule clef. */
  [/^Health pickups give \+([\d.]+)% Energy\. Energy pickups give \+([\d.]+)% Health/i,
   ["equi_en", "equi_hp"]],

  /* Pouvoir Grandissant : une AURA, et un CONDITIONNEL. Son texte est rédigé
     côté escouade comme toutes les auras (v49), mais le bonus est « personal »
     — il vaut pour le porteur. Il ne tombe PAS dans la clef `str` : ce serait
     l'ajouter en permanence alors qu'il faut d'abord infliger un statut. Clef
     distincte `gstr`, appliquée seulement quand le joueur coche la case, comme
     Adaptation en v53. La durée est parsée aussi : la coder en dur ferait
     mentir l'interface le jour où DE la change. */
  [/^On Status Effect with Weapon: Squad increases personal Ability Strength by ([\d.]+)% for ([\d.]+)s/i,
   ["gstr", "gdur_s"]],

  /* v66 — LES CONDITIONNELS « EN VISÉE ». Dix-neuf mods portent la même forme
     — « On Headshot: — +135% Critical Chance when Aiming for 9s » — et treize
     d'entre eux touchent les stats qui décident du DPS (critique, statut,
     cadence). Aucun n'était chiffré : c'est la plus grosse famille qui restait,
     et elle contient des mods qu'on trouve dans presque tous les builds
     d'armes à feu (Viseur à Argon, Réticule Hydraulique, les Galvanisés).

     Deux formes, et l'ordre compte : la variante à PALIERS doit être essayée
     en premier, sinon la simple lui vole la ligne et on perd les paliers.
     Viseur Galvanisé donne +120 % puis +40 % par palier jusqu'à 5 — soit
     +320 % au maximum, pas +120 %. Sous-évaluer d'un facteur presque trois le
     mod le plus posé du jeu serait pire que ne pas le simuler du tout.

     La condition (viser, ET avoir rempli le déclencheur) est portée par un
     réglage explicite du moteur, jamais supposée — même parti pris
     qu'Adaptation (v53) et Pouvoir Grandissant (v65). */
  [/^On [^:]+:(?:\\n|\s|—)*\+([\d.]+)% Critical Chance when Aiming for ([\d.]+)s(?:\\n|\s|—)*On [^:]+:(?:\\n|\s|—)*\+([\d.]+)% Critical Chance when Aiming for [\d.]+s\. Stacks up to ([\d.]+)x/i,
   ["c_cc", "cvdur_s", "c_cc_s", "cstk_n"]],
  [/^On [^:]+:(?:\\n|\s|—)*\+([\d.]+)% Critical Chance when Aiming for ([\d.]+)s/i, ["c_cc", "cvdur_s"]],
  [/^On [^:]+:(?:\\n|\s|—)*\+([\d.]+)% Critical Damage when Aiming for ([\d.]+)s/i, ["c_cm", "cvdur_s"]],
  [/^On [^:]+:(?:\\n|\s|—)*\+([\d.]+)% Status Chance when Aiming for ([\d.]+)s/i, ["c_sc", "cvdur_s"]],
  [/^On [^:]+:(?:\\n|\s|—)*\+([\d.]+)% Fire Rate when Aiming for ([\d.]+)s/i, ["c_fr", "cvdur_s"]],

  /* ---- Stats d'armes à feu (v50, 03/09/2026) ------------------------------
     Pénétration, munitions max et portée de rayon existent en base dans les
     modules du wiki (Module:Weapons/data/primary et /secondary) — la note du
     handoff qui les disait « absents partout » était fausse. Les mods
     correspondants (Cisaillement, Vrille Métallique, Chercheur, Tambour de
     Munitions, Portée Sinistre…) peuvent donc enfin être chiffrés.
     Attention aux UNITÉS : la pénétration et la portée de rayon sont des
     mètres PLATS (+2,2 m), pas des pourcentages — d'où les clefs dédiées et
     la division par 100 qu'on ne fait PAS ici. */
  [/^\+([\d.]+)\s+Punch Through$/i, "PT_M"],
  [/^\+([\d.]+)m\s+Beam Range$/i, "RGE_M"],
  [/^\+([\d.]+)%\s+Ammo Maximum$/i, "ammo"],

  /* ---- Mods à COMPTEUR DE COMBO (v51, 03/09/2026) -------------------------
     Formules relevées sur le wiki officiel le 03/09/2026, telles quelles :
       Coup de Sang       CC = CC base × [1 + mods CC + BR × (combo − 1)]
       Blessure Suintante SC = SC base × [1 + mods SC + WW × (combo − 1)]
       Débordement d'Effets  dégâts = base × [1 + mods dégâts + (CO × n)] …
                             n = nombre de TYPES de statut sur la cible ;
                             additif avec Point de Pression, comme les mods
                             de dégâts de base.
     Le multiplicateur de combo lui-même NE multiplie PAS les attaques
     normales (wiki : « Melee Combo Multiplier does not multiply the damage of
     your normal attacks ») — il sert aux attaques lourdes et à ces mods.
     Clefs dédiées : le moteur ne doit surtout pas les confondre avec cc/sc/dmg,
     qui sont des bonus plats. */
  [/^\+([\d.]+)%\s+Critical Chance stacks with Combo Multiplier$/i, "br"],
  [/^\+([\d.]+)%\s+Status Chance per Combo Multiplier$/i, "ww"],
  [/^\+([\d.]+)%\s+Melee Damage per Status Type affecting the target$/i, "co"],
  [/^\+([\d.]+)s\s+Combo Duration$/i, "cdur_s"],
  [/^\+([\d.]+)\s+Initial Combo$/i, "icombo_n"],

  /* ---- ATTAQUE LOURDE & ALLONGE (v52, 03/09/2026) -------------------------
     Wiki : « Heavy attacks use fixed base damage multipliers compared to
     normal attacks » — le multiplicateur est propre à la CLASSE d'arme et se
     retrouve exactement dans le champ HeavyAttack du module (Nikana Prime :
     990 = 198 × 5). On le déduit donc par arme, sans recopier la table.
     Puis : « the damage is further multiplied by the current combo
     multiplier ». Et Coup Fatal : « Damage bonus is additive to mods such as
     Pressure Point » — même seau que les dégâts de base, mais pour la lourde
     seulement. L'allonge (Atteinte, Atteinte Prime) est en MÈTRES plats. */
  [/^\+([\d.]+)%\s+Melee Damage on Heavy Attack$/i, "hvy"],
  [/^\+([\d.]+)%\s+Heavy Attack Wind Up Speed$/i, "wup"],
  [/^\+([\d.]+)%\s+Heavy Attack Efficiency$/i, "heff"],
  [/^\+([\d.]+)\s+Range$/i, "MRNG_M"],

  /* ---- ADAPTATION (v53, 03/09/2026) ---------------------------------------
     « When Damaged: +10% Resistance to that Damage Type for 20s. Stacks up to
     90%. » On retient le PLAFOND (90 %), pas le pas de 10 % : c'est la valeur
     qui a un sens dans un simulateur de build.
     Wiki : la résistance est MULTIPLICATIVE avec les autres réductions de
     dégâts — dont l'armure — et se cumule séparément PAR TYPE de dégât.
     Le séparateur entre les deux phrases varie selon la source (saut de ligne
     réel, « \n » littéral ou tiret cadratin) : le motif reste souple dessus. */
  [/^When Damaged:.*?\+[\d.]+% Resistance to that Damage Type for [\d.]+s\.? Stacks up to ([\d.]+)%\.?$/i, "adapt"],

  /* ---- SURGARDE (v54, 03/09/2026) -----------------------------------------
     « +1,200 Overguard Max » (Chef de Meute, et 2 200 pour sa version Prime).
     Wiki : le mod soigne le COMPAGNON à chaque coup de mêlée de la Warframe,
     et le surplus de soin devient de la surgarde, jusqu'à ce plafond.
     Valeur PLATE, avec un séparateur de milliers dans la source. */
  [/^\+([\d,]+) Overguard Max$/i, "OG_N"],

  /* ---- PRÉCISION & MUNITIONS (v94, 26/09/2026) ----------------------------
     « ±N% Accuracy » : signé. Le moteur en fait un % de DISPERSION (−N %), sauf
     pour Heavy Caliber / Magnum Force dont la vraie valeur est plate (voir
     MODS_DISPERSION) — le signe reste lu ici pour que le mod soit « simulé ».
     Mutations : « Converts Secondary ammo pickups to 50% of Ammo Pick Up » — une
     part du ramassage de l'AUTRE munition devient la sienne. Récupérateurs
     (auras) : +150 % de munitions par ramassage ; Rifle Scavenger vaut pour
     TOUTES les principales (wiki : « Applies to all primary weapons »). */
  [/^([+-][\d.]+)%\s+Accuracy$/i, "acc"],
  [/^Converts (?:Primary|Secondary) ammo pickups to ([\d.]+)% of Ammo Pick Up\.?$/i, "amut"],
  [/^Squad receives \+([\d.]+)% Rifle Ammo Recovery$/i, "ar_rifle"],
  [/^Squad receives \+([\d.]+)% Shotgun Ammo Recovery$/i, "ar_shotgun"],
  [/^Squad receives \+([\d.]+)% Sniper Rifle Ammo Recovery$/i, "ar_sniper"],
  [/^Squad receives \+([\d.]+)% Pistol Ammo Recovery$/i, "ar_pistol"],

  /* ---- COMBO & FINISHER (v96, 26/09/2026) — wiki Melee_Combo, Corrupt_Charge,
     True_Punishment, Finishing_Touch, Melee_Guidance :
     • « −50% Combo Duration » (Corrupt Charge, True Punishment) : un % de la durée
       de BASE de l'arme (« always subtracts exactly 2.5 seconds ») — clef dédiée,
       à ne surtout pas confondre avec les SECONDES de Body Count (cdur).
     • « +N% (Additional) Combo Count Chance » : « affects all sources of combo count
       generation » → multiplie la montée du combo. Les variantes CONDITIONNELLES
       (« while Blocking », « on Lifted enemies ») ne correspondent pas : non chiffrées.
     • « +N% Finisher Damage » : « applies to the total damage dealt by the relevant
       maneuvers ».
     • Melee Guidance (aura) : « You lose 6s Melee Combo Duration » — sur TA mêlée ;
       le « Squadmates gain 12s » ne te concerne pas. */
  [/^\+([\d.]+)%\s+Combo Duration$/i, "cdurp"],
  [/^\+([\d.]+)%\s+(?:Additional\s+)?Combo Count Chance$/i, "accc"],
  [/^\+([\d.]+)%\s+Finisher Damage$/i, "fin"],
  [/^You lose ([\d.]+)s Melee Combo Duration(?:\\n|\s|—)*Squadmates gain [\d.]+s Melee Combo Duration$/i, "CDUR_MOINS"],
];
// clefs à valeur PLATE (mètres) : le parseur générique divise par 100, pas elles
const PLATES = { PT_M: "pt", RGE_M: "rge", cdur_s: "cdur", icombo_n: "icombo", MRNG_M: "mrng", OG_N: "og",
                 pethp_n: "pethp", petar_n: "petar", gdur_s: "gdur",
                 cvdur_s: "cvdur", cstk_n: "cstk" };
/* Mods de FACTION (Fléau/Châtie/Expulse/Purifie, 43 mods) : « x1.3 Damage to
   Grineer ». Le jeu les range dans un multiplicateur dédié, ADDITIF entre eux
   pour une même faction (x1.3 + x1.55 = x1.85) → on stocke le bonus en fraction
   (0.3) sous la clef de faction du simulateur. « Sentients » n'a pas de cible
   propre ici (regroupés avec Murmure, tables différentes) → laissé en texte. */
const FACTION_CLE = { grineer: "f_grineer", corpus: "f_corpus", infested: "f_infeste",
                      orokin: "f_corrompu", murmur: "f_murmure" };
const RE_FACTION = /^x([\d.]+)\s+Damage to ([A-Za-z]+)s?$/i;

// Les textes du jeu balisent les types de dégâts (« +90% <DT_FIRE_COLOR>Heat ») :
// on retire les balises AVANT le matching, et le texte nettoyé sert à l'affichage.
function propre(line) {
  return String(line).replace(/<DT_[A-Z_]+>/g, "").replace(/<[A-Z_]+>/g, "").replace(/\s+/g, " ").trim();
}
function parseEffects(statLines) {
  const fx = {};
  let allParsed = true;
  for (const raw of statLines) {
    const line = propre(raw);
    let hit = false;
    const fm = RE_FACTION.exec(line);
    const fnom = fm ? fm[2].toLowerCase() : "";
    const fcle = fm && (FACTION_CLE[fnom] || FACTION_CLE[fnom.replace(/s$/, "")]);
    if (fcle) {
      fx[fcle] = round2((fx[fcle] || 0) + (Number(fm[1]) - 1));
      continue;
    }
    /* v95 — MALUS. 40 mods ont une ligne « −N% … » que les motifs (écrits pour
       « +N% … ») ne lisaient pas : Blind Rage comptait +99 % de puissance SANS son
       −55 % d'efficacité, Narrow Minded +99 % de durée sans −66 % de portée… Des
       builds trop beaux, en silence. Une ligne négative qu'aucun motif ne prend
       telle quelle est relue en « + », et chaque valeur capturée est inversée.
       Ce qui reste illisible (recul, gravité, précision ennemie…) reste illisible :
       le mod n'est alors toujours pas « simulé en entier ». */
    const neg = /^-[\d.]/.test(line) && !PATTERNS.some(([re]) => re.test(line));
    const lue = neg ? "+" + line.slice(1) : line;
    for (const [re, key] of PATTERNS) {
      const m = re.exec(lue);
      if (m) {
        hit = true;
        // Certains libellés portent DEUX valeurs dans une seule phrase
        // (« +300 Health and +180 Armor »). La clef peut donc être un TABLEAU :
        // la n-ième clef reçoit le n-ième groupe capturé.
        for (const [i, k] of (Array.isArray(key) ? key : [key]).entries()) {
          const v = m[i + 1];
          if (!k || v == null) continue;
          const plat = PLATES[k];
          // valeurs plates : mètres, secondes ou points — la source écrit parfois
          // les milliers avec une virgule (« +1,200 Overguard Max »).
          // « You lose Ns … » : secondes RETIRÉES, sans signe dans le texte.
          const sg = (neg && i === 0) || k === "CDUR_MOINS" ? -1 : 1;   // seule la valeur en tête porte le « − »
          if (k === "CDUR_MOINS") { fx.cdur = round2((fx.cdur || 0) - Number(v)); continue; }
          if (plat) fx[plat] = round2((fx[plat] || 0) + sg * Number(String(v).replace(/,/g, "")));
          else fx[k] = (fx[k] || 0) + sg * Number(v) / 100;                   // fraction
        }
        break;
      }
    }
    if (!hit) allParsed = false;
  }
  // fx utile même partiel ; simulé "en entier" seulement si toutes les lignes lues
  return { fx: Object.keys(fx).length ? fx : null, full: allParsed };
}

/* --------------------------------- Cuisson -------------------------------- */
const [wfs, weapons, mods, arcanes, sentinels, pets, sentWeapons, misc, wfsRawEn, meleeRawEn, abilityLua, wfLua, modsRawEn, arcanesRawEn, meleeWikiLua, stancesLua, primWikiLua, secWikiLua, hcWiki, mfWiki, vsWiki, compWikiLua] = await Promise.all([
  j(`${WS}/warframes/?language=fr`),
  j(`${WS}/weapons/?language=fr`),
  j(`${WS}/mods/?language=fr`),
  j(`${WS}/arcanes/?language=fr`),
  j(`${RAW}/Sentinels.json`),
  j(`${RAW}/Pets.json`),
  j(`${RAW}/SentinelWeapons.json`),
  j(`${RAW}/Misc.json`),
  j(`${RAW}/Warframes.json`), // champ exalted (absent de l'API FR)
  j(`${RAW}/Melee.json`),     // classe d'arme (Nikana, Polearm…) + stancePolarity — aplaties en « Melee » par l'API FR
  fetch("https://wiki.warframe.com/w/Module:Ability/data?action=raw").then((r) => r.text()),
  fetch("https://wiki.warframe.com/w/Module:Warframes/data?action=raw").then((r) => r.text()),
  j(`${RAW}/Mods.json`), // noms ANGLAIS des mods (l'API FR ne les donne pas) — pour résoudre
                         // les listes de mods des pages builds (rédigées en EN) vers uniqueName
  j(`${RAW}/Arcanes.json`), // arcanes d'ARMES (Primary/Secondary/Melee …) : absentes du
                            // jeu de données FR de l'API — textes officiels anglais gardés tels quels
  // v48 — POSTURES. La classe de mêlée (Nikana, Polearm, Heavy Blade…) n'existe
  // dans AUCUNE source machine côté WFCD : `type` y vaut « Melee » pour les 269
  // armes, et les dossiers du jeu mentent (la Nikana Prime vit sous /Swords/).
  // Le wiki officiel la publie, elle, dans ses modules de données :
  //   Module:Weapons/data/melee → Class + CompatibilityTags par InternalName
  //   Module:Stances/data       → les COMBOS de chaque posture (dégâts par coup
  //                               en % des dégâts de base, nombre de coups,
  //                               durée, procs forcés) + WeaponType
  fetch("https://wiki.warframe.com/w/Module:Weapons/data/melee?action=raw").then((r) => r.text()),
  fetch("https://wiki.warframe.com/w/Module:Stances/data?action=raw").then((r) => r.text()),
  // v50 — stats d'armes à feu absentes de WFCD : munitions max, pénétration
  // innée, précision, portée, et Spool (montée en cadence).
  fetch("https://wiki.warframe.com/w/Module:Weapons/data/primary?action=raw").then((r) => r.text()),
  fetch("https://wiki.warframe.com/w/Module:Weapons/data/secondary?action=raw").then((r) => r.text()),
  // v94 — mods de DISPERSION : Heavy Caliber et Magnum Force ajoutent une dispersion
  // PLATE (en degrés) malgré leur libellé « −55 % Accuracy », et certaines armes en
  // reçoivent davantage. Ces valeurs n'existent que dans les tableaux de leurs pages.
  fetch("https://wiki.warframe.com/w/Heavy_Caliber?action=raw").then((r) => r.text()),
  fetch("https://wiki.warframe.com/w/Magnum_Force?action=raw").then((r) => r.text()),
  fetch("https://wiki.warframe.com/w/Vicious_Spread?action=raw").then((r) => r.text()),
  // v97 — GRIFFES des bêtes (Kubrow, Kavat, Vulpaphyla, Prédasite) : une arme à part
  // depuis la mise à jour 37, absente de WFCD. Le wiki la publie dans ce module.
  fetch("https://wiki.warframe.com/w/Module:Weapons/data/companion?action=raw").then((r) => r.text()),
]);

// Armes exaltées (Misc, type 'Exalted Weapon') indexées par uniqueName.
const exaltedByUn = new Map(
  misc.filter((x) => x.type === "Exalted Weapon").map((x) => [x.uniqueName, x])
);
const exaltedOf = new Map(
  wfsRawEn.filter((w) => Array.isArray(w.exalted)).map((w) => [w.uniqueName, w.exalted])
);

// Coût en énergie par capacité (module de données du wiki officiel — valeurs
// factuelles du jeu), joint par InternalName = uniqueName de l'API. Seule stat
// par capacité disponible en source machine maintenue : le coût. Les dégâts/
// durées fins par capacité n'existent nulle part en données propres → non
// inventés (honnêteté) ; le client applique l'Efficacité au coût, règle du jeu.
const abilityCost = new Map();
{
  const re = /InternalName = "([^"]+)"|Cost = (\d+)/g;
  let m, pendingCost = null, pendingName = null;
  // le bloc Lua liste Cost puis InternalName (ou l'inverse) par entrée { … }
  for (const bloc of abilityLua.split(/\n\t\t\[/)) {
    const cost = /Cost = (\d+)/.exec(bloc);
    const nom = /InternalName = "([^"]+)"/.exec(bloc);
    if (cost && nom) abilityCost.set(nom[1], Number(cost[1]));
  }
}

// Stats RANG 30 exactes par frame (module wiki officiel — chiffres du jeu), par
// InternalName. Remplace la formule générale (+100/+100/×1,5) qui est vraie pour
// la plupart mais pas toutes (ex. Ombre de Sevagoth : bouclier 135 → 185).
const wfWiki = new Map();
/* Module:Warframes/data est lu par l'ANALYSEUR Lua du dépôt (lib_lua.mjs), celui
   qui sert déjà aux quatre modules d'armes — et non par une expression régulière.
   Vécu le 05/09/2026 : le code d'origine découpait sur « \n\t\t[ », alors que ce
   module indexe SANS crochets (« \t\tAsh = { »), contrairement à
   Module:Ability/data. 59 blocs lus sur 126, les champs d'une entrée rattachés à
   une autre, et VINGT-CINQ frames affichant un chiffre de rang 30 faux — Hydroid
   Prime montrait 2310 PV, ceux d'Inaros, et 0 bouclier.

   Un découpage « corrigé » a d'abord été écrit, puis JETÉ : mesuré contre
   l'analyseur, il ratait encore trois frames entières (Gauss Prime, Grendel
   Prime, Gyre Prime), tronquait neuf passifs, et ramassait au passage les
   Archwings. La leçon tient en une ligne : ne pas réécrire à la main un
   analyseur que le dépôt possède déjà. On ne prend QUE la section Warframes —
   le module porte aussi Archwings, Necramechs et Operators. */
for (const e of Object.values(tableLuaRetournee(wfLua).Warframes || {})) {
  if (!e || !e.InternalName) continue;
  const n = (v) => (v == null ? null : Number(v));
  wfWiki.set(e.InternalName, {
    hp: n(e.Health), hp30: n(e.HealthRank30), sh: n(e.Shield), sh30: n(e.ShieldRank30),
    ar: n(e.Armor), en: n(e.Energy), en30: n(e.EnergyRank30), spr: n(e.Sprint),
    expol: polNorm(e.ExilusPolarity || undefined),
    passif: e.Passive || null,
  });
}
const abilityCostParNom = new Map();
for (const bloc of abilityLua.split(/\n\t\t\[/)) {
  const nom = /^"([^"]+)"\] = \{/.exec(bloc);
  const cost = /Cost = (\d+)/.exec(bloc);
  if (nom && cost) abilityCostParNom.set(nom[1], Number(cost[1]));
}

// clef de classe normalisée (« Nikanas » ↔ « Nikana ») pour apparier posture ↔ arme
const classeKey = (t) => String(t || "").toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");
// Classe de mêlée par InternalName, depuis le module de données du wiki.
// Les composants de Zaw (Balla, Cyath, Dehtat…) n'y sont pas : ce sont des
// PIÈCES, pas des armes montées — ils restent sans classe, annoncé tel quel.
const meleeWiki = tableLuaRetournee(meleeWikiLua);
const clsParUn = new Map();
const cdurParUn = new Map(); // durée du compteur de combo (s), base par arme
const mleParUn = new Map(); // attaque lourde, temps de charge, allonge
for (const k of Object.keys(meleeWiki)) {
  const e = meleeWiki[k];
  if (e && e.InternalName && e.Class) clsParUn.set(e.InternalName, e.Class);
  if (e && e.InternalName && e.ComboDur) cdurParUn.set(e.InternalName, e.ComboDur);
  if (e && e.InternalName) mleParUn.set(e.InternalName, {
    hvy: e.HeavyAttack || null, wup: e.WindUp || null, mrng: e.MeleeRange || null,
    expol: polNorm(e.ExilusPolarity),
  });
}
const meleeInfo = new Map(meleeRawEn.map((w) => [w.uniqueName, {
  cls: clsParUn.get(w.uniqueName) || null, spol: w.stancePolarity || null,
  cdur: cdurParUn.get(w.uniqueName) || null,
  mle: mleParUn.get(w.uniqueName) || null,
}]));

/* v50 : stats d'armes à feu par InternalName. Ni WFCD ni l'API FR ne les
   publient ; les modules du wiki, si. On garde ce qui a une BASE chiffrable
   et donc un mod correspondant à simuler :
     ammo  munitions max (Tambour de Munitions & co, +% sur cette base)
     pt    pénétration innée en mètres (Cisaillement, Vrille Métallique…)
     rge   portée de l'attaque en mètres (rayons : Portée Sinistre…)
     acc   précision (affichage seul — aucun mod ne la touche proprement)
     spool nombre de tirs de MONTÉE EN CADENCE (Soma Prime : 4)
   Volontairement laissé de côté : le recul, dont aucune source ne donne la
   valeur de base — les mods de recul restent « non simulés », comme avant. */
/* v68 — POLARITÉ DU CRÉNEAU EXILUS. Le moteur la codait en dur à « aucune »,
   alors que le wiki la publie pour 328 armes sur 353 (95 Madurai + 92 Naramon
   en principales, 78 + 63 en secondaires) et 10 Warframes. Conséquence :
   l'exilus était facturé PLEIN TARIF là où le jeu divise le drain par deux —
   une erreur de capacité systématique sur presque tout build d'arme à feu,
   et la capacité est la contrainte centrale d'un build.
   « Universal » (une arme) accepte n'importe quelle polarité : on le garde tel
   quel, le moteur sait le traiter. */
function polNorm(p) {
  const v = String(p || "").trim().toLowerCase();
  if (!v || v === "none") return null;
  return v;                      // madurai, naramon, vazarin… ou "universal"
}

function statsTir(lua) {
  const t = tableLuaRetournee(lua);
  const out = new Map();
  for (const k of Object.keys(t)) {
    const e = t[k];
    if (!e || !e.InternalName) continue;
    const a = (e.Attacks || [])[0] || {};
    out.set(e.InternalName, {
      ammo: e.AmmoMax || null,
      acc: e.Accuracy || null,
      spool: e.Spool || null,
      cls: e.Class || null,
      /* v94 — munitions par ramassage. Le module applique un DÉFAUT quand le champ
         manque (Module:Weapons, AmmoPickup : 80 en principale, 40 en secondaire) :
         on reprend exactement ce défaut plutôt que de laisser un trou. */
      pick: e.AmmoPickup || (e.Slot === "Primary" ? 80 : e.Slot === "Secondary" ? 40 : null),
      // Dispersion (degrés) de l'attaque principale : la base des mods de précision.
      smin: typeof a.MinSpread === "number" ? a.MinSpread : null,
      smax: typeof a.MaxSpread === "number" ? a.MaxSpread : null,
      fam: e.Family || null,
      /* Incarnon : la jauge se remplit par coups au POINT FAIBLE. IncarnonCharges
         (porté par l'attaque Incarnon) = jauge pleine ; IncarnonChargeGain = gain
         par coup. Vérifié contre les pages du wiki qui publient le résultat :
         Felarx 60/2 = 30, Phenmor 408/34 = 12, Laetum 216/18 = 12 coups. */
      incg: e.IncarnonChargeGain || null,
      incc: Math.max(0, ...(e.Attacks || []).map((x) => x.IncarnonCharges || 0)) || null,
      nom: e.Name || null,
      pt: a.PunchThrough || 0,
      rge: (a.Range && isFinite(a.Range)) ? a.Range : null,
      expol: polNorm(e.ExilusPolarity),
    });
  }
  return out;
}
const tirInfo = new Map([...statsTir(primWikiLua), ...statsTir(secWikiLua)]);

/* v94 — DISPERSION DES MODS « −X % ACCURACY ». Wiki (Accuracy, 26/09/2026) :
     Précision = 100 / [ (dispersion min + max) / 2 × (1 + % de dispersion) + dispersion plate ]
   Un « +40 % Accuracy » retire 40 % de dispersion ; mais Heavy Caliber et Magnum Force
   ajoutent une dispersion PLATE (en degrés), « despite being labeled as a percentage
   in-game ». Leur valeur par rang et le supplément propre à certaines armes ne vivent
   que dans les tableaux de leurs pages : on les lit ici, on ne les recopie pas.
   Vicious Spread est, lui, un vrai pourcentage (+60 %) — lu dans son texte — avec
   un supplément plat pour deux familles d'armes. */
const MODS_DISPERSION = { "Heavy Caliber": "hc", "Magnum Force": "mf", "Vicious Spread": "vs" };
function nomsArmesWiki(cellule) {
  return [...String(cellule).matchAll(/\{\{Weapon\|([^}|]+)(?:\|[^}]*)?\}\}/g)].map((m) => m[1].trim());
}
function dispersionPlateParRang(txt) {
  // lignes « | rang || +dégâts% || +dispersion || coût » du tableau de stats
  return [...String(txt).matchAll(/^\|\s*(\d+)\s*\|\|\s*\+[\d.]+%\s*\|\|\s*\+([\d.]+)\s*\|\|/gm)]
    .map((m) => Number(m[2]));
}
function supplementsParArme(txt) {
  // « | {{Weapon|Dera}} ({{Weapon|Dera Vandal|Vandal}}) || +0.9 || +9.9 » → valeur au rang max
  const out = new Map();
  for (const m of String(txt).matchAll(/^\|\s*(\{\{Weapon[^\n]*?)\s*\|\|\s*\+[\d.]+[^|\n]*\|\|\s*\+([\d.]+)/gm)) {
    for (const nom of nomsArmesWiki(m[1])) out.set(nom, Number(m[2]));
  }
  return out;
}
function supplementsEnColonnes(txt) {
  // Vicious Spread : une colonne par famille d'armes, une ligne par rang.
  const tab = String(txt).split("Additional Spread Modifiers")[1] || "";
  const entete = (tab.match(/^!\s*\{\{Weapon.*$/m) || [""])[0];
  const colonnes = entete ? entete.replace(/^!\s*/, "").split("!!").map(nomsArmesWiki) : [];
  const rangs = [...tab.matchAll(/^\|\s*\d+\s*((?:\|\|\s*\+[\d.]+\s*)+)$/gm)];
  const out = new Map();
  if (!colonnes.length || !rangs.length) return out;
  const dernier = rangs[rangs.length - 1][1].split("||").map((v) => v.trim()).filter(Boolean).map((v) => Number(v.replace("+", "")));
  colonnes.forEach((noms, i) => { if (dernier[i] != null) noms.forEach((n) => out.set(n, dernier[i])); });
  return out;
}
const dispersionPlate = { hc: dispersionPlateParRang(hcWiki), mf: dispersionPlateParRang(mfWiki) };
const dispersionSupp = new Map();
for (const [cle, txt] of [["hc", hcWiki], ["mf", mfWiki]]) {
  for (const [nom, v] of supplementsParArme(txt)) dispersionSupp.set(nom, { ...(dispersionSupp.get(nom) || {}), [cle]: v });
}
for (const [nom, v] of supplementsEnColonnes(vsWiki)) dispersionSupp.set(nom, { ...(dispersionSupp.get(nom) || {}), vs: v });
// Garde : une page du wiki qui change de format ne doit pas produire des zéros en silence.
if (dispersionPlate.hc.length !== 11 || dispersionPlate.mf.length !== 11 || dispersionSupp.size < 20) {
  console.error("💥 Tableaux de dispersion illisibles (Heavy Caliber " + dispersionPlate.hc.length +
    " rangs, Magnum Force " + dispersionPlate.mf.length + " rangs, " + dispersionSupp.size + " armes) — format du wiki changé ?");
  process.exit(1);
}
function weaponSlim(w, cat) {
  const d = w.damage || {};
  const dmg = {};
  const TYPES = ["impact", "puncture", "slash", "heat", "cold", "electricity", "toxin",
                 "blast", "radiation", "gas", "magnetic", "viral", "corrosive", "void", "true"];
  for (const k of TYPES) { if (d[k]) dmg[k] = round2(d[k]); }
  // Certaines armes (Balefire…) rangent leurs dégâts dans attacks[] : repli fidèle.
  const atk = (w.attacks || [])[0];
  if (!Object.keys(dmg).length && atk && atk.damage) {
    for (const k of TYPES) { if (atk.damage[k]) dmg[k] = round2(atk.damage[k]); }
  }
  const atk2 = (w.attacks || [])[1];
  const alt = atk2 && atk2.damage && JSON.stringify(atk2.damage) !== JSON.stringify(atk && atk.damage)
    ? { n: atk2.name || "Attaque 2", tot: round2(Object.values(atk2.damage).reduce((a, b) => a + b, 0)) }
    : null;
  return {
    n: w.name, un: w.uniqueName, cat, type: w.type || "", mr: w.masteryReq || 0,
    img: w.imageName || null,
    pol: w.polarities || [], disp: w.disposition || 0, dmg,
    cc: round2(w.criticalChance || 0), cm: round2(w.criticalMultiplier || 0),
    sc: round2(w.procChance || 0), fr: round2(w.fireRate || 0),
    mag: w.magazineSize || 0, rel: round2(w.reloadTime || 0),
    ms: w.multishot || 1, trig: w.trigger || "",
    stc: (meleeInfo.get(w.uniqueName) || {}).cls || null,
    cdur: (meleeInfo.get(w.uniqueName) || {}).cdur || null,
    ...(function () {
      const t = (meleeInfo.get(w.uniqueName) || {}).mle;
      if (!t) return {};
      const o = {};
      if (t.hvy) o.hvy = round2(t.hvy);    // dégâts d'attaque lourde de base
      if (t.wup) o.wup = round2(t.wup);    // temps de charge (s)
      if (t.mrng) o.mrng = round2(t.mrng); // allonge (m)
      if (t.expol) o.expol = t.expol;      // v68 : polarité du créneau exilus
      return o;
    })(),
    ...(function () {
      const t = tirInfo.get(w.uniqueName);
      if (!t) return {};
      const o = {};
      if (t.ammo) o.ammo = t.ammo;
      if (t.pt) o.pt = round2(t.pt);
      if (t.rge) o.rge = round2(t.rge);
      if (t.acc) o.acc = round2(t.acc);
      if (t.spool) o.spool = t.spool;
      if (t.cls) o.cls = t.cls;
      if (t.expol) o.expol = t.expol;   // v68 : polarité du créneau exilus
      // v94 — ramassage, dispersion, famille, Incarnon (voir statsTir)
      if (t.pick) o.pick = t.pick;
      if (t.smin != null && t.smax != null) { o.smin = round2(t.smin); o.smax = round2(t.smax); }
      if (t.fam) o.fam = t.fam;
      if (t.incg && t.incc) { o.incg = round2(t.incg); o.incc = t.incc; }
      const spx = dispersionSupp.get(t.nom);
      if (spx) o.spx = spx;
      return o;
    })(),
    spol: (meleeInfo.get(w.uniqueName) || {}).spol || null,
    alt,
  };
}

/* Passif d'une Warframe : deux défauts venaient d'amont, tous deux visibles dans
   le panneau « Passif » de /arsenal (mesuré le 05/09/2026 : 88 frames sur 119).

   1. Les balises de couleur du jeu (« <DT_SLASH_COLOR>Tranchants ») s'affichaient
      telles quelles. propre() les retirait déjà pour les mods, pas pour les passifs.
   2. api.warframestat.us livre le texte avec ses MARQUEURS de gabarit non résolus
      — « de |DAMAGE|% qui durent |DURATION|% » — en français COMME en anglais.
      Le wiki, lui, porte la phrase avec ses vrais chiffres.

   On substitue donc les marqueurs par les nombres du wiki, dans l'ordre, mais
   SEULEMENT si les deux comptes coïncident. Sans cette règle on injecterait
   n'importe quoi : le « 09 » de Cyte-09 passerait pour une valeur — c'est
   pourquoi le nom de la frame est retiré du texte avant d'y compter les nombres.
   Quand la preuve manque (le wiki n'a pas de chiffre, ou pas le même nombre), on
   NE TOUCHE À RIEN : un marqueur visible vaut mieux qu'un chiffre inventé.
   Résidu mesuré : 4 frames sur 119, gardé par verifier_arsenal_passifs.mjs. */
const RE_MARQUEUR = /\|[A-Z_]{2,}\|/g;
function passifPropre(w, passifWiki) {
  const txt = propre(w.passiveDescription || "");
  const trous = txt.match(RE_MARQUEUR);
  if (!trous || !passifWiki) return txt;
  const base = String(w.name || "").replace(/ Prime$/, "");
  const sansNom = base ? passifWiki.split(base).join(" ") : passifWiki;
  const vals = sansNom.match(/\d+(?:[.,]\d+)?/g) || [];
  if (vals.length !== trous.length) return txt;
  let i = 0;
  return txt.replace(RE_MARQUEUR, () => vals[i++]);
}

// 1) Warframes (Suits jouables uniquement — pas les Necramechs/Bonewidow ici).
const mechUns = new Set(wfsRawEn.filter((w) => w.productCategory === "MechSuits").map((w) => w.uniqueName));
const suits = wfs
  .filter((w) => (w.type === "Warframe" || w.productCategory === "Suits") && w.health)
  .filter((w) => !mechUns.has(w.uniqueName)) // Necramechs : mods différents, hors périmètre
  .map((w) => ({
    n: w.name, un: w.uniqueName, hp: w.health, sh: w.shield, ar: w.armor,
    img: w.imageName || null,
    en: w.power, spr: round2(w.sprintSpeed || 1), aura: w.aura || null,
    pol: w.polarities || [], prime: !!w.isPrime,
    ...((wfWiki.get(w.uniqueName) || {}).expol
      ? { expol: wfWiki.get(w.uniqueName).expol } : {}),
    passive: passifPropre(w, (wfWiki.get(w.uniqueName) || {}).passif),
    abilities: (w.abilities || []).map((a) => ({
      n: a.name, d: propre(a.description || ""), img: a.imageName || null,
      cost: abilityCost.get(a.uniqueName) ?? null,
    })),
    r30: (function () {
      const k = wfWiki.get(w.uniqueName);
      return k && (k.hp30 || k.sh30 || k.en30)
        ? { hp: k.hp30, sh: k.sh30, en: k.en30 } : null;
    })(),
    exalted: (exaltedOf.get(w.uniqueName) || [])
      .map((un) => exaltedByUn.get(un))
      .filter(Boolean)
      .map((x) => weaponSlim(x, "Exalted")),
  }))
  .sort((a, b) => a.n.localeCompare(b.n, "fr"));

// L'OMBRE de Sevagoth : forme jouable aux stats PROPRES (PV/armure/énergie/vitesse
// différents de Sevagoth), absente de warframe-items — synthétisée depuis le module
// wiki (chiffres du jeu). Ses griffes exaltées lui sont rattachées, comme en jeu.
{
  const k = wfWiki.get("/Lotus/Powersuits/Wraith/Reaper");
  const sev = suits.find((x) => x.n === "Sevagoth");
  if (k && k.hp && sev) {
    const costN = (n) => abilityCostParNom.get(n) ?? null;
    suits.push({
      n: "Sevagoth — Ombre", un: "/Lotus/Powersuits/Wraith/Reaper",
      hp: k.hp, sh: k.sh || 0, ar: k.ar || 0, en: k.en || 0, spr: k.spr || 1,
      img: sev.img, aura: "madurai", pol: ["madurai", "madurai"], prime: false,
      passive: "Forme spectrale de Sevagoth : à sa mort, l'Ombre prend le relais avec ses propres statistiques et ses griffes exaltées.",
      abilities: ["Embrace", "Consume", "Death's Harvest", "Reunite"].map((n) => ({
        n, d: "", img: null, cost: costN(n),
      })),
      r30: { hp: k.hp30, sh: k.sh30, en: k.en30 },
      exalted: sev.exalted,
    });
    suits.sort((a, b) => a.n.localeCompare(b.n, "fr"));
  }
}

// 2) Armes (3 familles jouables du loadout ; arch-* hors périmètre v1).
const armes = { Primary: [], Secondary: [], Melee: [] };
for (const w of weapons) {
  if (armes[w.category]) armes[w.category].push(weaponSlim(w, w.category));
}
for (const k of Object.keys(armes)) armes[k].sort((a, b) => a.n.localeCompare(b.n, "fr"));
{
  // v99 — Perforation et Tranchant inversés par WFCD sur 401 armes (voir lib_ips.mjs) :
  // on s'arrête plutôt que de publier des types de dégâts faux.
  const { comparees, inversees } = inversionsIPS(armes, [primWikiLua, secWikiLua, meleeWikiLua]);
  console.log(`IPS vs wiki : ${comparees} armes comparées, ${inversees.length} inversion(s) Perforation/Tranchant`);
  if (comparees < 300 || inversees.length > 5) {
    console.error("❌ IPS : " + (comparees < 300 ? "trop peu d'armes comparées au wiki (format changé ?)"
      : inversees.length + " armes ont Perforation et Tranchant inversés par rapport au wiki : " + inversees.slice(0, 8).join(", ")));
    process.exit(1);
  }
}

// 3) Compagnons : sentinelles + bêtes (Pets.json mélange bêtes et composants
//    modulaires — on ne garde que les entrées avec des stats de créature).
const compagnons = [
  ...sentinels.map((s) => ({ n: s.name, un: s.uniqueName, cat: "Sentinelle",
    img: s.imageName || null, hp: s.health || 0, sh: s.shield || 0, ar: s.armor || 0 })),
  ...pets.filter((p) => p.health && p.armor !== undefined && /Pets/.test(p.productCategory || ""))
    .map((p) => ({ n: p.name, un: p.uniqueName, cat: "Bête",
      img: p.imageName || null, hp: p.health || 0, sh: p.shield || 0, ar: p.armor || 0 })),
].sort((a, b) => a.n.localeCompare(b.n, "fr"));
/* v97 — GRIFFES DES BÊTES. Chaque bête a SA griffe (non interchangeable), moddée
   par les mods « Claws » (Mâchoire, Morsure…). C'est la base du DPS du compagnon,
   donc de la Récupération du Chasseur (« soigne la Warframe de 30 % des dégâts
   infligés par le compagnon »). Le lien griffe → bête passe par `Link` (la page de
   la bête) : `Users` porte une faute de frappe (« Cresent Vulpaphyla »). */
const betesConnues = new Set(compagnons.filter((c) => c.cat === "Bête").map((c) => c.n));
const griffes = [];
{
  const t = tableLuaRetournee(compWikiLua);
  for (const k of Object.keys(t)) {
    const e = t[k];
    if (!e || e.Slot !== "Beast" || !e.InternalName) continue;
    const a = (e.Attacks || [])[0] || {};
    const dmg = {};
    for (const [typ, v] of Object.entries(a.Damage || {})) if (v) dmg[typ.toLowerCase()] = round2(v);
    if (!Object.keys(dmg).length) continue;
    griffes.push({
      n: e.Name, un: e.InternalName, cat: "Claws", type: "Griffes", mr: 0, img: null,
      pol: [], disp: 0, dmg,
      cc: round2(a.CritChance || 0), cm: round2(a.CritMultiplier || 0),
      sc: round2(a.StatusChance || 0), fr: round2(a.FireRate || 1),
      mag: 0, rel: 0, ms: a.Multishot || 1, trig: "",
      bete: e.Link || (e.Users || [])[0] || null,
    });
  }
  const sansBete = [...betesConnues].filter((b) => !griffes.some((g) => g.bete === b));
  // Échoue BRUYAMMENT si le module change de format : sans ça, les griffes
  // disparaîtraient en silence et la Récupération du Chasseur afficherait 0.
  if (griffes.length < 10 || sansBete.length) {
    console.error("❌ griffes des bêtes : " + griffes.length + " lues, sans griffe : " + sansBete.join(", "));
    process.exit(1);
  }
}
const armesCompagnon = sentWeapons
  .filter((w) => w.damage)
  .map((w) => weaponSlim(w, "Robotic"))
  .concat(griffes)
  .sort((a, b) => a.n.localeCompare(b.n, "fr"));

// 4) Mods : familles utiles au simulateur, hors Rivens (aléatoires par nature),
//    hors Necramech/Parazon/K-Drive/Archwing (loadout non couvert v1).
const modsEnParUn = new Map(modsRawEn.map((m) => [m.uniqueName, m.name]));
const COMPATS = new Set(["WARFRAME", "AURA", "Rifle", "Shotgun", "Pistol", "Melee",
  "COMPANION", "Sniper", "Arme de Kitgun", "SENTINEL", "Robotic", "BEAST",
  // compats génériques MAJUSCULES du jeu : s'appliquent à toute la catégorie
  // (ex. Hunter Munitions = PRIMARY, mods Galvanized de secondaires = SECONDARY)
  "PRIMARY", "SECONDARY", "MELEE",
  // v97 — mods des griffes des bêtes (Mâchoire, Morsure…)
  "Claws"]);
const modsSlim = [];
/* v100 — MODS FANTÔMES. Les fichiers du jeu contiennent, sous /Expert/, des doublons
   de mods ordinaires (Intensify +55 %, True Steel +220 %, Split Chamber +165 %…)
   qu'on ne peut pas obtenir : le wiki n'a aucune page « Primed Intensify » (elle
   redirige vers Intensify, max +30 %). Signature fiable : un /Expert/ dont le nom
   ANGLAIS ne commence pas par « Primed » ET qui a un jumeau ordinaire du même nom.
   Les vrais Galvanisés (Galvanized Steel…) vivent aussi sous /Expert/ mais n'ont
   pas de jumeau : ils restent. */
const nomsEnOrdinaires = new Set(mods
  .filter((m) => !/\/Expert\//.test(m.uniqueName || ""))
  .map((m) => modsEnParUn.get(m.uniqueName)).filter(Boolean));
const fantomes = [];
for (const m of mods) {
  const compat = m.compatName || "";
  const estPosture = m.type === "Stance Mod";
  if (!COMPATS.has(compat) && !estPosture) continue;
  // v97 — postures de COMPAGNON (« Posture Mod ») : un emplacement à part en jeu,
  // sans stat chiffrable — elles ne doivent pas passer pour des mods de griffes.
  if (m.type === "Posture Mod") continue;
  if (/riven/i.test(m.name || "") || /Randomized/.test(m.uniqueName || "")) continue;
  // Hors périmètre : mods PvP (Conclave, valeurs différentes du PvE) et variantes
  // tutoriel Beginner/Intermediate (doublons de nom avec valeurs réduites).
  if (/PvP|Conclave/i.test(m.uniqueName || "")) continue;
  if (/\/(Beginner|Intermediate)\//.test(m.uniqueName || "")) continue;
  {
    const en = modsEnParUn.get(m.uniqueName) || "";
    if (/\/Expert\//.test(m.uniqueName || "") && en && !/^Primed /i.test(en) && nomsEnOrdinaires.has(en)) {
      fantomes.push(en);
      continue;
    }
  }
  const niveaux = m.levelStats || [];
  const last = niveaux.slice(-1)[0];
  const lines = (last && last.stats) || [];
  const { fx, full } = parseEffects(lines);
  // Effets PAR RANG (rang 0..fusionLimit) : le simulateur laisse choisir le niveau
  // du mod comme dans le jeu. lvs[r] = effets parsés du rang r (null si illisible).
  let lvs = null;
  if (fx && niveaux.length > 1) {
    lvs = niveaux.map((lv) => parseEffects((lv && lv.stats) || []).fx);
    if (lvs.every((x) => !x)) lvs = null;
  }
  const fam = (m.name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(prime|primed|umbral?e?|umbra|archonte?|archon|amalgame?|amalgam|defectueux|defectueuse|flawed)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  // Variantes Primed : la source FR garde le nom de base (« Continuité » pour
  // Primed Continuity) → doublons d'affichage trompeurs. Dans le jeu : « … Prime ».
  // v100 : seulement si le nom anglais dit « Primed » — avant, tout /Expert/ recevait
  // « Prime », y compris les Galvanisés (« Acier Galvanisé Prime » n'existe pas).
  const enParUn = modsEnParUn.get(m.uniqueName) || null;
  const nom = /^Primed /i.test(enParUn || "") && !/Prime/i.test(m.name || "")
    ? m.name + " Prime" : m.name;
  modsSlim.push({
    n: nom, en: enParUn, un: m.uniqueName, pol: m.polarity || "none", img: m.imageName || null, fam, lvs,
    // Auras et postures : la source WFCD stocke leur drain en NÉGATIF (elles
    // AJOUTENT de la capacité). Le jeu affiche |base| + rang (aura 2+5=7, Charge
    // d'Acier 4+5=9, posture 2+3=5 ; ×2 si polarité concordante) → valeur absolue
    // ici, le moteur (bonusAura) retrouve exactement les chiffres du jeu.
    d0: Math.abs(m.baseDrain ?? 0), fl: m.fusionLimit ?? 0, c: compat,
    r: m.rarity || "", u: !!m.isUtility, aug: !!m.isAugment,
    st: estPosture || undefined, stk: estPosture ? classeKey(compat) : undefined,
    // « \n » littéraux ET vrais sauts de ligne présents dans certains textes de la
    // source (même piège que les arcanes d'armes) → séparateur lisible.
    fx, full, tx: lines.map((l) => propre(String(l).replace(/\\n|\n/g, " — "))),
  });
}
// v94 — mods de dispersion : clef + dispersion plate par rang (Heavy Caliber, Magnum Force)
for (const m of modsSlim) {
  const cle = MODS_DISPERSION[m.en];
  if (!cle) continue;
  m.spk = cle;
  if (dispersionPlate[cle]) {
    if (dispersionPlate[cle].length !== (m.fl || 0) + 1) {
      console.error(`💥 ${m.en} : ${dispersionPlate[cle].length} rangs de dispersion pour ${(m.fl || 0) + 1} rangs de mod.`);
      process.exit(1);
    }
    m.spp = dispersionPlate[cle];
  }
}
modsSlim.sort((a, b) => a.n.localeCompare(b.n, "fr"));

/* ---- POSTURES (v48, 03/09/2026) -------------------------------------------
   Jusqu'ici une posture était équipable, avec son vrai drain et sa vraie
   polarité, mais RIEN d'autre : ni la classe d'arme à laquelle elle va (le
   sélecteur proposait les 57), ni ce qu'elle fait réellement — ses COMBOS.
   Le module de données du wiki les publie : par combo, la liste des attaques
   avec leurs dégâts en % des dégâts de base de l'arme, le nombre de coups,
   la durée de l'enchaînement et les procs forcés.
   On en tire, par posture : { wt: classe d'arme, c: [combos] }, chaque combo
   { k: touche, n: nom, d: durée (s), h: coups, t: dégâts totaux en %,
     p: procs forcés }. Le simulateur en calcule le DPS avec les mods posés.
   Honnêteté : seuls les combos PROPRES à la posture sont retenus. Les combos
   partagés par toute une classe d'arme (Slam, Aérien, Mur, Finisher…) ne
   disent rien sur le choix de la posture. Les combos Conclave (PvP, valeurs
   différentes) sont écartés, comme les mods PvP plus haut. Un combo sans
   durée publiée garde ses dégâts et ses coups, mais pas de DPS — jamais de
   durée inventée. */
const stanceData = tableLuaNommee(stancesLua, "StanceData");
const META_POSTURE = new Set(["StanceName", "WeaponType", "UniqueToWeapon", "ConclaveOnly", "StancelessStance"]);
const postures = {};
let posturesAvecCombos = 0;
for (const m of modsSlim) {
  if (!m.st) continue;
  const e = m.en && stanceData[m.en];
  if (!e) continue;
  m.wt = e.WeaponType || null;                    // classe d'arme de la posture
  const combos = [];
  for (const k of Object.keys(e)) {
    if (META_POSTURE.has(k)) continue;
    const c = e[k];
    if (!c || !Array.isArray(c.Attacks)) continue;
    let coups = 0, total = 0;
    const procs = [];
    for (const a of c.Attacks) {
      (a.Dmg || []).forEach((d, i) => {
        const n = (a.Hits && a.Hits[i]) || 1;
        coups += n;
        total += d * n;
        const pr = a.Procs && a.Procs[i];
        if (pr) for (const x of (Array.isArray(pr) ? pr : [pr])) if (x && !procs.includes(x)) procs.push(x);
      });
    }
    if (!coups) continue;
    combos.push({
      k, n: c.Name || k, d: c.Duration || null,
      h: coups, t: round2(total), p: procs.length ? procs : undefined,
    });
  }
  if (!combos.length) continue;
  // le combo le plus fort d'abord (dégâts totaux) — c'est celui qu'on joue
  combos.sort((a, b) => b.t - a.t);
  postures[m.un] = { wt: m.wt, c: combos };
  posturesAvecCombos++;
}

// 5) Arcanes de Warframe (affichage texte, pas de maths : effets conditionnels).
const arcanesSlim = arcanes
  .filter((a) => a.name && !/Magus|Virtuos|Exodia|Pax|Residual|Theorem/i.test(a.name))
  .map((a) => {
    const last = (a.levelStats || []).slice(-1)[0];
    // BUG corrigé 17/07/2026 : uniqueName est ABSENT de la source pour ces
    // arcanes → le champ un disparaissait du JSON et les arcanes de frame
    // étaient inéquipables (le moteur les référence par un). Repli : le nom.
    return { n: a.name, un: a.uniqueName || a.name, r: a.rarity || "", img: a.imageName || null, tx: ((last && last.stats) || []).map(propre) };
  })
  .sort((a, b) => a.n.localeCompare(b.n, "fr"));

// 5bis) Arcanes d'ARMES (Primary/Secondary/Melee …) : la source FR ne les connaît
// pas → source brute WFCD, noms et textes officiels ANGLAIS (pas de traduction
// inventée). Seuls les bonus INCONDITIONNELLEMENT chiffrables « aux stacks max »
// sont parsés en fx (+X % Damage empilable, +X % Reload Speed — Merciless,
// Deadhead, Dexterity) ; tout le reste = texte, jamais additionné en silence.
const arcanesArmes = arcanesRawEn
  .filter((a) => a.name && /^(Primary|Secondary|Melee)\s/.test(a.name))
  .map((a) => {
    const last = (a.levelStats || []).slice(-1)[0];
    // la source contient des « \n » littéraux ET de vrais sauts de ligne → « — »
    const tx = ((last && last.stats) || []).map((s) => propre(String(s).replace(/\\n|\n/g, " — ")));
    const joint = tx.join(" ");
    const fx = {};
    const mDmg = /\+([\d.]+)% Damage for [\d.]+s\. Stacks up to (\d+)x/.exec(joint);
    if (mDmg) fx.dmg = Math.round(Number(mDmg[1]) * Number(mDmg[2])) / 100; // ex. 30×12 → 3.6
    const mRel = /\+([\d.]+)% Reload Speed/.exec(joint);
    if (mRel) fx.rel = Number(mRel[1]) / 100;
    return {
      n: a.name, un: a.uniqueName, r: a.rarity || "", img: a.imageName || null,
      cls: a.name.split(" ")[0], // Primary | Secondary | Melee
      tx, fx: Object.keys(fx).length ? fx : null,
    };
  })
  .sort((a, b) => a.n.localeCompare(b.n, "en"));

/* --------------------------------- Écriture -------------------------------- */
const meta = {
  date: new Date().toISOString().slice(0, 10),
  source: "WFCD warframe-items via api.warframestat.us (fr) + GitHub raw (en)",
  regles: {
    rang30: "PV/bouclier +100 (si base > 0), énergie ×1,5, armure et sprint inchangés (rework 2022, vérifié wiki 16/07/2026)",
    capacite: "30 au rang 30, ×2 avec réacteur/catalyseur Orokin",
    polarite: "concordante : drain ÷2 arrondi supérieur ; discordante : +25% arrondi mathématique",
    aura: "ajoute sa valeur en capacité ; ×2 si polarité concordante, -25% arrondi si discordante",
    posture: "ajoute sa valeur en capacité (comme une aura) ; aucun bonus de statistique — elle donne des COMBOS (dégâts en % des dégâts de base, par coup)",
  },
  compte: {
    warframes: suits.length,
    primaires: armes.Primary.length, secondaires: armes.Secondary.length, melee: armes.Melee.length,
    compagnons: compagnons.length, armesCompagnon: armesCompagnon.length,
    mods: modsSlim.length, modsSimules: modsSlim.filter((m) => m.fx).length, modsFantomesEcartes: fantomes.length,
    arcanes: arcanesSlim.length,
    arcanesArmes: arcanesArmes.length,
    arcanesArmesSimulees: arcanesArmes.filter((a) => a.fx).length,
    postures: modsSlim.filter((m) => m.st).length,
    armesAvecMunitions: armes.Primary.concat(armes.Secondary).filter((w) => w.ammo).length,
    posturesAvecCombos,
    meleeAvecClasse: armes.Melee.filter((w) => w.stc).length,
  },
};
const write = (name, data) =>
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data)); // compact (pages statiques)
write("warframes.json", suits);
write("armes.json", armes);
write("compagnons.json", { compagnons, armes: armesCompagnon });
write("mods.json", modsSlim);
write("arcanes.json", arcanesSlim);
write("arcanes_armes.json", arcanesArmes);
write("postures.json", postures);
write("meta.json", meta);
console.log("✅ data/arsenal :", JSON.stringify(meta.compte));
// PIÈGE (vécu deux fois le 03/09/2026) : ce script RÉÉCRIT warframes.json de zéro
// et fait donc disparaître les stats par capacité (abilities[].st), qui viennent
// du wiki via enrichir_stats_capacites.mjs. Sans la seconde étape, le panneau
// « stats des pouvoirs » redevient vide, en silence.
console.log("\n⚠️  ÉTAPE SUIVANTE OBLIGATOIRE : node scripts/enrichir_stats_capacites.mjs");
console.log("   (ou, plus simplement, lance toute la chaîne : npm run arsenal:data)\n");
for (const f of fs.readdirSync(OUT)) {
  console.log(`   ${f} — ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)} Ko`);
}
