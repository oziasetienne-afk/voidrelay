/* ============================================================================
   VoidRelay — GÉNÉRATEUR DE BUILDS (2026-07-14, demande du Chef : « l'outil
   builds est pauvre, je veux la totalité — Warframes normales + Prime, toutes
   les armes, compagnons — et 3 bulles par item : Débutant (presque pas de
   ressources), Intermédiaire, Expert (ressources de fou, mods Primed/Galvanized,
   arcanes, et les 5 fragments d'Archon sur les Warframes) »).

   Entrées : data/warframes.json (117), data/weapons.json (658 — on exclut les
   composants Zaw/Kitgun), data/companions.json (39).
   Sorties : builds/<slug>.html (marqueur vr-builds-gen) + builds/index.html.

   RÈGLES :
   • Les pages MANUELLES existantes (sans marqueur) ne sont JAMAIS écrasées —
     ce sont les 22 builds détaillés ★, meilleurs qu'un template.
   • Design = pandaahh.css (même head que builds/mesa.html : CSP, display=optional
     anti-CLS, thème inline). Aucun fetch → pas de risque CLS « section async ».
   • Images de mods : assets/wfimg/*.jpg quand dispo, sinon carte texte propre.
   • Sitemap : découvert automatiquement par generer_pages_objets.mjs
     (builds/*.html, lignes ~825) — rien à faire ici.
   • Contenu honnête : builds « evergreen » par archétype, pas de fausse méta ;
     chaque bulle dit où trouver les mods et le coût approximatif en formas.

   Usage : node scripts/generer_builds.mjs
           node scripts/generer_builds.mjs --verifier   (n'écrit rien, dit si les pages divergent)
   ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EFFECTS_EN, FRAME_TIERS_EN, WEAPON_RULES_EN, TYPE_NOTE_EN, COMP_RULES_EN, SHARD_EN, UI_EN } from "./builds_i18n_en.mjs";
import { GUIDES, GUIDES_EN, GUIDES_FAITS_MAIN } from "./guides_content.mjs";
import { avecFilArianeDeclare } from "./lib_fil_ariane.mjs";
import { nomFr, nomBilingue, franciserProse, rapportFrancisation } from "./lib_noms_fr.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://voidrelay.fr";
const OUT = path.join(ROOT, "builds");
const MARKER = "<!-- vr-builds-gen v1 -->";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const wfs = JSON.parse(fs.readFileSync(path.join(ROOT, "data/warframes.json"), "utf8"));
// Passifs AVEC leurs chiffres (20/10/2026). `data/warframes.json` → `passive` a perdu ses
// nombres (marqueurs |VAL| de WFCD effacés) : 91 frames affichaient « sidearms % faster ».
// FR : texte de l'arsenal (chiffres identiques au wiki pour 88/91, vérifié) ; EN : module du
// wiki ; les deux réunis dans `data/passifs.json` par `scripts/maj_passifs_wiki.py`. Marqueur non résolu ou absent → pas de ligne Passif,
// plutôt qu'une phrase fausse : c'est le cas en FR de Caliban, Caliban Prime et Sirius & Orion
// (l'arsenal garde |PCT|, |EFFICIENCY|, |COUNT|), alors que leur page EN a un passif.
const MARQUEUR = /\|[A-Z_0-9]+\|/;
const PASSIFS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/passifs.json"), "utf8"));
const propres = o => new Map(Object.entries(o || {}).filter(([, t]) => t && !MARQUEUR.test(t)));
const PASSIF_FR = propres(PASSIFS.passifs_fr), PASSIF_EN = propres(PASSIFS.passifs);
const lignePassif = (label, texte) => texte ? `<p class="passive"><b>${label}</b> ${esc(texte)}</p>` : "";
const weapons = JSON.parse(fs.readFileSync(path.join(ROOT, "data/weapons.json"), "utf8"))
  .filter(w => !/Component/.test(w.t || ""));
const comps = JSON.parse(fs.readFileSync(path.join(ROOT, "data/companions.json"), "utf8"));
// Tous les noms de builds (frames + armes + compagnons) : sert au maillage guides→builds
// pour départager les noms imbriqués (« Mesa » vs « Mesa Prime »). Rempli plus bas une fois
// les listes filtrées ; Set global consulté par countMentions().

// Slugs du marché (wf_index = tous les objets /o/) -> lien « prix » sur les fiches tradables.
// « Ash Prime » -> ash_prime_set (frames/armes Prime se vendent en set) ; sinon slug direct.
const marketSlugs = new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, "data/wf_index.json"), "utf8")).map(it => it.s)
);
function marketLink(name) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  for (const cand of [base + "_set", base]) if (marketSlugs.has(cand)) return "/o/" + cand;
  return null;
}

/* ---- Maillage guides → builds (16/07/2026, demande de l'admin « synchronicité totale ») ----
   Chaque page build liste les guides dont le TEXTE mentionne réellement l'objet — calculé
   ici à la génération (aucun lien inventé). Corpus : guides générés (guides_content.mjs)
   + guides faits main (HTML lu sur disque). L'appariement évite les faux positifs des noms
   imbriqués : « Mesa » ne capte pas « Mesa Prime » (le nom LONG gagne), « War » ne capte
   pas « New War » (quête). Cap : 3 guides par build, tri par nombre de mentions. */
const stripTags = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
function loadGuideCorpus(lang) {
  const corpus = [];
  if (lang === "fr") {
    for (const g of GUIDES) corpus.push({ url: `/guides/${g.slug}`, h1: g.h1, text: stripTags(g.h1 + " " + g.desc + " " + g.body) });
    for (const m of GUIDES_FAITS_MAIN) {
      try {
        const html = fs.readFileSync(path.join(ROOT, "guides", m.slug + ".html"), "utf8");
        const main = (html.match(/<main[\s\S]*?<\/main>/) || [html])[0];
        corpus.push({ url: `/guides/${m.slug}`, h1: m.h1, text: stripTags(main) });
      } catch (e) {}
    }
  } else {
    for (const g of GUIDES_EN) corpus.push({ url: `/en/guides/${g.slug}`, h1: g.h1, text: stripTags(g.h1 + " " + g.desc + " " + g.body) });
    try {
      const html = fs.readFileSync(path.join(ROOT, "en", "guides", "archon-shards.html"), "utf8");
      const main = (html.match(/<main[\s\S]*?<\/main>/) || [html])[0];
      corpus.push({ url: "/en/guides/archon-shards", h1: "Archon Shards", text: stripTags(main) });
    } catch (e) {}
  }
  return corpus;
}
let GUIDE_CORPUS_FR = null, GUIDE_CORPUS_EN = null, ALL_BUILD_NAMES = null;
function countMentions(name, text) {
  // Occurrences du nom en limites de mots, en rejetant celles qui font partie d'un nom
  // de build PLUS LONG connu (préfixe ou suffixe : Kuva Nukor / Mesa Prime / New War).
  const re = new RegExp("(^|[^A-Za-z0-9&])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^A-Za-z0-9&])", "g");
  let n = 0, m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[1].length, end = start + name.length;
    const before = text.slice(Math.max(0, start - 24), start), after = text.slice(end, end + 24);
    const nextWord = (after.match(/^\s+([A-ZÉ][\w'À-ſ-]*)/) || [])[1];
    const prevWord = (before.match(/([A-ZÉ][\w'À-ſ-]*)\s+$/) || [])[1];
    if (nextWord && ALL_BUILD_NAMES.has(name + " " + nextWord)) { re.lastIndex = end; continue; }
    if (prevWord && (ALL_BUILD_NAMES.has(prevWord + " " + name) || (name === "War" && prevWord === "New"))) { re.lastIndex = end; continue; }
    n++; re.lastIndex = end;
  }
  return n;
}
function guidesLinkLine(name, lang) {
  if (!ALL_BUILD_NAMES) return "";
  const corpus = lang === "fr"
    ? (GUIDE_CORPUS_FR || (GUIDE_CORPUS_FR = loadGuideCorpus("fr")))
    : (GUIDE_CORPUS_EN || (GUIDE_CORPUS_EN = loadGuideCorpus("en")));
  const hits = corpus.map(g => ({ g, n: countMentions(name, g.text) })).filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n).slice(0, 3);
  if (!hits.length) return "";
  const label = lang === "fr" ? "📚 Guides qui en parlent :" : "📚 Guides mentioning it:";
  return `\n<p class="bc">${label} ${hits.map(x => `<a href="${x.g.url}">${esc(x.g.h1)}</a>`).join(" · ")}</p>`;
}


/* ---------- polarités (mêmes formes SVG que les pages manuelles) ---------- */
const POL = {
  V:   '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5 L8 11 L13 5" fill="none" stroke="#e2c873" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  D:   '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3 L5.5 13 M5.5 3 C12.5 3.5 12.5 12.5 5.5 13" fill="none" stroke="#e2c873" stroke-width="2" stroke-linecap="round"/></svg>',
  BAR: '<svg viewBox="0 0 16 16" aria-hidden="true"><line x1="3" y1="8" x2="13" y2="8" stroke="#e2c873" stroke-width="2.4" stroke-linecap="round"/></svg>',
  EQ:  '<svg viewBox="0 0 16 16" aria-hidden="true"><line x1="3" y1="6" x2="13" y2="6" stroke="#e2c873" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="10" x2="13" y2="10" stroke="#e2c873" stroke-width="2" stroke-linecap="round"/></svg>',
  U:   '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6 L8 11 L13 6" fill="none" stroke="#e2c873" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="4" r="1.3" fill="#e2c873"/></svg>',
};

/* ---------- catalogue de mods : data/mods_cards.json (2026-07-15) ----------
   Généré depuis la base communautaire warframe-items (WFCD) : pour CHAQUE mod
   utilisé par les règles, la VRAIE carte du jeu (imageName), la VRAIE polarité
   et le rang max réel (fusionLimit). Images self-hostées dans assets/wfimg/
   (cdn.warframestat.us, même pipeline que les 51 cartes d'origine).
   Plus AUCUNE attribution approximative ni carte texte. */
const MODS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/mods_cards.json"), "utf8"));

/* ---------- effets des mods (rang max ; chiffres = valeurs stables du jeu,
   qualitatif quand la valeur varie ou est moins connue — jamais d'invention) ---------- */
const EFFECTS = {
  // Warframe
  // Vitality/Redirection/Steel Fiber/Flow : +100 % au rang max (wiki, vérifié le 20/10/2026) ;
  // le site affichait +440 / +440 / +110 / +150 %, valeurs d'avant leur refonte.
  "Vitality": "+100 % santé", "Redirection": "+100 % bouclier", "Steel Fiber": "+100 % armure",
  "Flow": "+100 % énergie max", "Primed Flow": "+185 % énergie max",
  "Continuity": "+30 % durée", "Primed Continuity": "+55 % durée",
  "Intensify": "+30 % force", "Umbral Intensify": "+44 % force (bonus set Umbral)",
  "Umbral Vitality": "+100 % santé (bonus set Umbral)",
  "Streamline": "+30 % efficacité", "Stretch": "+45 % portée",
  "Archon Stretch": "+45 % portée · énergie régén. si dégâts électriques",
  "Constitution": "+28 % durée · relevage plus rapide",
  "Adaptation": "résistance +10 %/coup (max 90 %) au type reçu",
  "Fleeting Expertise": "+60 % efficacité / −60 % durée",
  "Blind Rage": "+99 % force / −55 % efficacité",
  "Transient Fortitude": "+55 % force / −27,5 % durée",
  "Augur Message": "+24 % durée", "Augur Secrets": "+24 % force", "Augur Pact": "+90 % dégâts secondaire",
  "Cunning Drift": "+15 % portée", "Power Drift": "+15 % force",
  "Energy Siphon": "aura : +0,6 énergie/s (équipe)", "Steel Charge": "aura : +60 % dégâts mêlée (équipe)",
  // Fusil
  "Serration": "+165 % dégâts", "Split Chamber": "+90 % multishot",
  "Point Strike": "+150 % chance critique", "Vital Sense": "+120 % dégâts critiques",
  "Hellfire": "+90 % feu", "Stormbringer": "+90 % électricité",
  "Cryo Rounds": "+90 % froid", "Primed Cryo Rounds": "+165 % froid", "Infected Clip": "+90 % toxine",
  "Fast Hands": "+30 % vitesse de rechargement", "Rupture": "+90 % impact",
  "Malignant Force": "+60 % toxine · +60 % statut", "Rime Rounds": "+60 % froid · +60 % statut",
  "Hunter Munitions": "30 % de chance de Saignement sur coup critique",
  "Vile Acceleration": "+90 % cadence / −15 % dégâts",
  "Heavy Caliber": "+165 % dégâts / précision réduite",
  "Galvanized Chamber": "+80 % multishot · +30 % par kill (cumul ×5)",
  "Galvanized Aptitude": "+80 % statut · en kill : dégâts bonus par statut actif",
  "Galvanized Scope": "+120 % crit. en visée · bonus par tir à la tête",
  // Pompe
  "Point Blank": "+90 % dégâts", "Primed Point Blank": "+165 % dégâts",
  "Hell's Chamber": "+120 % multishot",
  "Incendiary Coat": "+90 % feu", "Charged Shell": "+90 % électricité",
  "Contagious Spread": "+90 % toxine", "Chilling Grasp": "+90 % froid",
  "Ammo Stock": "+60 % chargeur", "Tactical Pump": "+30 % rechargement",
  "Blaze": "+60 % dégâts · +60 % feu",
  "Toxic Barrage": "+60 % toxine · +60 % statut", "Scattering Inferno": "+60 % feu · +60 % statut",
  "Frigid Blast": "+60 % froid · +60 % statut",
  "Blunderbuss": "+90 % chance critique", "Ravage": "+110 % dégâts critiques", "Primed Ravage": "+165 % dégâts critiques",
  "Galvanized Hell": "+80 % multishot · +30 % par kill (cumul ×5)",
  "Galvanized Savvy": "+80 % statut · en kill : dégâts bonus par statut actif",
  // Pistolet
  "Hornet Strike": "+220 % dégâts", "Barrel Diffusion": "+120 % multishot",
  "Lethal Torrent": "+60 % cadence · +60 % multishot",
  "Pistol Gambit": "+120 % chance critique", "Primed Pistol Gambit": "+187 % chance critique",
  "Target Cracker": "+60 % dégâts critiques", "Primed Target Cracker": "+110 % dégâts critiques",
  "Convulsion": "+90 % électricité", "Heated Charge": "+90 % feu",
  "Pathogen Rounds": "+90 % toxine", "Deep Freeze": "+90 % froid",
  "Gunslinger": "+72 % cadence", "Quickdraw": "+48 % rechargement", "Slip Magazine": "+30 % chargeur",
  "Pistol Pestilence": "+60 % toxine · +60 % statut", "Jolt": "+60 % électricité · +60 % statut",
  "Galvanized Diffusion": "+80 % multishot · +30 % par kill (cumul ×5)",
  "Galvanized Shot": "+80 % statut · en kill : dégâts bonus par statut actif",
  // Mêlée
  "Pressure Point": "+120 % dégâts mêlée", "Primed Pressure Point": "+165 % dégâts mêlée",
  "Fury": "+30 % vitesse d'attaque",
  "Berserker Fury": "+35 % vitesse par kill mêlée (max +70 %)",
  "Reach": "+1,1 m de portée",
  "True Steel": "+60 % chance critique", "Sacrificial Steel": "+88 % crit. (doublé en attaque lourde)",
  "Organ Shatter": "+90 % dégâts critiques",
  "Blood Rush": "chance crit. +40 % × multiplicateur de combo",
  "Weeping Wounds": "statut +40 % × multiplicateur de combo",
  "Molten Impact": "+90 % feu", "North Wind": "+90 % froid",
  "Fever Strike": "+90 % toxine", "Primed Fever Strike": "+165 % toxine",
  "Volcanic Edge": "+60 % feu · +60 % statut", "Vicious Frost": "+60 % froid · +60 % statut",
  "Condition Overload": "+80 % dégâts par statut présent sur la cible",
  // Archwing
  "Rubedo-Lined Barrel": "+220 % dégâts", "Automatic Trigger": "+90 % cadence",
  "Parallax Scope": "chance critique augmentée", "Charged Bullets": "+120 % électricité",
  "Hollowed Bullets": "dégâts critiques augmentés", "Combustion Rounds": "+120 % feu",
  "Modified Munitions": "+60 % statut", "Ammo Chain": "+100 % munitions max",
  "Dual Rounds": "+60 % multishot", "Critical Focus": "crit. augmenté en visée",
  "Cutting Edge": "+120 % dégâts", "Furor": "+60 % vitesse d'attaque",
  "Tempered Blade": "chance critique augmentée", "Bleeding Edge": "dégâts critiques augmentés",
  "Sudden Impact": "+120 % impact", "Glacial Edge": "+120 % froid",
  "Searing Steel": "+120 % feu", "Poisonous Sting": "+120 % toxine", "Astral Slash": "+120 % tranchant",
  // Compagnons
  "Link Vitality": "+125 % de la santé max de ta Warframe", "Link Fiber": "+125 % de l'armure de ta Warframe",
  "Animal Instinct": "+30 m radar butin · +18 m radar ennemis",
  "Primed Animal Instinct": "radar butin/ennemis fortement agrandi (Primed)",
  "Fetch": "aspire le butin (13,5 m)", "Vacuum": "aspire le butin (13,5 m)",
  "Pack Leader": "tes coups de mêlée soignent le compagnon",
  "Bite": "+330 % chance critique · +220 % dégâts critiques des griffes", "Maul": "+330 % dégâts de mêlée des griffes",
  "Savagery": "ruée sur 8 ennemis (10 m), renversés à la fin",
  "Hunter Recovery": "tes dégâts soignent le compagnon (30 %)",
  "Momentous Bond": "kill d'Eximus : +120 % élément aléatoire (30 s), −18 s de récupération",
  "Tenacious Bond": "headshot kill : −3 s de récupération · ×1,2 dégâts crit. finaux si crit. compagnon > 50 %",
  "Duplex Bond": "bond : le compagnon se duplique périodiquement",
  "Manifold Bond": "les précepts appliquent les statuts de l'arme · kill sur 3+ statuts : −3 s de recharge",
  "Enhanced Vitality": "+250 % santé du compagnon", "Metal Fiber": "+250 % armure du compagnon",
  "Regen": "−20 s de récupération · 10 s d'invulnérabilité au retour", "Primed Regen": "−35 s de récupération · 10 s d'invulnérabilité au retour",
  "Assault Mode": "la sentinelle attaque les ennemis proches",
  "Guardian": "restaure tes boucliers quand ils tombent",
  "Sanctuary": "bouclier pendant tes réanimations",
  "Synth Deconstruct": "les ennemis marqués lâchent des orbes de santé",
  "Synth Fiber": "les orbes de santé : +100 % d'armure au compagnon (12 s)",
};

/* Carte guides → simulateur (17/07/2026) : chaque page build déclare l'objet et
   les mods (noms EN) de ses 3 paliers — data/arsenal_builds.json, consommée par
   /arsenal?sim=<slug>&tier=<deb|mid|exp>. */
const SIM_MAP = {};
function simEnregistre(slug, type, nom, regles) {
  SIM_MAP[slug] = { t: type, n: nom, tiers: {
    deb: { aura: regles.deb.aura || null, exilus: regles.deb.exilus || null, mods: regles.deb.mods },
    mid: { aura: regles.mid.aura || null, exilus: regles.mid.exilus || null, mods: regles.mid.mods },
    exp: { aura: regles.exp.aura || null, exilus: regles.exp.exilus || null, mods: regles.exp.mods },
  } };
}

/* ---------- règles de builds par palier ---------- */
// Chaque entrée : [nom de mod, note optionnelle]. Un mod absent de MODS = carte texte.
const FRAME_TIERS = {
  deb: {
    t: "🌱 Débutant", cost: "0–1 forma · mods du marché, de Vor et des premières planètes",
    aura: "Energy Siphon", exilus: null,
    mods: ["Vitality", "Redirection", "Steel Fiber", "Flow", "Continuity", "Intensify", "Streamline", "Stretch"],
    note: "La base universelle : survie (Vitalité/Redirection/Fibre d'acier) + les 4 stats de capacité. Tous ces mods tombent tôt (marché pour certains, ennemis/conteneurs des premières planètes) et se montent sans potato.",
  },
  mid: {
    t: "⚙️ Intermédiaire", cost: "2–3 formas + réacteur Orokin · mods corrompus (Déimos) & sets Augur",
    aura: "Energy Siphon", exilus: "Cunning Drift",
    mods: ["Vitality", "Intensify", "Blind Rage", "Fleeting Expertise", "Flow", "Continuity", "Constitution", "Stretch"],
    note: "On pousse la Force avec Blind Rage (coffres des caveaux de Déimos) compensé par Fleeting Expertise. Constitution (Vor's Prize) allonge la durée. Ajuste le curseur Force/Portée/Durée selon la capacité clé de ta frame.",
  },
  exp: {
    t: "🔥 Expert", cost: "4–6 formas + Umbra Forma éventuel · mods Primed (Baro), Umbral (The Sacrifice), Arcanes max",
    aura: "Steel Charge", exilus: "Power Drift",
    mods: ["Umbral Intensify", "Umbral Vitality", "Adaptation", "Primed Continuity", "Primed Flow", "Transient Fortitude", "Archon Stretch", "Blind Rage"],
    note: "Le « build de fou » : set Umbral (2 pièces suffisent souvent), Primed de Baro Ki'Teer, Adaptation (Arbitrages) et un mod d'Archon (chasses d'Archon). Garde un œil sur l'efficacité si tu spammes les capacités.",
  },
};

const WEAPON_RULES = {
  Rifle: {
    label: "Fusil",
    deb:  { mods: ["Serration", "Point Strike", "Hellfire", "Stormbringer", "Cryo Rounds", "Infected Clip", "Fast Hands", "Rupture"], cost: "0–1 forma",
            note: "Dégâts de base + 2 éléments adaptés à la faction (Corrosif = Électrique+Toxine contre les Grineer, Magnétique = Froid+Électrique contre les boucliers Corpus…)." },
    mid:  { mods: ["Serration", "Split Chamber", "Point Strike", "Vital Sense", "Malignant Force", "Rime Rounds", "Hunter Munitions", "Vile Acceleration"], cost: "2–3 formas + catalyseur",
            note: "Split Chamber (multishot) change tout. Les 60/60 (événements/syndicats) montent le statut sans sacrifier les dégâts ; Hunter Munitions (chasses Ostrons) ajoute le saignement sur crit." },
    exp:  { mods: ["Serration", "Galvanized Chamber", "Galvanized Aptitude", "Galvanized Scope", "Vital Sense", "Hunter Munitions", "Primed Cryo Rounds", "Heavy Caliber"], cost: "4–6 formas + catalyseur",
            note: "Mods Galvanized (Arbitrages) qui montent en puissance à chaque kill + Primed de Baro. Arcane d'arme : Primary Merciless (ou Deadhead si tu vises la tête). Un bon Riven remplace Heavy Caliber." },
    arcExp: "Primary Merciless",
  },
  Shotgun: {
    label: "Fusil à pompe",
    deb:  { mods: ["Point Blank", "Incendiary Coat", "Charged Shell", "Contagious Spread", "Chilling Grasp", "Ammo Stock", "Tactical Pump", "Blaze"], cost: "0–1 forma",
            note: "Point Blank + 2 éléments selon la faction. Blaze (dégâts + feu) tombe en Défense/Survie." },
    mid:  { mods: ["Point Blank", "Hell's Chamber", "Blaze", "Toxic Barrage", "Scattering Inferno", "Frigid Blast", "Blunderbuss", "Ravage"], cost: "2–3 formas + catalyseur",
            note: "Hell's Chamber (multishot, Tier 3 Défense) est LE mod pompe. Les 60/60 pompe viennent des syndicats/événements." },
    exp:  { mods: ["Primed Point Blank", "Hell's Chamber", "Galvanized Hell", "Galvanized Savvy", "Blaze", "Primed Ravage", "Blunderbuss", "Frigid Blast"], cost: "4–6 formas + catalyseur",
            note: "Primed Point Blank/Ravage chez Baro, Galvanized aux Arbitrages. Arcane : Primary Merciless. Viral + Feu reste la combinaison la plus polyvalente." },
    arcExp: "Primary Merciless",
  },
  Pistol: {
    label: "Arme de poing",
    deb:  { mods: ["Hornet Strike", "Convulsion", "Heated Charge", "Pathogen Rounds", "Deep Freeze", "Gunslinger", "Quickdraw", "Slip Magazine"], cost: "0–1 forma",
            note: "Hornet Strike d'abord (chaque rang compte), puis 2 éléments adaptés à la faction." },
    mid:  { mods: ["Hornet Strike", "Barrel Diffusion", "Lethal Torrent", "Pistol Gambit", "Target Cracker", "Pistol Pestilence", "Jolt", "Convulsion"], cost: "2–3 formas + catalyseur",
            note: "Barrel Diffusion (multishot) + Lethal Torrent = le cœur de toute arme de poing. 60/60 (Pistol Pestilence/Jolt) via les syndicats." },
    exp:  { mods: ["Hornet Strike", "Galvanized Diffusion", "Galvanized Shot", "Lethal Torrent", "Primed Pistol Gambit", "Primed Target Cracker", "Pistol Pestilence", "Jolt"], cost: "4–6 formas + catalyseur",
            note: "Galvanized Diffusion/Shot aux Arbitrages, Primed chez Baro. Arcane : Secondary Merciless — ou Secondary Encumber pour les armes à statut." },
    arcExp: "Secondary Merciless",
  },
  Melee: {
    label: "Mêlée",
    deb:  { mods: ["Pressure Point", "Fury", "Reach", "Molten Impact", "North Wind", "Fever Strike", "True Steel", "Organ Shatter"], cost: "0–1 forma",
            note: "Pressure Point + vitesse (Fury) + 2 éléments. La stance de ton arme ajoute des points de capacité — mets-la dès que possible." },
    mid:  { mods: ["Pressure Point", "Blood Rush", "Weeping Wounds", "Organ Shatter", "Berserker Fury", "Fever Strike", "Volcanic Edge", "Vicious Frost"], cost: "2–3 formas + catalyseur",
            note: "Blood Rush + Weeping Wounds (missions Déimos/dérivés) : crit et statut explosent avec le compteur de combo. Berserker Fury pour la vitesse." },
    exp:  { mods: ["Primed Pressure Point", "Sacrificial Steel", "Blood Rush", "Weeping Wounds", "Condition Overload", "Organ Shatter", "Primed Fever Strike", "Berserker Fury"], cost: "4–6 formas + catalyseur",
            note: "Condition Overload multiplie les dégâts par statut présent sur la cible. Arcane : Melee Influence (électrique) ou Melee Duplicate. Un Riven de mêlée bien roulé remplace un élément." },
    arcExp: "Melee Influence",
  },
  "Arch-Gun": {
    label: "Arch-fusil",
    deb:  { mods: ["Rubedo-Lined Barrel", "Automatic Trigger", "Parallax Scope", "Charged Bullets", "Hollowed Bullets", "Combustion Rounds", "Modified Munitions", "Ammo Chain"], cost: "0–1 forma",
            note: "Mods d'Arch-fusil : missions Archwing et Salle des profits (Fortuna). Rubedo-Lined Barrel = le « Serration » archwing." },
    mid:  { mods: ["Rubedo-Lined Barrel", "Automatic Trigger", "Parallax Scope", "Hollowed Bullets", "Charged Bullets", "Combustion Rounds", "Dual Rounds", "Critical Focus"], cost: "2 formas + catalyseur",
            note: "Dual Rounds (multishot) et Critical Focus complètent le noyau. Utilisable au sol via le Gravimag (Profit-Taker)." },
    exp:  { mods: ["Rubedo-Lined Barrel", "Dual Rounds", "Automatic Trigger", "Parallax Scope", "Hollowed Bullets", "Critical Focus", "Charged Bullets", "Combustion Rounds"], cost: "3–4 formas + catalyseur",
            note: "Le même noyau poussé au max — les Arch-fusils n'ont ni Galvanized ni arcanes : la marge vient des formas et du Riven d'Arch-fusil." },
    arcExp: null,
  },
  "Arch-Melee": {
    label: "Arch-mêlée",
    deb:  { mods: ["Cutting Edge", "Furor", "Tempered Blade", "Sudden Impact", "Glacial Edge", "Searing Steel", "Poisonous Sting", "Astral Slash"], cost: "0–1 forma",
            note: "Cutting Edge (dégâts) + Furor (vitesse) + éléments. Tout vient des missions Archwing." },
    mid:  { mods: ["Cutting Edge", "Furor", "Tempered Blade", "Bleeding Edge", "Sudden Impact", "Glacial Edge", "Searing Steel", "Poisonous Sting"], cost: "2 formas",
            note: "Bleeding Edge (crit) s'ajoute au noyau. L'Arch-mêlée sert surtout dans les missions Empyrée (abordages)." },
    exp:  { mods: ["Cutting Edge", "Bleeding Edge", "Furor", "Tempered Blade", "Sudden Impact", "Glacial Edge", "Searing Steel", "Poisonous Sting"], cost: "3 formas + catalyseur",
            note: "Noyau max. Pas d'arcanes ni de Galvanized côté Arch-mêlée — la profondeur vient des formas." },
    arcExp: null,
  },
};
// familles rattachées aux règles ci-dessus
const TYPE_ALIAS = { Bow: "Rifle", Sniper: "Rifle", Launcher: "Rifle", "Dual Pistols": "Pistol", Throwing: "Pistol" };
const TYPE_NOTE = {
  Bow: "Arc : privilégie le crit (Point Strike/Vital Sense) — les flèches chargées critiquent fort.",
  Sniper: "Sniper : vise la tête ; le combo de zoom multiplie les dégâts.",
  Launcher: "Lance-projectiles : attention à l'auto-dégât réduit mais réel ; Firestorm (rayon) est un excellent 9e choix en Exilus d'arme.",
  "Dual Pistols": "Doubles pistolets : cadence élevée = les 60/60 statut brillent.",
  Throwing: "Arme de jet : fonctionne aussi en furtif ; Concealed Explosives (Baro) est une variante fun.",
};

/* ---------- Notes d'actualité par slug (ajout 2026-07-15) ----------
   Affichées juste au-dessus des « 3 builds », en FR et EN. Sources : patch
   notes maj 43 « Jade Shadows: Constellations » + debriefs vidéo Pandaahh
   Warframe Chronicles. HTML brut (liens autorisés) — retirer une entrée
   quand l'info devient obsolète. */
const SLUG_NOTES = {
  "styanax": {
    fr: `Depuis la maj 43 (<a href="/guides/ombres-de-jade-constellations">Les Ombres de Jade : Constellations</a>), Styanax Prime est disponible. En jeu : son 3 rend boucliers et énergie à l'équipe à chaque incantation, son 2 devient un gros buff de dégâts critiques avec son augment, et son passif est doublé avec une lance-harpon (Afentis, Ferrox). Rotation de level cap testée par <a href="https://www.youtube.com/watch?v=_sxFT6MzngI" target="_blank" rel="noopener">Pandaahh (Cascade)</a> : <b>Rugissement de Rhino en Helminth sur le 1</b> (le natif ne sert plus à grand-chose une fois le 3 et le 4 en place), <b>Létalité de Taros</b> — l'augment du 2 — pour de gros dégâts critiques, et <b>Avancée Résolue</b> — l'augment du 4 — pour distribuer de la Surgarde à toute l'équipe à chaque frappe. Compagnon conseillé : un <b>Huras</b> (invisibilité + Posture Assassine, cible en priorité les ennemis à Surgarde) avec un <a href="/builds/paris-prime">Paris Prime</a> pour booster ses griffes, ou un <a href="/builds/nautilus">Nautilus</a> qui regroupe les cibles pour le 4. Secondaire : le <a href="/builds/grimoire">Grimoire</a> en Viral + Magnétique pour l'appoint.`,
    en: `Since Update 43 (Jade Shadows: Constellations), Styanax Prime is out. In play: his 3 restores squad shields and energy on every cast, his 2 becomes a big crit-damage buff with its augment, and his passive is doubled with a speargun (Afentis, Ferrox). Level-cap rotation tested by Pandaahh (Void Cascade): <b>Roar as Helminth on the 1</b> (the native ability does little once the 3 and 4 are running), <b>Tharros Lethality</b> — the 2's augment — for big crit damage, and <b>Intrepid Stand</b> — the 4's augment — to hand the whole squad Overguard on every hit. Recommended companion: a <b>Huras</b> (invisibility + Assassin Posture, prioritizes Overguard targets) paired with a <a href="/en/builds/paris-prime">Paris Prime</a> to boost its claws, or a <a href="/en/builds/nautilus">Nautilus</a> to group targets for the 4. Secondary: the <a href="/en/builds/grimoire">Grimoire</a> built Viral + Magnetic as a top-up.`,
  },
  "styanax-prime": {
    fr: `Arrivé avec la maj 43 (<a href="/guides/ombres-de-jade-constellations">Les Ombres de Jade : Constellations</a>) aux côtés de l'Afentis Prime et de l'Athodai Prime. En jeu : son 3 rend boucliers et énergie à l'équipe à chaque incantation, son 2 + augment = gros buff critique, et son passif est doublé avec une lance-harpon (Afentis, Ferrox). Rotation de level cap testée par <a href="https://www.youtube.com/watch?v=_sxFT6MzngI" target="_blank" rel="noopener">Pandaahh (Cascade)</a> : <b>Rugissement de Rhino en Helminth sur le 1</b> (le natif ne sert plus à grand-chose une fois le 3 et le 4 en place), <b>Létalité de Taros</b> — l'augment du 2 — pour de gros dégâts critiques, et <b>Avancée Résolue</b> — l'augment du 4 — pour distribuer de la Surgarde à toute l'équipe à chaque frappe. Compagnon conseillé : un <b>Huras</b> (invisibilité + Posture Assassine, cible en priorité les ennemis à Surgarde) avec un <a href="/builds/paris-prime">Paris Prime</a> pour booster ses griffes, ou un <a href="/builds/nautilus">Nautilus</a> qui regroupe les cibles pour le 4. Secondaire : le <a href="/builds/grimoire">Grimoire</a> en Viral + Magnétique pour l'appoint.`,
    en: `Released with Update 43 (Jade Shadows: Constellations) alongside Afentis Prime and Athodai Prime. His 3 restores squad shields and energy on every cast, his 2 with its augment is a big crit buff, and his passive doubles with a speargun (Afentis, Ferrox). Level-cap rotation tested by Pandaahh (Void Cascade): <b>Roar as Helminth on the 1</b> (the native ability does little once the 3 and 4 are running), <b>Tharros Lethality</b> — the 2's augment — for big crit damage, and <b>Intrepid Stand</b> — the 4's augment — to hand the whole squad Overguard on every hit. Recommended companion: a <b>Huras</b> (invisibility + Assassin Posture, prioritizes Overguard targets) paired with a <a href="/en/builds/paris-prime">Paris Prime</a> to boost its claws, or a <a href="/en/builds/nautilus">Nautilus</a> to group targets for the 4. Secondary: the <a href="/en/builds/grimoire">Grimoire</a> built Viral + Magnetic as a top-up.`,
  },
  "nidus": {
    fr: `Maj 43 (juin 2026) : Nidus a reçu une retouche complète — pouvoirs revus et survie renforcée. Un des grands gagnants de <a href="/guides/ombres-de-jade-constellations">la mise à jour</a>.`,
    en: `Update 43 (June 2026): Nidus received a full ability retouch with improved survivability — one of the update's big winners.`,
  },
  "nidus-prime": {
    fr: `Maj 43 (juin 2026) : Nidus a reçu une retouche complète — pouvoirs revus et survie renforcée. Un des grands gagnants de <a href="/guides/ombres-de-jade-constellations">la mise à jour</a>.`,
    en: `Update 43 (June 2026): Nidus received a full ability retouch with improved survivability — one of the update's big winners.`,
  },
  "vectis": {
    fr: `Maj 43 : le Vectis reçoit un adaptateur <a href="/guides/rotation-incarnon">Incarnon Genesis</a> — il se charge aux tirs à la tête ; en forme Incarnon, un tir au corps applique du Froid et un tir à la tête déclenche une explosion de glace en zone.`,
    en: `Update 43: Vectis got an Incarnon Genesis adapter — charge it with headshots; in Incarnon form, body shots apply Cold and headshots trigger an icy area explosion.`,
  },
  "vectis-prime": {
    fr: `Maj 43 : le Vectis reçoit un adaptateur <a href="/guides/rotation-incarnon">Incarnon Genesis</a> (il s'applique à la version normale) — chargé aux tirs à la tête ; en forme Incarnon, un tir au corps applique du Froid et un tir à la tête déclenche une explosion de glace en zone.`,
    en: `Update 43: the Vectis got an Incarnon Genesis adapter (it applies to the base version) — charge it with headshots; in Incarnon form, body shots apply Cold and headshots trigger an icy area explosion.`,
  },
  "stug": {
    fr: `Maj 43 : le Stug reçoit un adaptateur <a href="/guides/rotation-incarnon">Incarnon Genesis</a> (projectiles qui ricochent puis explosent) — l'arme la plus moquée du jeu devient enfin jouable.`,
    en: `Update 43: the Stug got an Incarnon Genesis adapter (bouncing, exploding projectiles) — the game's most memed weapon is finally viable.`,
  },
  "temple": {
    fr: `Maj 43 : nouvel augment « Rhythm Guard » (syndicats) — de la Surgarde à chaque pouvoir lancé en rythme, montant doublé à chaque battement réussi. Le défensif de Temple respire enfin.`,
    en: `Update 43: new "Rhythm Guard" augment (syndicates) — gain Overguard when casting on the Backbeat, doubling with each successful beat. Temple's defense finally breathes.`,
  },
  "dante": {
    fr: `Maj 43 : nouvel augment « Noctua Swarm » (syndicats) — le tir alternatif du Noctua libère des Paragrimms qui réduisent les ennemis au silence et volent leur énergie pour les alliés.`,
    en: `Update 43: new "Noctua Swarm" augment (syndicates) — Noctua's alternate fire releases Paragrimms that silence enemies and steal their energy for allies.`,
  },
  "braton-vandal": {
    fr: `Testé en live par <a href="https://www.youtube.com/watch?v=v31w1_XJ5fM" target="_blank" rel="noopener">Pandaahh (vidéo)</a> : en forme Incarnon, un build <b>Corrosif + Glace</b> surprend — l'explosion radiale des tirs nuke les groupes et one-tap presque tout, jusqu'au level cap. Pourquoi pas Viral ? Viral = Froid + Toxine : garder la Glace séparée impose le Corrosif. Conseils : ne sacrifie jamais la cadence de tir (Charpie va bien sur la polarité V), et la sentinelle Nautilus (qui regroupe les ennemis) compense le côté très mono-cible.`,
    en: `Live-tested by Pandaahh: in Incarnon form, a <b>Corrosive + Cold</b> build surprises — the radial explosion nukes groups and one-taps almost everything, up to level cap. Why not Viral? Viral = Cold + Toxin, so keeping Cold separate forces Corrosive. Tips: never sacrifice fire rate (Shred fits the V polarity), and the Nautilus sentinel (groups enemies) offsets the very single-target feel.`,
  },
  "braton": {
    fr: `L'adaptateur Incarnon du Braton vaut pour les quatre versions (Braton, MK1, Vandal, Prime — défis partagés). En Incarnon, le build <b>Corrosif + Glace</b> testé en live par <a href="https://www.youtube.com/watch?v=v31w1_XJ5fM" target="_blank" rel="noopener">Pandaahh</a> nuke les groupes via l'explosion radiale — garde absolument ta cadence de tir, et pense au Nautilus pour regrouper les cibles.`,
    en: `The Braton Incarnon adapter covers all four versions (Braton, MK1, Vandal, Prime — shared challenges). In Incarnon form, a <b>Corrosive + Cold</b> build nukes groups through the radial explosion — keep your fire rate at all costs, and consider the Nautilus sentinel to group targets.`,
  },
  "braton-prime": {
    fr: `L'adaptateur Incarnon du Braton vaut pour les quatre versions (Braton, MK1, Vandal, Prime — défis partagés). En Incarnon, le build <b>Corrosif + Glace</b> testé en live par <a href="https://www.youtube.com/watch?v=v31w1_XJ5fM" target="_blank" rel="noopener">Pandaahh</a> nuke les groupes via l'explosion radiale — garde absolument ta cadence de tir, et pense au Nautilus pour regrouper les cibles.`,
    en: `The Braton Incarnon adapter covers all four versions (Braton, MK1, Vandal, Prime — shared challenges). In Incarnon form, a <b>Corrosive + Cold</b> build nukes groups through the radial explosion — keep your fire rate at all costs, and consider the Nautilus sentinel to group targets.`,
  },
  "mk1-braton": {
    fr: `L'adaptateur Incarnon du Braton vaut pour les quatre versions (Braton, MK1, Vandal, Prime — défis partagés). En Incarnon, le build <b>Corrosif + Glace</b> testé en live par <a href="https://www.youtube.com/watch?v=v31w1_XJ5fM" target="_blank" rel="noopener">Pandaahh</a> nuke les groupes via l'explosion radiale — garde absolument ta cadence de tir, et pense au Nautilus pour regrouper les cibles.`,
    en: `The Braton Incarnon adapter covers all four versions (Braton, MK1, Vandal, Prime — shared challenges). In Incarnon form, a <b>Corrosive + Cold</b> build nukes groups through the radial explosion — keep your fire rate at all costs, and consider the Nautilus sentinel to group targets.`,
  },
  "banshee": {
    fr: `Le combo classique <b>Banshee + Kuva Chakkhurr</b> marche toujours (<a href="https://www.youtube.com/watch?v=Qj5-TVGRsjk" target="_blank" rel="noopener">retesté en live par Pandaahh</a>) : le Sonar dévoile des points faibles qui multiplient énormément les dégâts — une balle de Chakkhurr dessus one-tap à peu près tout, Acolytes compris. Conseils du test : privilégie l'efficacité au défensif, garde Silence actif pour être moins ciblé, l'augment du Sonar repropage les points faibles à chaque kill, et Gloom (Helminth) ralentit tout ce qui approche. <b>Refonte sortie avec la maj 44</b> (<a href="/guides/iceblade-de-narin">Iceblade of Narin</a>, 23/09/2026) : plus aucun pouvoir ne l'immobilise, Sonic Boom retire 70 % d'armure (jusqu'à 100 % avec la Force), et les zones du Sonar deviennent de vrais <b>points faibles</b> — les mods et arcanes « point faible » s'y appliquent, ce qui renforce encore ce combo. Sonic Fracture devient <b>Sonic Siphon</b>, Resonating Quake devient <b>Gaseous Quake</b> (l'ancien 4 canalisé). Banshee et une Forma sont offertes à la connexion jusqu'au 7 octobre.`,
    en: `The classic <b>Banshee + Kuva Chakkhurr</b> combo still works (live-retested by Pandaahh): Sonar reveals weak points that massively multiply damage — one Chakkhurr shot on them one-taps nearly everything, Acolytes included. Tips: favor efficiency over defense, keep Silence up to draw less aggro, Sonar's augment re-spreads weak points on every kill, and Gloom (Helminth) slows everything nearby. <b>Rework released with Update 44</b> (<a href="/en/guides/iceblade-of-narin">Iceblade of Narin</a>, 9/23/2026): no ability roots her anymore, Sonic Boom strips 70% armor (up to 100% with Strength), and Sonar spots become true <b>Weak Points</b> — Weak Point mods and arcanes now apply, making this combo even stronger. Sonic Fracture becomes <b>Sonic Siphon</b>, Resonating Quake becomes <b>Gaseous Quake</b> (the old channeled 4). Banshee and a Forma are free on login until October 7.`,
  },
  "banshee-prime": {
    fr: `Le combo classique <b>Banshee + Kuva Chakkhurr</b> marche toujours (<a href="https://www.youtube.com/watch?v=Qj5-TVGRsjk" target="_blank" rel="noopener">retesté en live par Pandaahh</a>) : le Sonar dévoile des points faibles qui multiplient énormément les dégâts — une balle de Chakkhurr dessus one-tap à peu près tout, Acolytes compris. Conseils du test : privilégie l'efficacité au défensif, garde Silence actif pour être moins ciblé, l'augment du Sonar repropage les points faibles à chaque kill, et Gloom (Helminth) ralentit tout ce qui approche. <b>Refonte sortie avec la maj 44</b> (<a href="/guides/iceblade-de-narin">Iceblade of Narin</a>, 23/09/2026) : plus aucun pouvoir ne l'immobilise, Sonic Boom retire 70 % d'armure (jusqu'à 100 % avec la Force), et les zones du Sonar deviennent de vrais <b>points faibles</b> — les mods et arcanes « point faible » s'y appliquent, ce qui renforce encore ce combo. Sonic Fracture devient <b>Sonic Siphon</b>, Resonating Quake devient <b>Gaseous Quake</b> (l'ancien 4 canalisé). Banshee et une Forma sont offertes à la connexion jusqu'au 7 octobre.`,
    en: `The classic <b>Banshee + Kuva Chakkhurr</b> combo still works (live-retested by Pandaahh): Sonar reveals weak points that massively multiply damage — one Chakkhurr shot on them one-taps nearly everything, Acolytes included. Tips: favor efficiency over defense, keep Silence up to draw less aggro, Sonar's augment re-spreads weak points on every kill, and Gloom (Helminth) slows everything nearby. <b>Rework released with Update 44</b> (<a href="/en/guides/iceblade-of-narin">Iceblade of Narin</a>, 9/23/2026): no ability roots her anymore, Sonic Boom strips 70% armor (up to 100% with Strength), and Sonar spots become true <b>Weak Points</b> — Weak Point mods and arcanes now apply, making this combo even stronger. Sonic Fracture becomes <b>Sonic Siphon</b>, Resonating Quake becomes <b>Gaseous Quake</b> (the old channeled 4). Banshee and a Forma are free on login until October 7.`,
  },
  "kuva-chakkhurr": {
    fr: `<a href="https://www.youtube.com/watch?v=Qj5-TVGRsjk" target="_blank" rel="noopener">Retesté en live par Pandaahh</a> : toujours excellent. Build dégâts bruts + <b>Viral</b> (avec un progéniteur Toxine, un simple mod de Glace suffit — un slot gagné), <b>Munitions du chasseur</b> pour que le saignement achève les survivants, chance/dégâts critiques empilés et <b>Viseur galvanisé</b> (tirs à la tête). Ne cours pas après la cadence : ça se joue <b>comme un sniper</b>, une balle = un kill — arcanes type Impitoyable (recharge) ou Canonnade (gros dégâts, cadence figée). Combo ultime : la Banshee et son Sonar, pour du one-tap jusqu'aux Acolytes.`,
    en: `Live-retested by Pandaahh: still excellent. Raw-damage build + <b>Viral</b> (with a Toxin progenitor, a single Cold mod is enough — one slot saved), <b>Hunter Munitions</b> so the Slash proc finishes survivors, stacked crit chance/damage and <b>Galvanized Scope</b> (headshots). Don't chase fire rate: play it <b>like a sniper</b>, one bullet = one kill — arcanes like Merciless (reload) or Cannonade (big damage, locked fire rate). Ultimate combo: Banshee's Sonar, for one-taps up to Acolytes.`,
  },
  "grimoire": {
    fr: `Deux conseils du <a href="https://www.youtube.com/watch?v=bAFlKKwO89M" target="_blank" rel="noopener">live Pandaahh</a> : ① les <b>mods de Tome</b> se farment en Défense Miroir (rotation C, 8 mods, RNG infâme ≈ 10-15 h) — l'un des rares cas où acheter le <b>pack à 140 platines</b> du marché vaut vraiment le coup ; ② sur une frame qui ne se sert pas de sa secondaire (Mesa…), équipe le Grimoire en « bâton de stats » : un tir alternatif de temps en temps et ses mods de Tome buffent tout le groupe (puissance de pouvoir, orbes universelles…). Le réglage précis vu sur <a href="https://www.youtube.com/watch?v=_sxFT6MzngI" target="_blank" rel="noopener">Styanax en level cap</a> : ~12 % de chance d'orbe universelle par tir et un bonus de puissance de pouvoir pour toi ET ton équipe.`,
    en: `Two tips from Pandaahh's live: ① <b>Tome mods</b> drop from Mirror Defense (rotation C, 8 mods, dreadful RNG ≈ 10-15 h) — one of the rare cases where buying the <b>140-platinum Market bundle</b> is genuinely worth it; ② on a frame that never uses its secondary (Mesa…), equip the Grimoire as a stat-stick: an occasional alt-fire and its Tome mods buff the whole squad (ability strength, universal orbs…). The exact tuning seen on a level-cap Styanax: ~12% chance of a universal orb per shot, plus an ability-strength bonus for you AND your squad.`,
  },
  "vasca-kavat": {
    fr: `Le processus d'empreintes contaminées (faire mordre son kavat de nuit sur Cetus, deux fois) est une plaie — au <a href="https://www.youtube.com/watch?v=bAFlKKwO89M" target="_blank" rel="noopener">live</a>, Pandaahh conseille carrément le <b>kit du marché (~105 platines)</b> qui contient les deux empreintes. Le jeu en vaut la chandelle : le Vasca te <b>réanime à la mort</b> en sacrifiant ses PV, de façon fiable et non aléatoire.`,
    en: `The tainted-imprint process (getting your kavat bitten at night on Cetus, twice) is a pain — on stream, Pandaahh flat-out recommends the <b>Market kit (~105 platinum)</b> with both imprints included. Worth it: the Vasca <b>revives you on death</b> by sacrificing its HP, reliably and without RNG.`,
  },
  "dual-toxocyst": {
    fr: `God roll Riven selon Pandaahh : <b>tir multiple + dégâts critiques + pénétration</b> — la pénétration est LA particularité du Riven des Dual Toxocyst (elle dépasse celle des mods, jusqu'à ~4 m) — avec un négatif indolore (−zoom, −vitesse de projectile). −capacité de chargeur n'est pas un god roll. Et depuis, <a href="https://www.youtube.com/watch?v=FZimD1ef_8o" target="_blank" rel="noopener">Pandaahh les couronne « meilleure secondaire du jeu »</a> : en forme Incarnon, les ricochets touchent si souvent la tête que le passif <b>Frenzy</b> et la recharge de l'Incarnon s'entretiennent tout seuls. Ses deux paires préférées : <b>Cyte-09</b> (le 1 marque les points faibles à travers les murs — on recharge l'Incarnon sans s'exposer) et <b>Harrow + augment Lasting Covenant</b> (chaque kill à la tête prolonge le buff crit du 4 : crit rouge quasi permanent). Ajoute l'arcane <b>Tonnerre de Feu</b> (Hot Shot : +6 % de chance de crit d'arme par statut Feu infligé via des pouvoirs, 50 cumuls = +300 %), entretenu par un Molosse qui proc le Feu — démonstration en survie Circulus (Lua) « jusqu'au level 10 000 sans bégayer ».`,
    en: `Riven god roll per Pandaahh: <b>multishot + crit damage + punch through</b> — punch through is THE Dual Toxocyst riven specialty (it beats what mods provide, up to ~4 m) — plus a harmless negative (−zoom, −projectile speed). −magazine capacity is not a god roll. Since then, <a href="https://www.youtube.com/watch?v=FZimD1ef_8o" target="_blank" rel="noopener">Pandaahh crowns them "the best secondary in the game"</a>: in Incarnon form the ricochets hit heads so often that the <b>Frenzy</b> passive and the Incarnon charge sustain themselves. His two favorite pairings: <b>Cyte-09</b> (his 1 marks weak points through walls — charge the Incarnon without exposing yourself) and <b>Harrow + Lasting Covenant</b> (every headshot kill extends the 4's crit buff: near-permanent red crits). Add the <b>Hot Shot</b> arcane (+6% weapon crit chance per ability-inflicted Heat status, 50 stacks = +300%), kept stacked by a Heat-proccing Hound — demonstrated in Circulus survival (Lua) "up to level 10,000 without stuttering".`,
  },
  "revenant": {
    fr: `Astuce du live Pandaahh : les dégâts en % de PV (« true damage ») de Revenant sont plafonnés — le cap saute avec un <b>buff de dégâts type Rugissement (Rhino, via Helminth)</b> ou du <b>Viral</b> sur la cible. Revenant + Rugissement + une arme virale : même les Thrax fondent.`,
    en: `Tip from Pandaahh's live: Revenant's %-HP ("true") damage is capped — the cap breaks with a <b>damage buff like Roar (Rhino, via Helminth)</b> or <b>Viral</b> on the target. Revenant + Roar + a viral weapon: even Thrax melt.`,
  },
  "revenant-prime": {
    fr: `Astuce du live Pandaahh : les dégâts en % de PV (« true damage ») de Revenant sont plafonnés — le cap saute avec un <b>buff de dégâts type Rugissement (Rhino, via Helminth)</b> ou du <b>Viral</b> sur la cible. Revenant + Rugissement + une arme virale : même les Thrax fondent.`,
    en: `Tip from Pandaahh's live: Revenant's %-HP ("true") damage is capped — the cap breaks with a <b>damage buff like Roar (Rhino, via Helminth)</b> or <b>Viral</b> on the target. Revenant + Roar + a viral weapon: even Thrax melt.`,
  },
  "sobek": {
    fr: `Avis du live Pandaahh : le Sobek ne brille vraiment qu'avec une frame qui <b>ajoute un élément</b> à tes armes (Saryn, Volt…). Sur les autres, il déçoit — un Strun bien buildé fera mieux.`,
    en: `Take from Pandaahh's live: the Sobek only truly shines with a frame that <b>adds an element</b> to your weapons (Saryn, Volt…). On anything else it underwhelms — a well-built Strun will do better.`,
  },
};
const RIVEN_SHOTGUN_NOTE = {
  fr: `Conseil Riven du <a href="https://www.youtube.com/watch?v=bAFlKKwO89M" target="_blank" rel="noopener">live Pandaahh</a> : sur un fusil à pompe qui crache autant de plombs, la stat reine est le <b>tir multiple</b> (avec dégâts crit et statut). Et le <b>−impact est un négatif en or</b> : l'arme est à dominance Impact, en réduire la part laisse passer bien plus de statuts élémentaires. Évite la Glace sur le Riven (elle fusionne et verrouille ton build) et fuis tout négatif anti-faction (≈ −48 % de dégâts globaux).`,
  en: `Riven tip from Pandaahh's live: on a shotgun spitting this many pellets, the king stat is <b>multishot</b> (with crit damage and status). A <b>−impact negative is gold</b>: the weapon is Impact-dominant, trimming it lets far more elemental procs through. Avoid Cold on the riven (it merges and locks your build) and dump any negative faction stat (≈ −48% total damage).`,
};
const GLAXION_NOTE = {
  fr: `« La petite sœur du Torid » selon Pandaahh : moins forte, mais <b>sans forme Incarnon à charger</b> — et elle fait largement le taf. La version Tenet, facile à récupérer, devient passe-partout avec Aptitude galvanisée et une source de Viral.`,
  en: `"The Torid's little sister" per Pandaahh: not as strong, but with <b>no Incarnon form to charge</b> — and it more than does the job. The easy-to-get Tenet version becomes an everywhere-gun with Galvanized Aptitude and a Viral source.`,
};
for (const s of ["boar", "boar-prime", "strun", "strun-wraith", "strun-prime", "mk1-strun"]) SLUG_NOTES[s] = RIVEN_SHOTGUN_NOTE;
for (const s of ["glaxion", "glaxion-vandal"]) SLUG_NOTES[s] = GLAXION_NOTE;
SLUG_NOTES["tenet-glaxion"] = {
  fr: `${GLAXION_NOTE.fr} Depuis l'ajout de l'arcane <b>Primary Debilitate</b>, le Tenet Glaxion est devenu l'une des meilleures armes principales du jeu (<a href="https://www.youtube.com/watch?v=XeIHvnsM5s4" target="_blank" rel="noopener">testé en live par Pandaahh</a>) : dès qu'un élément combiné (Viral, Radiation, Magnétique…) atteint 10 cumuls sur une cible, l'arcane ajoute des cumuls d'un de ses éléments composants qui infligent des dégâts sur la durée — de quoi tenir un level cap entier sans aucun buffer de dégâts, juste avec les crits gagnés en plus. Combo testé avec Nyx (sans son 4) + Helminth <b>Prime explosive de Nova</b> ou <b>Murmure de Xata</b>, et une arme de mêlée qui maintient l'<a href="/arcanes/">arcane Tonnerre de Feu</a> à son cumul max.`,
  en: `${GLAXION_NOTE.en} Since the addition of the <b>Primary Debilitate</b> arcane, the Tenet Glaxion has become one of the game's best primaries (live-tested by Pandaahh): once a combined element (Viral, Radiation, Magnetic…) reaches 10 stacks on a target, the arcane adds stacks of one of its component elements that deal damage over time — enough to hold an entire level cap with no damage buffer at all, just the extra crits it grants. Combo tested with Nyx (skipping her 4) + Helminth <b>Nova's Molecular Prime</b> or <b>Xata's Whisper</b>, and a melee weapon that keeps the <a href="/arcanes/">Hot Shot arcane</a> (French) at max stacks.`,
};
const SLUG_NOTES_SUITE = {
  "kuva-ogris": {
    fr: `L'arme du farm d'Arbitrage (<a href="https://www.youtube.com/watch?v=p9yucCfCEuM" target="_blank" rel="noopener">testée en live par Pandaahh</a>) : avec <b>Napalm Nocturne</b> (drop chez Kela De Thaym, Sedna), Tempête de feu, tir multiple, mutation de munitions et <b>Munitions énergisées</b> (Helminth) pour l'économie de balles, ses flaques de feu « préchauffent » les zones de spawn et tout meurt en continu — <a href="/guides/farmer-vitus-arbitrage">la méthode complète : 700 Vitus en 1h27</a>.`,
    en: `The Arbitration-farm weapon (live-tested by Pandaahh): with <b>Nightwatch Napalm</b> (drops from Kela De Thaym, Sedna), Firestorm, multishot, ammo mutation and <b>Energized Munitions</b> (Helminth) for ammo economy, its fire pools "pre-heat" spawn zones so everything dies continuously.`,
  },
  "ogris": {
    fr: `Avec <b>Napalm Nocturne</b> (drop chez Kela De Thaym), l'Ogris devient une machine à contrôler les zones de spawn — la version Kuva fait encore mieux : voir <a href="/guides/farmer-vitus-arbitrage">la méthode d'Arbitrage à 700 Vitus/1h27</a>.`,
    en: `With <b>Nightwatch Napalm</b> (drops from Kela De Thaym), the Ogris becomes a spawn-zone control machine — the Kuva version does it even better.`,
  },
  "dagath": {
    fr: `Le choix « boss » actuel de Pandaahh : « en dégâts bruts, difficile de la concurrencer ». Moins adaptée aux jeux de statuts, mais pour effacer une cible dure, c'est une valeur sûre. Et c'est « un des plus gros buffers du jeu » : son augment <b>double les dégâts critiques</b> sur les cibles marquées — des phases de crit qui one-tap à peu près tout. Son défensif est spécial, mais une fois apprivoisé, tout roule.`,
    en: `Pandaahh's current boss pick: "for raw damage, she's hard to beat." Less suited to status play, but to erase a tough single target she's a safe bet. She's also "one of the game's biggest buffers": her augment <b>doubles crit damage</b> on marked targets — crit phases that one-tap nearly everything. Her defensive kit is unusual, but once tamed it all flows.`,
  },
  "saryn-prime": {
    fr: `Buffer reine du farm d'Arbitrage : son kit ajoute déjà poison et corrosif (un simple mod Toxine suffit pour passer l'arme en Viral), et l'augment du 1 donne du Corrosif à toute l'équipe — <a href="/guides/farmer-vitus-arbitrage">voir la méthode Vitus (700 en 1h27)</a>.`,
    en: `Queen buffer of the Arbitration farm: her kit already adds toxin and corrosive (a single Toxin mod turns your weapon Viral), and her 1's augment grants Corrosive to the whole squad.`,
  },
  "phenmor": {
    fr: `Retouche de setup en <a href="https://www.youtube.com/watch?v=RM8FCNqG4m4" target="_blank" rel="noopener">live par Pandaahh</a> : deux philosophies valables — <b>crit</b> ou <b>non-crit</b> (le non-crit déclenche plus souvent le bonus de dégâts de l'Incarnon ; le −chance de crit <b>et</b> le −perforation sont alors des négatifs de Riven bienvenus, et on évite les mods Vigilante). Ne cumule pas deux sources de dégâts qui ne synergisent pas (feu vs tranchant) : privilégies-en une, avec Élémentaliste qui profite aux deux. Arme mono-cible mais dévastatrice — et couplée à <b>Gauss</b>, n'ajoute pas de cadence : son 4 en donne déjà énormément.`,
    en: `Setup fix live by Pandaahh: two valid philosophies — <b>crit</b> or <b>non-crit</b> (non-crit procs the Incarnon damage bonus more often; both −crit chance <b>and</b> −puncture are then welcome riven negatives, and skip Vigilante mods). Don't stack two damage sources that don't synergize (heat vs slash): pick one, with Elementalist benefiting either. Single-target but devastating — and paired with <b>Gauss</b>, skip fire-rate mods: his 4 already provides plenty.`,
  },
  "gauss": {
    fr: `Le combo du <a href="https://www.youtube.com/watch?v=RM8FCNqG4m4" target="_blank" rel="noopener">live Pandaahh</a> : <b>Murmure de Xata</b> (Helminth, sur le 2) + Transfert thermique = une synergie explo « géniale », idéale avec un Phenmor. Conseils : pas besoin d'allonger la durée (déjà très haute) — un arcane déclenché à la roulade (vol d'armure + Surgarde) rend bien plus service —, et n'empile pas la cadence sur l'arme : le 4 de Gauss en donne déjà énormément, recharge comprise. Et pour un <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">stuff débutant qui traverse le Steel Path</a> (SOS Bambi) : augment <b>Transfert thermique</b> sur le 3 (appui long Feu + appui court Froid = gros bonus Explosif sur l'arme — à 10 cumuls, l'Explosif détone en chaîne dans 5 m), <b>Rugissement</b> (Rhino, Helminth) en buff, et <b>arcane Égide</b> : une seule proc et le bouclier se régénère sans délai, même sous le feu. Déplace-toi toujours au 1 : ça charge la batterie.`,
    en: `The combo from Pandaahh's live: <b>Xata's Whisper</b> (Helminth, over his 2) + Thermal Sunder = a "brilliant" blast synergy, ideal with a Phenmor. Tips: no need to stack duration (already very high) — a roll-triggered arcane (armor steal + Overguard) helps far more —, and don't stack fire rate on your weapon: Gauss's 4 already provides plenty, reload included. And for a beginner kit that walks through the Steel Path (SOS Bambi): the <b>Thermal Transfer</b> augment on the 3 (hold Heat + tap Cold = a big Blast bonus on your weapon — at 10 stacks Blast chain-detonates within 5 m), <b>Roar</b> (Rhino, Helminth) as the buff, and <b>Arcane Aegis</b>: one proc and your shields regenerate with no delay, even under fire. Always move with your 1: it charges the battery.`,
  },
  "gauss-prime": {
    fr: `Le combo du <a href="https://www.youtube.com/watch?v=RM8FCNqG4m4" target="_blank" rel="noopener">live Pandaahh</a> : <b>Murmure de Xata</b> (Helminth, sur le 2) + Transfert thermique = une synergie explo « géniale », idéale avec un Phenmor. Conseils : pas besoin d'allonger la durée (déjà très haute) — un arcane déclenché à la roulade (vol d'armure + Surgarde) rend bien plus service —, et n'empile pas la cadence sur l'arme : le 4 de Gauss en donne déjà énormément, recharge comprise. Et pour un <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">stuff débutant qui traverse le Steel Path</a> (SOS Bambi) : augment <b>Transfert thermique</b> sur le 3 (appui long Feu + appui court Froid = gros bonus Explosif sur l'arme — à 10 cumuls, l'Explosif détone en chaîne dans 5 m), <b>Rugissement</b> (Rhino, Helminth) en buff, et <b>arcane Égide</b> : une seule proc et le bouclier se régénère sans délai, même sous le feu. Déplace-toi toujours au 1 : ça charge la batterie.`,
    en: `The combo from Pandaahh's live: <b>Xata's Whisper</b> (Helminth, over his 2) + Thermal Sunder = a "brilliant" blast synergy, ideal with a Phenmor. Tips: no need to stack duration (already very high) — a roll-triggered arcane (armor steal + Overguard) helps far more —, and don't stack fire rate on your weapon: Gauss's 4 already provides plenty, reload included. And for a beginner kit that walks through the Steel Path (SOS Bambi): the <b>Thermal Transfer</b> augment on the 3 (hold Heat + tap Cold = a big Blast bonus on your weapon — at 10 stacks Blast chain-detonates within 5 m), <b>Roar</b> (Rhino, Helminth) as the buff, and <b>Arcane Aegis</b>: one proc and your shields regenerate with no delay, even under fire. Always move with your 1: it charges the battery.`,
  },
  "amprex": {
    fr: `Crit rouge sans équipement de fin de jeu, <a href="https://www.youtube.com/watch?v=3QZ6zbEmJR8" target="_blank" rel="noopener">démontré en live par Pandaahh avec Harrow</a> : Covenant (son 4) après s'être fait toucher + arcane Vengeance + kavat Adarza + <b>Viseur galvanisé</b> empilent la chance critique par phases, et <b>Nourish (Grendel, Helminth)</b> apporte le Viral qui manquait. Garde le magnétique-électrique de base, avance et fume tout — le 1 de Harrow régénère le bouclier quand ça tape trop fort.`,
    en: `Red crits without late-game gear, demonstrated live by Pandaahh with Harrow: Covenant (his 4) after taking hits + Arcane Avenger + Adarza kavat + <b>Galvanized Scope</b> stack crit chance in phases, and <b>Nourish (Grendel, Helminth)</b> brings the missing Viral. Keep the base magnetic-electric, walk forward and melt everything — Harrow's 1 refills your shields when it gets rough.`,
  },
  "harrow": {
    fr: `La rotation du <a href="https://www.youtube.com/watch?v=3QZ6zbEmJR8" target="_blank" rel="noopener">live Pandaahh</a> (crit rouge à l'Amprex) : <b>4 → se faire toucher</b> (phase d'immortalité assez longue, puis gros bonus critique) <b>→ 2 → 1</b> pour régénérer massivement le bouclier. Sur le 3, <b>Nourish (Grendel, Helminth)</b> pour le Viral a détrôné Xata pendant le test. Complète avec arcane Vengeance + Adarza : les crits rouges arrivent par vagues, la survie est assurée par le 1. Pour le crit rouge <i>permanent</i>, <a href="https://www.youtube.com/watch?v=FZimD1ef_8o" target="_blank" rel="noopener">sa variante Dual Toxocyst Incarnon</a> : l'augment <b>Lasting Covenant</b> rend +3 s de buff crit par kill à la tête (plafond 3× la durée de base) et les ricochets Incarnon touchent la tête en continu — avec l'<b>Evade de Cyte-09</b> (Helminth), les kills sur points faibles prolongent aussi l'invisibilité indéfiniment.`,
    en: `The rotation from Pandaahh's live (red-crit Amprex): <b>4 → get hit</b> (a fairly long immortality window, then a big crit bonus) <b>→ 2 → 1</b> to massively refill shields. Over the 3, <b>Nourish (Grendel, Helminth)</b> for Viral beat Xata during the test. Add Arcane Avenger + an Adarza kavat: red crits come in waves, and the 1 keeps you alive. For <i>permanent</i> red crits, his Dual Toxocyst Incarnon variant: the <b>Lasting Covenant</b> augment refunds +3s of crit buff per headshot kill (cap: 3× base duration) while Incarnon ricochets hit heads nonstop — with <b>Cyte-09's Evade</b> (Helminth), weak-point kills also extend the invisibility indefinitely.`,
  },
  "harrow-prime": {
    fr: `La rotation du <a href="https://www.youtube.com/watch?v=3QZ6zbEmJR8" target="_blank" rel="noopener">live Pandaahh</a> (crit rouge à l'Amprex) : <b>4 → se faire toucher</b> (phase d'immortalité assez longue, puis gros bonus critique) <b>→ 2 → 1</b> pour régénérer massivement le bouclier. Sur le 3, <b>Nourish (Grendel, Helminth)</b> pour le Viral a détrôné Xata pendant le test. Complète avec arcane Vengeance + Adarza : les crits rouges arrivent par vagues, la survie est assurée par le 1. Pour le crit rouge <i>permanent</i>, <a href="https://www.youtube.com/watch?v=FZimD1ef_8o" target="_blank" rel="noopener">sa variante Dual Toxocyst Incarnon</a> : l'augment <b>Lasting Covenant</b> rend +3 s de buff crit par kill à la tête (plafond 3× la durée de base) et les ricochets Incarnon touchent la tête en continu — avec l'<b>Evade de Cyte-09</b> (Helminth), les kills sur points faibles prolongent aussi l'invisibilité indéfiniment.`,
    en: `The rotation from Pandaahh's live (red-crit Amprex): <b>4 → get hit</b> (a fairly long immortality window, then a big crit bonus) <b>→ 2 → 1</b> to massively refill shields. Over the 3, <b>Nourish (Grendel, Helminth)</b> for Viral beat Xata during the test. Add Arcane Avenger + an Adarza kavat: red crits come in waves, and the 1 keeps you alive. For <i>permanent</i> red crits, his Dual Toxocyst Incarnon variant: the <b>Lasting Covenant</b> augment refunds +3s of crit buff per headshot kill (cap: 3× base duration) while Incarnon ricochets hit heads nonstop — with <b>Cyte-09's Evade</b> (Helminth), weak-point kills also extend the invisibility indefinitely.`,
  },
  "zephyr": {
    fr: `Setup validé en <a href="https://www.youtube.com/watch?v=jdQbVq_eNbY" target="_blank" rel="noopener">live par Pandaahh</a> : le pouvoir d'Hydroïde (Helminth) avec son augment pose <b>corrosif + viral</b> sur toute la zone (jusqu'à +325 % de dégâts), et surtout <b>garde le 2</b> : il regroupe les ennemis et son augment cumule <b>jusqu'à +500 % de dégâts d'armes secondaires</b> — joue donc une secondaire (Kuva Nukor, Akarius, Sporelacer…). Le 3 est ton défensif permanent (repère : si tu prends un dégât, c'est qu'il est retombé), tirer dans une tornade propage tes dégâts à la zone, et la sentinelle <b>Nautilus</b> qui regroupe complète le tout.`,
    en: `Setup validated live by Pandaahh: Hydroid's Helminth ability with its augment applies <b>corrosive + viral</b> to the whole zone (up to +325% damage), and above all <b>keep the 2</b>: it groups enemies and its augment stacks <b>up to +500% secondary-weapon damage</b> — so run a secondary (Kuva Nukor, Akarius, Sporelacer…). The 3 is your permanent defensive layer (if you take damage, it dropped), shooting into a tornado spreads your damage zone-wide, and the grouping <b>Nautilus</b> sentinel completes the kit.`,
  },
  "zephyr-prime": {
    fr: `Setup validé en <a href="https://www.youtube.com/watch?v=jdQbVq_eNbY" target="_blank" rel="noopener">live par Pandaahh</a> : le pouvoir d'Hydroïde (Helminth) avec son augment pose <b>corrosif + viral</b> sur toute la zone (jusqu'à +325 % de dégâts), et surtout <b>garde le 2</b> : il regroupe les ennemis et son augment cumule <b>jusqu'à +500 % de dégâts d'armes secondaires</b> — joue donc une secondaire (Kuva Nukor, Akarius, Sporelacer…). Le 3 est ton défensif permanent (repère : si tu prends un dégât, c'est qu'il est retombé), tirer dans une tornade propage tes dégâts à la zone, et la sentinelle <b>Nautilus</b> qui regroupe complète le tout.`,
    en: `Setup validated live by Pandaahh: Hydroid's Helminth ability with its augment applies <b>corrosive + viral</b> to the whole zone (up to +325% damage), and above all <b>keep the 2</b>: it groups enemies and its augment stacks <b>up to +500% secondary-weapon damage</b> — so run a secondary (Kuva Nukor, Akarius, Sporelacer…). The 3 is your permanent defensive layer (if you take damage, it dropped), shooting into a tornado spreads your damage zone-wide, and the grouping <b>Nautilus</b> sentinel completes the kit.`,
  },
  "nautilus": {
    fr: `Le chouchou des lives Pandaahh : son précepte qui <b>regroupe les ennemis</b> nourrit tous les builds à grosse frappe localisée — Zephyr + Kuva Nukor, Braton Incarnon, armes explosives… Les cibles viennent à toi, il ne reste qu'à tirer. Astuce confirmée par DE : la priorité des préceptes suit l'ordre des slots — mets <b>Cordon en premier</b> pour le voir proc le plus souvent.`,
    en: `A Pandaahh-stream favorite: its enemy-<b>grouping</b> precept feeds every big-localized-hit build — Zephyr + Kuva Nukor, Incarnon Braton, launchers… Targets come to you; all that's left is pulling the trigger. DE-confirmed tip: precept priority follows slot order — put <b>Cordon first</b> so it procs most often.`,
  },
  "titania": {
    fr: `Défendue bec et ongles en <a href="https://www.youtube.com/watch?v=bhhN21Elo0U" target="_blank" rel="noopener">live par Pandaahh</a> — « une des meilleures frames du jeu », le premier level cap de beaucoup de joueurs. Les clés : l'augment <b>Razorwing Blitz</b> obligatoire, des <b>dégâts critiques sur les Dex Pixia</b> (leur stat reine), le shield-gating au <b>1</b> (Bouclier catalysant + Répit bref : le 1 rend le bouclier instantanément et immunise aux statuts) — et <b>jamais Pensée Rapide</b> (elle vide l'énergie qui te maintient en Razorwing). Build conseillé : <b>explo + poison avec Murmure de Xata</b> (Helminth) — à 10 cumuls d'explosif, la réaction en chaîne propage les dégâts et compense le mono-cible. Compagnon animal (Lien tenace = + crit) plutôt que sentinelle : Titania a déjà l'aspirateur à loot des Archwings.`,
    en: `Defended tooth and nail live by Pandaahh — "one of the best frames in the game," many players' first level cap. The keys: the <b>Razorwing Blitz</b> augment is mandatory, <b>crit damage on the Dex Pixia</b> (their king stat), shield-gating with the <b>1</b> (Catalyzing Shields + Brief Respite: the 1 instantly refills shields and grants status immunity) — and <b>never Quick Thinking</b> (it drains the energy keeping you in Razorwing). Recommended build: <b>blast + toxin with Xata's Whisper</b> (Helminth) — at 10 blast stacks the chain reaction spreads damage and offsets the single-target feel. Animal companion (Tenacious Bond = more crit) over a sentinel: Titania already has the Archwing loot vacuum.`,
  },
  "titania-prime": {
    fr: `Défendue bec et ongles en <a href="https://www.youtube.com/watch?v=bhhN21Elo0U" target="_blank" rel="noopener">live par Pandaahh</a> — « une des meilleures frames du jeu », le premier level cap de beaucoup de joueurs. Les clés : l'augment <b>Razorwing Blitz</b> obligatoire, des <b>dégâts critiques sur les Dex Pixia</b> (leur stat reine), le shield-gating au <b>1</b> (Bouclier catalysant + Répit bref : le 1 rend le bouclier instantanément et immunise aux statuts) — et <b>jamais Pensée Rapide</b> (elle vide l'énergie qui te maintient en Razorwing). Build conseillé : <b>explo + poison avec Murmure de Xata</b> (Helminth) — à 10 cumuls d'explosif, la réaction en chaîne propage les dégâts et compense le mono-cible. Compagnon animal (Lien tenace = + crit) plutôt que sentinelle : Titania a déjà l'aspirateur à loot des Archwings.`,
    en: `Defended tooth and nail live by Pandaahh — "one of the best frames in the game," many players' first level cap. The keys: the <b>Razorwing Blitz</b> augment is mandatory, <b>crit damage on the Dex Pixia</b> (their king stat), shield-gating with the <b>1</b> (Catalyzing Shields + Brief Respite: the 1 instantly refills shields and grants status immunity) — and <b>never Quick Thinking</b> (it drains the energy keeping you in Razorwing). Recommended build: <b>blast + toxin with Xata's Whisper</b> (Helminth) — at 10 blast stacks the chain reaction spreads damage and offsets the single-target feel. Animal companion (Tenacious Bond = more crit) over a sentinel: Titania already has the Archwing loot vacuum.`,
  },
  "hildryn": {
    fr: `« Le plus gros serial killer du jeu en 2026 » selon Pandaahh, qui a bouclé un <a href="https://www.youtube.com/watch?v=QxR2fnI13g8" target="_blank" rel="noopener">level cap 9999 en Cascade du Vide avec elle</a> : reste en <b>4</b> en permanence, <b>spamme le 2 (Pillage)</b> — il retire les défenses ennemies ET refait ton bouclier —, et avec l'<b>augment du 4</b>, ne tire que le <b>tir secondaire des Chargeurs incandescents</b> (grosse salve, explosion boostée par la portée). Ils comptent comme arme secondaire : <b>Amalgam Furax Body Count</b> (Ropalolyst) donne la cadence. Full dégâts bruts (5 % de crit de base : on l'ignore), <b>Murmure de Xata</b> (Helminth) en buffer, arcane Expertise pour convertir la puissance en bouclier (sinon fragments d'Archonte bleus), déplacement en Opérateur (frame lente) — et au buff de fissure, désactive/réactive le 4 pour +300 % de puissance. Bilan du live : 96 arcanes et 151 essences d'acier en 1h35.`,
    en: `"The game's biggest serial killer in 2026" per Pandaahh, who cleared a level-9999 Void Cascade cap with her: stay in your <b>4</b> permanently, <b>spam the 2 (Pillage)</b> — it strips enemy defenses AND refills your shields —, and with the <b>4's augment</b>, only use the <b>Balefire Chargers' secondary fire</b> (huge salvo, explosion scales with range). They count as a secondary: <b>Amalgam Furax Body Count</b> (Ropalolyst) provides the fire rate. Full raw damage (5% base crit: ignore it), <b>Xata's Whisper</b> (Helminth) as the buffer, Arcane Expertise to convert strength into shields (otherwise blue Archon shards), move in Operator form (she's slow) — and on a fissure buff, toggle the 4 off/on for +300% strength. Live results: 96 arcanes and 151 Steel Essence in 1h35.`,
  },
  "hildryn-prime": {
    fr: `« Le plus gros serial killer du jeu en 2026 » selon Pandaahh, qui a bouclé un <a href="https://www.youtube.com/watch?v=QxR2fnI13g8" target="_blank" rel="noopener">level cap 9999 en Cascade du Vide avec elle</a> : reste en <b>4</b> en permanence, <b>spamme le 2 (Pillage)</b> — il retire les défenses ennemies ET refait ton bouclier —, et avec l'<b>augment du 4</b>, ne tire que le <b>tir secondaire des Chargeurs incandescents</b> (grosse salve, explosion boostée par la portée). Ils comptent comme arme secondaire : <b>Amalgam Furax Body Count</b> (Ropalolyst) donne la cadence. Full dégâts bruts (5 % de crit de base : on l'ignore), <b>Murmure de Xata</b> (Helminth) en buffer, arcane Expertise pour convertir la puissance en bouclier (sinon fragments d'Archonte bleus), déplacement en Opérateur (frame lente) — et au buff de fissure, désactive/réactive le 4 pour +300 % de puissance. Bilan du live : 96 arcanes et 151 essences d'acier en 1h35.`,
    en: `"The game's biggest serial killer in 2026" per Pandaahh, who cleared a level-9999 Void Cascade cap with her: stay in your <b>4</b> permanently, <b>spam the 2 (Pillage)</b> — it strips enemy defenses AND refills your shields —, and with the <b>4's augment</b>, only use the <b>Balefire Chargers' secondary fire</b> (huge salvo, explosion scales with range). They count as a secondary: <b>Amalgam Furax Body Count</b> (Ropalolyst) provides the fire rate. Full raw damage (5% base crit: ignore it), <b>Xata's Whisper</b> (Helminth) as the buffer, Arcane Expertise to convert strength into shields (otherwise blue Archon shards), move in Operator form (she's slow) — and on a fissure buff, toggle the 4 off/on for +300% strength. Live results: 96 arcanes and 151 Steel Essence in 1h35.`,
  },
  "acceltra": {
    fr: `Conseil du live Pandaahh : les <b>mods Vigilante</b> valent surtout pour leur passif de <b>rehausse du palier critique</b> (un crit orange devient rouge…) — précieux sur une arme à haut crit comme l'Acceltra — et <b>Carrier</b> étend ta réserve de munitions, ce qui fait gagner un slot de mod munitions. Reprise en <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">SOS Bambi</a> : comparée à n'importe quelle arme de sa catégorie, c'est une des plus grosses chances de crit — l'arcane Vengeance synergise à merveille — et <b>Munitions du chasseur</b> (Tranchant sur crit) achève ce que l'attaque radiale n'a pas tué net. Malin : garde tes formas pour l'Acceltra Prime, « s'il y a bien une arme qui mérite quelques formas, c'est elle ».`,
    en: `Tip from Pandaahh's live: <b>Vigilante mods</b> are worth it mainly for their <b>crit-tier upgrade</b> passive (an orange crit becomes red…) — precious on a high-crit weapon like the Acceltra — and <b>Carrier</b> extends your ammo reserve, freeing up an ammo-mod slot. Revisited in SOS Bambi: compared to anything in its class it has one of the highest crit chances — Arcane Avenger synergizes beautifully — and <b>Hunter Munitions</b> (Slash on crit) finishes whatever the radial attack didn't kill outright. Smart move: save your Formas for the Acceltra Prime, "if one weapon deserves a few Formas, it's this one".`,
  },
  "acceltra-prime": {
    fr: `Conseil du live Pandaahh : les <b>mods Vigilante</b> valent surtout pour leur passif de <b>rehausse du palier critique</b> (un crit orange devient rouge…) — précieux sur une arme à haut crit comme l'Acceltra — et <b>Carrier</b> étend ta réserve de munitions, ce qui fait gagner un slot de mod munitions. Reprise en <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">SOS Bambi</a> : comparée à n'importe quelle arme de sa catégorie, c'est une des plus grosses chances de crit — l'arcane Vengeance synergise à merveille — et <b>Munitions du chasseur</b> (Tranchant sur crit) achève ce que l'attaque radiale n'a pas tué net. Malin : garde tes formas pour l'Acceltra Prime, « s'il y a bien une arme qui mérite quelques formas, c'est elle ».`,
    en: `Tip from Pandaahh's live: <b>Vigilante mods</b> are worth it mainly for their <b>crit-tier upgrade</b> passive (an orange crit becomes red…) — precious on a high-crit weapon like the Acceltra — and <b>Carrier</b> extends your ammo reserve, freeing up an ammo-mod slot. Revisited in SOS Bambi: compared to anything in its class it has one of the highest crit chances — Arcane Avenger synergizes beautifully — and <b>Hunter Munitions</b> (Slash on crit) finishes whatever the radial attack didn't kill outright. Smart move: save your Formas for the Acceltra Prime, "if one weapon deserves a few Formas, it's this one".`,
  },
  "cyte-09": {
    fr: `L'ami des armes Incarnon à tirs à la tête, <a href="https://www.youtube.com/watch?v=FZimD1ef_8o" target="_blank" rel="noopener">démontré par Pandaahh aux Dual Toxocyst</a> : son <b>1 (Seek)</b> surligne les points faibles à travers les murs (+75 % de dégâts dessus) et donne aux armes une pénétration infinie du décor — on charge l'Incarnon et on tue « même à travers les murs », sans jamais s'exposer. Son <b>2 (Evade)</b> rend invisible et chaque kill sur point faible prolonge l'effet : enchaîne les têtes et l'invisibilité ne tombe jamais. Pandaahh y ajoute <b>Nourish</b> (Grendel, Helminth) pour le Viral et l'énergie.`,
    en: `The best friend of headshot-hungry Incarnon weapons, demonstrated by Pandaahh with the Dual Toxocyst: his <b>1 (Seek)</b> highlights weak points through walls (+75% damage on them) and grants weapons infinite terrain punch through — you charge the Incarnon and kill "even through walls" without ever exposing yourself. His <b>2 (Evade)</b> turns him invisible and every weak-point kill extends it: chain headshots and the invisibility never drops. Pandaahh adds <b>Nourish</b> (Grendel, Helminth) for Viral and energy.`,
  },
  "praedos": {
    fr: `Le choix mobilité de Pandaahh pour ses kits d'endurance (<a href="https://www.youtube.com/watch?v=FZimD1ef_8o" target="_blank" rel="noopener">vu au live Dual Toxocyst</a>) : les évolutions Incarnon donnent <b>+20 % de sprint, +20 % de glissade et +30 % de vélocité parkour</b> — des bonus passifs, actifs même arme rengainée. Il les sort à la place des Furax dès qu'il faut bouger vite.`,
    en: `Pandaahh's mobility pick for endurance kits (seen in the Dual Toxocyst live): the Incarnon evolutions grant <b>+20% sprint speed, +20% slide and +30% parkour velocity</b> — passive bonuses, active even while holstered. He swaps the Furax for them whenever speed matters.`,
  },
  "cedo": {
    fr: `Le stuff « <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">SOS Bambi</a> » de Pandaahh pour traverser carte solaire et Steel Path : le Cedo a un <b>Condition Overload inné</b> (+60 % de dégâts par statut unique sur la cible) — d'où le réflexe <b>tir secondaire d'abord</b> (le glaive rebondit, explose et pose des statuts garantis, dont du Froid), <b>puis tir principal</b>. Joue Viral + électrique plutôt que full Corrosif. Arcane reine : <b>Engelure Principale</b> (+3 % dégâts crit et +2,25 % multishot par proc Froid, 40 cumuls — survie Circulus sur Lua rotation C, ou chez Yonta contre du Plasma Thrax) ; en attendant, Impitoyable (liches Kuva). Couplé à un Gauss buffer, « il ne restera jamais personne sur la carte ».`,
    en: `Pandaahh's "SOS Bambi" kit to cross the star chart and the Steel Path: the Cedo has an <b>innate Condition Overload</b> (+60% damage per unique status on the target) — hence the reflex: <b>alt fire first</b> (the glaive bounces, explodes and applies guaranteed procs, including Cold), <b>then primary fire</b>. Run Viral + electric rather than full Corrosive. Queen arcane: <b>Primary Frostbite</b> (+3% crit damage and +2.25% multishot per Cold proc, 40 stacks — Circulus survival on Lua rotation C, or from Yonta for Lua Thrax Plasm); until then, Merciless (Kuva Liches). Paired with a buffer Gauss, "no one will ever be left on the map".`,
  },
  "cedo-prime": {
    fr: `Le stuff « <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">SOS Bambi</a> » de Pandaahh pour traverser carte solaire et Steel Path : le Cedo a un <b>Condition Overload inné</b> (+60 % de dégâts par statut unique sur la cible) — d'où le réflexe <b>tir secondaire d'abord</b> (le glaive rebondit, explose et pose des statuts garantis, dont du Froid), <b>puis tir principal</b>. Joue Viral + électrique plutôt que full Corrosif. Arcane reine : <b>Engelure Principale</b> (+3 % dégâts crit et +2,25 % multishot par proc Froid, 40 cumuls — survie Circulus sur Lua rotation C, ou chez Yonta contre du Plasma Thrax) ; en attendant, Impitoyable (liches Kuva). Couplé à un Gauss buffer, « il ne restera jamais personne sur la carte ».`,
    en: `Pandaahh's "SOS Bambi" kit to cross the star chart and the Steel Path: the Cedo has an <b>innate Condition Overload</b> (+60% damage per unique status on the target) — hence the reflex: <b>alt fire first</b> (the glaive bounces, explodes and applies guaranteed procs, including Cold), <b>then primary fire</b>. Run Viral + electric rather than full Corrosive. Queen arcane: <b>Primary Frostbite</b> (+3% crit damage and +2.25% multishot per Cold proc, 40 stacks — Circulus survival on Lua rotation C, or from Yonta for Lua Thrax Plasm); until then, Merciless (Kuva Liches). Paired with a buffer Gauss, "no one will ever be left on the map".`,
  },
  "ballistica": {
    fr: `Des cinq Incarnons de la mise à jour 43, c'est la Ballistica que la communauté plébiscite — verdict quasi unanime du chat lors du <a href="https://www.youtube.com/watch?v=5UOUgl0iDAg" target="_blank" rel="noopener">live Circuit de Pandaahh</a> (Destreza appréciée, Stug et Vectis déconseillés en priorité ; parti sur Stug + Vectis avant ces retours, il l'a regretté en direct). L'adaptateur gagné au Circuit Steel Path s'installe chez <b>Cavalero</b>, au Zariman — il ne revient que <b>toutes les 9 semaines</b> (semaine 9 de la rotation), ou s'achète directement pour <b>120 platine</b> (une seule fois) si tu ne veux pas attendre. <a href="https://www.youtube.com/watch?v=AxD2yAU1ggI" target="_blank" rel="noopener">Build détaillé par Patchoumio</a> : 12 coups sur un point faible chargent la transmutation, le tir alternatif fait passer l'arme en <b>Tranchant pur</b> (contre Perforation dominant de base) avec crit/statut/vitesse de projectile en forte hausse. Ses choix d'évolution : <b>Perforation Prolifique</b> (+10 % de critique par perforation, 8 cumuls) puis <b>Renfort Rapide</b> (+50 % de vitesse de rechargement, qui accélère aussi le passage en Incarnon) puis <b>Équilibre Élémentaire</b> pour maximiser le statut. Très fort avec <a href="/builds/ash">Ash</a> (son passif prolonge et renforce les statuts Tranchant), et se marie bien avec Dagath, Hydroid, Mag, Nidus, Rhino ou Saryn.`,
    en: `Of Update 43's five Incarnons, the Ballistica is the community favorite — near-unanimous chat verdict during Pandaahh's Circuit live (Destreza liked, Stug and Vectis not recommended as first picks; having chosen Stug + Vectis before that feedback, he regretted it on stream). The adapter earned in the Steel Path Circuit is installed at <b>Cavalero</b>'s, on the Zariman — it only comes back <b>every 9 weeks</b> (week 9 of the rotation), or can be bought directly for <b>120 platinum</b> (one-time only) if you don't want to wait. <a href="https://www.youtube.com/watch?v=AxD2yAU1ggI" target="_blank" rel="noopener">Detailed build by Patchoumio</a>: 12 weakpoint hits charge the transmutation gauge, alt-fire switches the weapon to <b>pure Slash</b> (vs. its normally Puncture-dominant profile) with big boosts to crit, status and projectile speed. His evolution picks: <b>Prolific Perforation</b> (+10% crit chance per punch-through hit, stacks 8x) then <b>Rapid Reinforcement</b> (+50% reload speed, which also speeds up the Incarnon transformation) then <b>Elemental Balance</b> to maximize status. Excellent with <a href="/en/builds/ash">Ash</a> (his passive extends and strengthens Slash status), and pairs well with Dagath, Hydroid, Mag, Nidus, Rhino or Saryn.`,
  },
  "ballistica-prime": {
    fr: `Des cinq Incarnons de la mise à jour 43, c'est la Ballistica que la communauté plébiscite — verdict quasi unanime du chat lors du <a href="https://www.youtube.com/watch?v=5UOUgl0iDAg" target="_blank" rel="noopener">live Circuit de Pandaahh</a> (Destreza appréciée, Stug et Vectis déconseillés en priorité ; parti sur Stug + Vectis avant ces retours, il l'a regretté en direct). L'adaptateur gagné au Circuit Steel Path s'installe chez <b>Cavalero</b>, au Zariman — il ne revient que <b>toutes les 9 semaines</b> (semaine 9 de la rotation), ou s'achète directement pour <b>120 platine</b> (une seule fois) si tu ne veux pas attendre. <a href="https://www.youtube.com/watch?v=AxD2yAU1ggI" target="_blank" rel="noopener">Build détaillé par Patchoumio</a>, testé sur la version Prime (la meilleure des trois) : 12 coups sur un point faible chargent la transmutation, le tir alternatif fait passer l'arme en <b>Tranchant pur</b> (contre Perforation dominant de base) avec crit/statut/vitesse de projectile en forte hausse — sans forma ni Helminth, il tape déjà plusieurs millions de dégâts en Steel Path. Ses choix d'évolution : <b>Perforation Prolifique</b> (+10 % de critique par perforation, 8 cumuls) puis <b>Renfort Rapide</b> (+50 % de vitesse de rechargement, qui accélère aussi le passage en Incarnon) puis <b>Équilibre Élémentaire</b> (+18 % de statut par projectile, +72 % en forme Incarnon). Très fort avec <a href="/builds/ash">Ash</a> (son passif prolonge et renforce les statuts Tranchant), et se marie bien avec Dagath, Hydroid, Mag, Nidus, Rhino ou Saryn.`,
    en: `Of Update 43's five Incarnons, the Ballistica is the community favorite — near-unanimous chat verdict during Pandaahh's Circuit live (Destreza liked, Stug and Vectis not recommended as first picks; having chosen Stug + Vectis before that feedback, he regretted it on stream). The adapter earned in the Steel Path Circuit is installed at <b>Cavalero</b>'s, on the Zariman — it only comes back <b>every 9 weeks</b> (week 9 of the rotation), or can be bought directly for <b>120 platinum</b> (one-time only) if you don't want to wait. <a href="https://www.youtube.com/watch?v=AxD2yAU1ggI" target="_blank" rel="noopener">Detailed build by Patchoumio</a>, tested on the Prime version (the best of the three): 12 weakpoint hits charge the transmutation gauge, alt-fire switches the weapon to <b>pure Slash</b> (vs. its normally Puncture-dominant profile) with big boosts to crit, status and projectile speed — with no forma or Helminth, it's already hitting for several million damage in the Steel Path. His evolution picks: <b>Prolific Perforation</b> (+10% crit chance per punch-through hit, stacks 8x) then <b>Rapid Reinforcement</b> (+50% reload speed, which also speeds up the Incarnon transformation) then <b>Elemental Balance</b> (+18% status per projectile, +72% for Incarnon form). Excellent with <a href="/en/builds/ash">Ash</a> (his passive extends and strengthens Slash status), and pairs well with Dagath, Hydroid, Mag, Nidus, Rhino or Saryn.`,
  },
  "rakta-ballistica": {
    fr: `Même mécanique Incarnon que la <a href="/builds/ballistica-prime">Ballistica Prime</a> (12 coups sur point faible chargent la transmutation, tir alternatif = <b>Tranchant pur</b> avec crit/statut en forte hausse), mais avec des valeurs d'évolution légèrement inférieures à la Prime — la Prime reste la meilleure des trois hôtes. <a href="https://www.youtube.com/watch?v=AxD2yAU1ggI" target="_blank" rel="noopener">Détails du build (Patchoumio)</a>. L'adaptateur se gagne au Circuit Steel Path (semaine 9 sur 9) ou s'achète une fois pour 120 platine chez Cavalero.`,
    en: `Same Incarnon mechanic as the <a href="/en/builds/ballistica-prime">Ballistica Prime</a> (12 weakpoint hits charge the transmutation gauge, alt-fire = <b>pure Slash</b> with big crit/status boosts), but with slightly lower evolution values than the Prime — the Prime remains the best of the three hosts. Build details (Patchoumio). The adapter is earned via the Steel Path Circuit (week 9 of 9) or bought once for 120 platinum from Cavalero.`,
  },
  "equinox": {
    fr: `Tu cherches un build Duality et tu ne trouves rien ? Normal, selon <a href="https://www.youtube.com/watch?v=5UOUgl0iDAg" target="_blank" rel="noopener">Pandaahh</a> : l'augment a mal vieilli — le clone n'est pas réactif, « qu'il soit là ou pas, ça ne change rien ». Il a essayé de le rendre viable « de plein de façons », sans succès, même après le patch censé améliorer la réactivité des PNJ invoqués. À garder pour le fun, pas pour un build sérieux. Bonne nouvelle maj 43 pour les builds <b>slam</b>, en revanche : l'arcane <b>Melee Assimilation</b> comble enfin le défensif manquant — +150 % de dégâts d'attaque lourde sur bouclier endommagé et 30 % du bouclier max rendu par kill en attaque lourde (quatre kills d'un slam = bouclier plein).`,
    en: `Looking for a Duality build and finding nothing? That's normal, per Pandaahh: the augment aged badly — the clone isn't reactive, "whether it's there or not, nothing changes for you". He tried to make it viable "in plenty of ways" without success, even after the patch meant to improve summoned-NPC reactivity. Keep it for fun, not for a serious build. Good Update 43 news for <b>slam</b> builds though: the <b>Melee Assimilation</b> arcane finally fills the missing defensive layer — +150% heavy attack damage on shield damage and 30% max shields restored per heavy attack kill (four kills in one slam = full shields).`,
  },
  "equinox-prime": {
    fr: `Tu cherches un build Duality et tu ne trouves rien ? Normal, selon <a href="https://www.youtube.com/watch?v=5UOUgl0iDAg" target="_blank" rel="noopener">Pandaahh</a> : l'augment a mal vieilli — le clone n'est pas réactif, « qu'il soit là ou pas, ça ne change rien ». Il a essayé de le rendre viable « de plein de façons », sans succès, même après le patch censé améliorer la réactivité des PNJ invoqués. À garder pour le fun, pas pour un build sérieux. Bonne nouvelle maj 43 pour les builds <b>slam</b>, en revanche : l'arcane <b>Melee Assimilation</b> comble enfin le défensif manquant — +150 % de dégâts d'attaque lourde sur bouclier endommagé et 30 % du bouclier max rendu par kill en attaque lourde (quatre kills d'un slam = bouclier plein).`,
    en: `Looking for a Duality build and finding nothing? That's normal, per Pandaahh: the augment aged badly — the clone isn't reactive, "whether it's there or not, nothing changes for you". He tried to make it viable "in plenty of ways" without success, even after the patch meant to improve summoned-NPC reactivity. Keep it for fun, not for a serious build. Good Update 43 news for <b>slam</b> builds though: the <b>Melee Assimilation</b> arcane finally fills the missing defensive layer — +150% heavy attack damage on shield damage and 30% max shields restored per heavy attack kill (four kills in one slam = full shields).`,
  },
  "xaku": {
    fr: `L'avis de <a href="https://www.youtube.com/watch?v=5UOUgl0iDAg" target="_blank" rel="noopener">Pandaahh en live</a> : le meilleur choix sur Xaku, c'est un <b>strip de défenses de masse</b> via Helminth à la place du 1 — <b>Barrage de Tempête</b> (Hydroïde) avec son augment, ou <b>Terrifiant</b> (Nekros) — son strip de base (Gaze) étant trop contraignant à l'usage. Une fois les défenses tombées, les kills sont quasi instantanés. <b>Deuxième école</b>, celle du créateur allemand <a href="https://www.youtube.com/watch?v=2iMKHBySTNU" target="_blank" rel="noopener">Vernoc</a> : garder Gaze (3) tel quel — il crée une zone de <b>0 % de défense (boucliers ET armure) sur ~32 m</b> autour de l'ennemi lié, et l'ultime (4) <b>met en pause tous les timers</b> de Xaku pendant son activation, donc la zone peut durer indéfiniment en recastant l'ultime avant qu'elle expire. Il remplace plutôt le <b>1</b> (Murmure de Xata, plus fort sur d'AUTRES frames que sur lui) par <b>Rugissement de Rhino</b>, puisque le vol d'armes du 2 n'est de toute façon pas buffé par le 1 natif. Deux builds possibles : un build kill (2 pour voler ~15 armes ennemies à l'échelle du niveau, 3 pour geler les défenses, compagnon d'invisibilité type Huras — les tirs volés ne cassent pas l'invisibilité) ou un build farm (spam de l'ultime en <b>Portée max</b> pour détruire les conteneurs de butin à travers les murs sur toute la carte, l'un des meilleurs farms de ressources à ramasser du jeu).`,
    en: `Pandaahh's live take: the best pick on Xaku is a <b>mass defense strip</b> via Helminth over the 1 — <b>Tempest Barrage</b> (Hydroid) with its augment, or <b>Terrify</b> (Nekros) — his native strip (Gaze) being too fiddly in practice. Once defenses drop, kills are near-instant. <b>A second school</b>, from German creator Vernoc: keep Gaze (3) as-is — it creates a <b>0% defense zone (shields AND armor) over ~32 m</b> around the bound enemy, and the ultimate (4) <b>pauses all of Xaku's own timers</b> while active, so the zone can last indefinitely by recasting the ultimate before it expires. He instead replaces the <b>1</b> (Xata's Whisper, stronger on OTHER frames than on Xaku himself) with <b>Rhino's Roar</b>, since the 2's stolen weapons aren't buffed by his native 1 anyway. Two build variants: a kill build (2 to steal ~15 enemy-scaled weapons, 3 to freeze defenses, an invisibility companion like Huras — the stolen weapons' shots don't break invisibility) or a farm build (spam the ultimate at <b>max Range</b> to destroy loot containers through walls across the map — one of the best pickup-resource farms in the game).`,
  },
  "xaku-prime": {
    fr: `L'avis de <a href="https://www.youtube.com/watch?v=5UOUgl0iDAg" target="_blank" rel="noopener">Pandaahh en live</a> : le meilleur choix sur Xaku, c'est un <b>strip de défenses de masse</b> via Helminth à la place du 1 — <b>Barrage de Tempête</b> (Hydroïde) avec son augment, ou <b>Terrifiant</b> (Nekros) — son strip de base (Gaze) étant trop contraignant à l'usage. Une fois les défenses tombées, les kills sont quasi instantanés. <b>Deuxième école</b>, celle du créateur allemand <a href="https://www.youtube.com/watch?v=2iMKHBySTNU" target="_blank" rel="noopener">Vernoc</a> : garder Gaze (3) tel quel — il crée une zone de <b>0 % de défense (boucliers ET armure) sur ~32 m</b> autour de l'ennemi lié, et l'ultime (4) <b>met en pause tous les timers</b> de Xaku pendant son activation, donc la zone peut durer indéfiniment en recastant l'ultime avant qu'elle expire. Il remplace plutôt le <b>1</b> (Murmure de Xata, plus fort sur d'AUTRES frames que sur lui) par <b>Rugissement de Rhino</b>, puisque le vol d'armes du 2 n'est de toute façon pas buffé par le 1 natif. Deux builds possibles : un build kill (2 pour voler ~15 armes ennemies à l'échelle du niveau, 3 pour geler les défenses, compagnon d'invisibilité type Huras — les tirs volés ne cassent pas l'invisibilité) ou un build farm (spam de l'ultime en <b>Portée max</b> pour détruire les conteneurs de butin à travers les murs sur toute la carte, l'un des meilleurs farms de ressources à ramasser du jeu).`,
    en: `Pandaahh's live take: the best pick on Xaku is a <b>mass defense strip</b> via Helminth over the 1 — <b>Tempest Barrage</b> (Hydroid) with its augment, or <b>Terrify</b> (Nekros) — his native strip (Gaze) being too fiddly in practice. Once defenses drop, kills are near-instant. <b>A second school</b>, from German creator Vernoc: keep Gaze (3) as-is — it creates a <b>0% defense zone (shields AND armor) over ~32 m</b> around the bound enemy, and the ultimate (4) <b>pauses all of Xaku's own timers</b> while active, so the zone can last indefinitely by recasting the ultimate before it expires. He instead replaces the <b>1</b> (Xata's Whisper, stronger on OTHER frames than on Xaku himself) with <b>Rhino's Roar</b>, since the 2's stolen weapons aren't buffed by his native 1 anyway. Two build variants: a kill build (2 to steal ~15 enemy-scaled weapons, 3 to freeze defenses, an invisibility companion like Huras — the stolen weapons' shots don't break invisibility) or a farm build (spam the ultimate at <b>max Range</b> to destroy loot containers through walls across the map — one of the best pickup-resource farms in the game).`,
  },
  "wisp-prime": {
    fr: `La reco de <a href="https://www.youtube.com/watch?v=5UOUgl0iDAg" target="_blank" rel="noopener">Pandaahh</a> pour qui déteste viser : le <b>3 (Breach Surge)</b> aveugle la zone, et chaque kill sur un ennemi aveuglé relâche un projectile à tête chercheuse — on tire dans le tas et les réactions en chaîne nettoient la carte. Ajoute l'augment <b>Fused Reservoir</b> en slot Exilus (les trois réservoirs d'un coup) : gameplay simple, et un vrai rôle de support en prime.`,
    en: `Pandaahh's rec for anyone who hates aiming: the <b>3 (Breach Surge)</b> blinds the area, and every kill on a blinded enemy releases a homing projectile — shoot into the crowd and the chain reactions clear the map. Add the <b>Fused Reservoir</b> augment in the Exilus slot (all three reservoirs at once): simple gameplay, with a genuine support role on top.`,
  },
  "epitaph": {
    fr: `LE primer selon <a href="https://www.youtube.com/watch?v=lhBOA_XlgzY" target="_blank" rel="noopener">Pandaahh (vidéo builds mêlée)</a> : en <b>Viral + Magnétique</b>, son tir chargé ne tue pas, il prépare — le Viral monte les dégâts subis jusqu'à +325 %, le Magnétique fait fondre boucliers et Surgarde (« la garde renforcée, je la pète instantanément »). Un pack de 50 000 mobs ? Deux coups de primer, la mêlée fait le reste. Pense anti-renversement (Primed Sure Footed, ou Sure Footed + Fortitude) : ses explosions renversent aussi le tireur. Et garde <b>Secondary Fortifier</b> en arcane : bonus supplémentaire contre la Surgarde.`,
    en: `THE primer per Pandaahh (melee builds video): built <b>Viral + Magnetic</b>, its charged shot doesn't kill, it primes — Viral raises damage taken by up to +325%, Magnetic melts shields and Overguard ("I break Overguard instantly now"). A pack of 50,000 mobs? Two primer shots, the melee does the rest. Plan knockdown immunity (Primed Sure Footed, or Sure Footed + Fortitude): its blasts stagger the shooter too. And keep <b>Secondary Fortifier</b> as the arcane: extra damage against Overguard.`,
  },
  "epitaph-prime": {
    fr: `LE primer selon <a href="https://www.youtube.com/watch?v=lhBOA_XlgzY" target="_blank" rel="noopener">Pandaahh (vidéo builds mêlée)</a> : en <b>Viral + Magnétique</b>, son tir chargé ne tue pas, il prépare — le Viral monte les dégâts subis jusqu'à +325 %, le Magnétique fait fondre boucliers et Surgarde (« la garde renforcée, je la pète instantanément »). Un pack de 50 000 mobs ? Deux coups de primer, la mêlée fait le reste. Pense anti-renversement (Primed Sure Footed, ou Sure Footed + Fortitude) : ses explosions renversent aussi le tireur. Et garde <b>Secondary Fortifier</b> en arcane : bonus supplémentaire contre la Surgarde.`,
    en: `THE primer per Pandaahh (melee builds video): built <b>Viral + Magnetic</b>, its charged shot doesn't kill, it primes — Viral raises damage taken by up to +325%, Magnetic melts shields and Overguard ("I break Overguard instantly now"). A pack of 50,000 mobs? Two primer shots, the melee does the rest. Plan knockdown immunity (Primed Sure Footed, or Sure Footed + Fortitude): its blasts stagger the shooter too. And keep <b>Secondary Fortifier</b> as the arcane: extra damage against Overguard.`,
  },
  "kullervo": {
    fr: `Son 1, <b>Wrathful Advance</b>, est devenu LE Helminth des builds mêlée « light attack » — <a href="https://www.youtube.com/watch?v=lhBOA_XlgzY" target="_blank" rel="noopener">celui que Pandaahh greffe</a> à la place d'un pouvoir superflu : <b>+100 % de chance critique mêlée finale pendant 10 s</b> en version greffée (+200 % sur Kullervo lui-même), relancé entre deux packs. Alternative : Murmure de Xata. Avec Coup de Sang, tout passe en crit orange/rouge.`,
    en: `His 1, <b>Wrathful Advance</b>, has become THE Helminth of light-attack melee builds — the one Pandaahh grafts over a redundant ability: <b>+100% final melee crit chance for 10 s</b> when subsumed (+200% on Kullervo himself), recast between packs. Alternative: Xata's Whisper. With Blood Rush, everything turns orange/red crit.`,
  },
  "gyre": {
    fr: `Le duo naturel de l'arcane <b>Melee Influence</b> selon <a href="https://www.youtube.com/watch?v=lhBOA_XlgzY" target="_blank" rel="noopener">Pandaahh</a> : Gyre électrise tout autour d'elle, donc l'arcane (proc Électrique en mêlée → 20 % de chance de propager les statuts à 20 m) tourne en continu pendant que ta mêlée reste en <b>Toxine</b>. L'inverse — une mêlée full Électrique pour déclencher Influence soi-même — se fait punir par l'armure au level cap : « c'est prendre un risque, laisse tomber ».`,
    en: `The natural partner of the <b>Melee Influence</b> arcane per Pandaahh: Gyre electrifies everything around her, so the arcane (melee Electricity proc → 20% chance to spread statuses within 20 m) runs continuously while your melee stays <b>Toxin</b>. The reverse — a full-Electric melee to trigger Influence yourself — gets punished by armor at level cap: "that's taking a risk, drop it".`,
  },
  "gyre-prime": {
    fr: `Le duo naturel de l'arcane <b>Melee Influence</b> selon <a href="https://www.youtube.com/watch?v=lhBOA_XlgzY" target="_blank" rel="noopener">Pandaahh</a> : Gyre électrise tout autour d'elle, donc l'arcane (proc Électrique en mêlée → 20 % de chance de propager les statuts à 20 m) tourne en continu pendant que ta mêlée reste en <b>Toxine</b>. L'inverse — une mêlée full Électrique pour déclencher Influence soi-même — se fait punir par l'armure au level cap : « c'est prendre un risque, laisse tomber ».`,
    en: `The natural partner of the <b>Melee Influence</b> arcane per Pandaahh: Gyre electrifies everything around her, so the arcane (melee Electricity proc → 20% chance to spread statuses within 20 m) runs continuously while your melee stays <b>Toxin</b>. The reverse — a full-Electric melee to trigger Influence yourself — gets punished by armor at level cap: "that's taking a risk, drop it".`,
  },
  "sirius-orion": {
    fr: `Le setup « confort » de Pandaahh, validé au level cap (<a href="https://www.youtube.com/watch?v=M8DrtgNgUmE" target="_blank" rel="noopener">vidéo dédiée</a>) : dans les options, <b>inverse « appui court / maintien »</b> des pouvoirs pour cette frame — chaque cast permute alors la forme, la constellation se remplit toute seule et le 4 revient très vite (l'ulti crit bien plus fort quand on alterne Sirius et Orion). L'énergie est si généreuse qu'<b>Équilibre</b> seul suffit pour tout spammer. Builds jumeaux à un mod près : <b>Precision Intensify</b> côté Orion, Intensité Umbra côté Sirius. Autour : une secondaire à <b>Secondary Fortifier</b> (Furis ou Dual Toxocyst Incarnon) pour les Thrax — ou strip du 1 d'Orion + du Magnétique —, Praedos pour la mobilité, Madurai pour les fantômes, et un <b>Diriga</b> (Bobine Foudroyante + orbes de vie + Équilibre) qui entretient PV et énergie. Verdict : « extraordinaire nulle part, mauvaise nulle part » — LA frame fun, à jouer arme au poing, encore un peu buggée mais corrigée patch après patch. Bilan du <a href="https://www.youtube.com/watch?v=1Arhdo8iH2U" target="_blank" rel="noopener">level cap en Cascade</a> : niveau 10 000 atteint, ~70 arcanes et 600 000 crédits au passage. À noter : l'arcane <b>Tonnerre de Feu</b> (Hot Shot) se nourrit du Feu posé par le 1 — et par les étincelles du 2 —, et le coup final de l'ulti <b>ne traverse pas les murs</b>, place-toi en conséquence.`,
    en: `Pandaahh's "comfort" setup, validated at level cap: in the options, <b>invert "tap / hold"</b> abilities for this frame — every cast then swaps forms, the constellation fills itself and the 4 comes back very fast (the ultimate crits much harder when you alternate Sirius and Orion). Energy income is so generous that <b>Equilibrium</b> alone covers full spam. Twin builds one mod apart: <b>Precision Intensify</b> on Orion, Umbral Intensify on Sirius. Around it: a <b>Secondary Fortifier</b> secondary (Furis or Dual Toxocyst Incarnon) for Thrax — or strip with Orion's 1 + Magnetic —, Praedos for mobility, Madurai for the ghosts, and a <b>Diriga</b> (Arc Coil + health orbs + Equilibrium) sustaining HP and energy. Verdict: "extraordinary nowhere, bad nowhere either" — THE fun frame, played guns out, still a bit buggy but fixed patch after patch. Level-cap run results (Cascade live): level 10,000 reached, ~70 arcanes and 600,000 credits along the way. Worth noting: the <b>Hot Shot</b> arcane feeds on the Heat applied by the 1 — and by the 2's sparks —, and the ultimate's final blow <b>does not pierce walls</b>, position accordingly.`,
  },
  "mirage": {
    fr: `Le combo tank de Pandaahh (<a href="https://www.youtube.com/watch?v=8_Mb0aU1Ofo" target="_blank" rel="noopener">testé en live</a>) : <b>Null Star de Nova en Helminth</b> avec l'augment <b>Neutron Star</b> — 5 % de réduction de dégâts par particule (plafond 90 %), et il suffit de rester au contact pour que les particules frappent toutes seules ; un recast les redisperse puis les régénère. « Tant que j'ai mon 1 [les clones] et mon 2 [Null Star], je prends zéro dégât. » Eclipse reste le buffer d'armes : Akarius Viral + Feu en confort, ou un <b>Lenz</b> pour le spectacle (voir sa fiche). Côté énergie, Nexus d'énergie ne suffit pas seul — ajoute Équilibre ou Flux.`,
    en: `Pandaahh's tank combo (live-tested): <b>Nova's Null Star as Helminth</b> with the <b>Neutron Star</b> augment — 5% damage reduction per particle (90% cap), and staying close lets the particles strike on their own; recasting disperses then replenishes them. "As long as I have my 1 [the clones] and my 2 [Null Star], I take zero damage." Eclipse stays the weapon buffer: Akarius Viral + Heat for comfort, or a <b>Lenz</b> for the show (see its page). Energy-wise, Energy Nexus alone isn't enough — add Equilibrium or Flux.`,
  },
  "mirage-prime": {
    fr: `Le combo tank de Pandaahh (<a href="https://www.youtube.com/watch?v=8_Mb0aU1Ofo" target="_blank" rel="noopener">testé en live</a>) : <b>Null Star de Nova en Helminth</b> avec l'augment <b>Neutron Star</b> — 5 % de réduction de dégâts par particule (plafond 90 %), et il suffit de rester au contact pour que les particules frappent toutes seules ; un recast les redisperse puis les régénère. « Tant que j'ai mon 1 [les clones] et mon 2 [Null Star], je prends zéro dégât. » Eclipse reste le buffer d'armes : Akarius Viral + Feu en confort, ou un <b>Lenz</b> pour le spectacle (voir sa fiche). Côté énergie, Nexus d'énergie ne suffit pas seul — ajoute Équilibre ou Flux.`,
    en: `Pandaahh's tank combo (live-tested): <b>Nova's Null Star as Helminth</b> with the <b>Neutron Star</b> augment — 5% damage reduction per particle (90% cap), and staying close lets the particles strike on their own; recasting disperses then replenishes them. "As long as I have my 1 [the clones] and my 2 [Null Star], I take zero damage." Eclipse stays the weapon buffer: Akarius Viral + Heat for comfort, or a <b>Lenz</b> for the show (see its page). Energy-wise, Energy Nexus alone isn't enough — add Equilibrium or Flux.`,
  },
  "lenz": {
    fr: `La curiosité préférée de <a href="https://www.youtube.com/watch?v=8_Mb0aU1Ofo" target="_blank" rel="noopener">Pandaahh sous buff Mirage</a> : ~150 % de chance de crit avec le seul Délai Critique, et une particularité que seuls les <a href="/builds/okina">Okina Incarnon</a> partagent — <b>un seul mod Poison</b> et l'arme sort <b>du poison, du viral, de la glace et de l'explosif</b> (sa bulle de Froid et son explosion restent des instances séparées). La glace augmente les dégâts critiques sur les cibles gelées, et <b>Munitions du chasseur</b> achève au Tranchant tout ce qui survit. « Très agréable, très puissante. »`,
    en: `Pandaahh's favorite curiosity under a Mirage buff: ~150% crit chance from Critical Delay alone, and a quirk only the <a href="/en/builds/okina">Incarnon Okina</a> share — <b>one single Toxin mod</b> and the weapon outputs <b>toxin, viral, cold and blast</b> (its Cold bubble and its explosion stay separate instances). Cold raises crit damage on frozen targets, and <b>Hunter Munitions</b> finishes whatever survives with Slash. "Very comfortable, very powerful."`,
  },
  "okina": {
    fr: `Même particularité rare que le <a href="/builds/lenz">Lenz</a>, relevée par <a href="https://www.youtube.com/watch?v=8_Mb0aU1Ofo" target="_blank" rel="noopener">Pandaahh</a> : en forme Incarnon, un seul mod élémentaire en sort plusieurs (poison → poison + viral + glace…). Et avec les Dual Ichor, c'est l'une des seules mêlées Incarnon qu'il classe dans les « dingueries » qui valent l'adaptateur.`,
    en: `Same rare quirk as the <a href="/en/builds/lenz">Lenz</a>, noted by Pandaahh: in Incarnon form, a single elemental mod outputs several (toxin → toxin + viral + cold…). And alongside the Dual Ichor, it's one of the only Incarnon melees he files under the "crazy ones" worth the adapter.`,
  },
  "okina-prime": {
    fr: `Même particularité rare que le <a href="/builds/lenz">Lenz</a>, relevée par <a href="https://www.youtube.com/watch?v=8_Mb0aU1Ofo" target="_blank" rel="noopener">Pandaahh</a> : en forme Incarnon, un seul mod élémentaire en sort plusieurs (poison → poison + viral + glace…). Et avec les Dual Ichor, c'est l'une des seules mêlées Incarnon qu'il classe dans les « dingueries » qui valent l'adaptateur.`,
    en: `Same rare quirk as the <a href="/en/builds/lenz">Lenz</a>, noted by Pandaahh: in Incarnon form, a single elemental mod outputs several (toxin → toxin + viral + cold…). And alongside the Dual Ichor, it's one of the only Incarnon melees he files under the "crazy ones" worth the adapter.`,
  },
  "ceramic-dagger": {
    fr: `Le générateur de combo de l'arcane <b>Secondary Outburst</b>, rappelé par <a href="https://www.youtube.com/watch?v=8_Mb0aU1Ofo" target="_blank" rel="noopener">Pandaahh</a> : monte le multiplicateur en mêlée (l'Incarnon de la dague excelle là-dedans), puis <b>dégaine ta secondaire</b> — l'arcane consomme le combo et donne <b>+20 % de chance ET de dégâts critiques par multiplicateur pendant 30 s</b> (~+200 % à ×9 et plus). De quoi faire passer n'importe quelle secondaire en crit rouge.`,
    en: `The combo battery for the <b>Secondary Outburst</b> arcane, as Pandaahh reminds: build the multiplier in melee (the dagger's Incarnon excels at it), then <b>swap to your secondary</b> — the arcane consumes the combo and grants <b>+20% crit chance AND crit damage per multiplier for 30 s</b> (~+200% at ×9 and beyond). Enough to push any secondary into red crits.`,
  },
  "akarius": {
    fr: `Sous Mirage tank (Null Star + Eclipse, <a href="https://www.youtube.com/watch?v=8_Mb0aU1Ofo" target="_blank" rel="noopener">test live</a>) : très confortables en <b>Viral + Feu</b> avec Secondary Fortifier, mais leur chance de crit de base est trop basse pour viser l'orange ou le rouge — Pandaahh leur laisse le rôle « dégâts + confort » et sort un Lenz quand il veut du crit.`,
    en: `Under a tank Mirage (Null Star + Eclipse, live test): very comfortable built <b>Viral + Heat</b> with Secondary Fortifier, but their base crit chance is too low to chase orange or red — Pandaahh keeps them on "damage + comfort" duty and pulls out a Lenz when he wants crits.`,
  },
  "akarius-prime": {
    fr: `Sous Mirage tank (Null Star + Eclipse, <a href="https://www.youtube.com/watch?v=8_Mb0aU1Ofo" target="_blank" rel="noopener">test live</a>) : très confortables en <b>Viral + Feu</b> avec Secondary Fortifier, mais leur chance de crit de base est trop basse pour viser l'orange ou le rouge — Pandaahh leur laisse le rôle « dégâts + confort » et sort un Lenz quand il veut du crit.`,
    en: `Under a tank Mirage (Null Star + Eclipse, live test): very comfortable built <b>Viral + Heat</b> with Secondary Fortifier, but their base crit chance is too low to chase orange or red — Pandaahh keeps them on "damage + comfort" duty and pulls out a Lenz when he wants crits.`,
  },
  "nidus": {
    fr: `« Nidus est devenu trop bien » — le build confort post-retouche (maj 43) de Pandaahh, <a href="https://www.youtube.com/watch?v=uwh7ZEDqrXI" target="_blank" rel="noopener">testé en vidéo</a> et candidat à son prochain level cap. Plafond de cumuls passé à <b>200</b> ; augment <b>Parasitic Vitality</b> sur le 3 pour des PV « insane » (~26 000 en jeu) et, nouveauté : le <b>lien se pose sur ton compagnon animal en appui long</b> — et survit à sa mort (⚠️ jamais le mod Régression Panzer : le changement de phase casse le lien ; sentinelles exclues depuis un patch). Rotation : <b>2</b> pour packer → <b>1</b> pour les cumuls, augment <b>Teeming Virulence</b> = crit rouge aux armes principales (+1 233 % de chance de crit en démo). Sur le 4 : <b>Ophanim Eyes</b> (Jade, Helminth) en strip de masse (−10 %/s armure ET boucliers). Arcanes : <b>Persistence</b> (armure &gt; 700 via Fibre Umbra : dégâts subis capés à 500/s) + <b>Belliqueux</b> (+72 % de puissance grâce aux PV). Arme du test : <a href="/builds/coda-bassocyst">Coda Bassocyst</a>. Énergie autonome (Adrénaline du Chasseur + le 1 en rend). <b>Variante ultra-confort</b> partagée par un viewer et validée en live (<a href="https://www.youtube.com/watch?v=J3UD7KIBNrc" target="_blank" rel="noopener">vidéo</a>) : remplacer Ophanim Eyes par <b>Barrage Tempête</b> d'<a href="/builds/hydroid">Hydroïde</a> + augment <b>Tempête Virale</b> (Corrosif + Viral en zone) sur le 4, et finir tout survivant — y compris sous garde renforcée — d'un coup de <a href="/builds/pox">Pox</a> en secondaire. On sacrifie Continuité (durée) pour caser l'augment ; l'énergie tient grâce à Adrénaline du Chasseur + l'arcane Batterie. Pandaahh prévoit d'en faire son premier level cap solo en cascade.`,
    en: `"Nidus has become too good" — Pandaahh's post-rework (Update 43) comfort build, video-tested and his next level-cap candidate. Stack cap raised to <b>200</b>; <b>Parasitic Vitality</b> augment on the 3 for "insane" HP (~26,000 in game) and, new: the <b>link can be hold-cast onto your animal companion</b> — and survives its death (⚠️ never the Panzer Devolution mod: the phase change breaks the link; sentinels excluded since a patch). Rotation: <b>2</b> to group → <b>1</b> for stacks, <b>Teeming Virulence</b> augment = red crits on primaries (+1,233% crit chance in the demo). On the 4: <b>Ophanim Eyes</b> (Jade, Helminth) as mass strip (−10%/s armor AND shields). Arcanes: <b>Persistence</b> (armor &gt; 700 via Umbral Fiber: damage taken capped at 500/s) + <b>Bellicose</b> (+72% strength from the HP). Test weapon: <a href="/en/builds/coda-bassocyst">Coda Bassocyst</a>. Self-sufficient energy (Hunter Adrenaline + the 1 refunds some). <b>Ultra-comfort variant</b> shared by a viewer and live-approved: swap Ophanim Eyes for <a href="/en/builds/hydroid">Hydroid</a>'s <b>Tempest Barrage</b> + <b>Viral Tempest</b> augment (area Corrosive + Viral) on the 4, then finish any survivor — even Overguard-shielded ones — with one <a href="/en/builds/pox">Pox</a> hit as your secondary. Drop Continuity (duration) to fit the augment; energy holds up via Hunter Adrenaline + the Battery arcane. Pandaahh plans to make this his first solo level-cap cascade.`,
  },
  "nidus-prime": {
    fr: `« Nidus est devenu trop bien » — le build confort post-retouche (maj 43) de Pandaahh, <a href="https://www.youtube.com/watch?v=uwh7ZEDqrXI" target="_blank" rel="noopener">testé en vidéo</a> et candidat à son prochain level cap. Plafond de cumuls passé à <b>200</b> ; augment <b>Parasitic Vitality</b> sur le 3 pour des PV « insane » (~26 000 en jeu) et, nouveauté : le <b>lien se pose sur ton compagnon animal en appui long</b> — et survit à sa mort (⚠️ jamais le mod Régression Panzer : le changement de phase casse le lien ; sentinelles exclues depuis un patch). Rotation : <b>2</b> pour packer → <b>1</b> pour les cumuls, augment <b>Teeming Virulence</b> = crit rouge aux armes principales (+1 233 % de chance de crit en démo). Sur le 4 : <b>Ophanim Eyes</b> (Jade, Helminth) en strip de masse (−10 %/s armure ET boucliers). Arcanes : <b>Persistence</b> (armure &gt; 700 via Fibre Umbra : dégâts subis capés à 500/s) + <b>Belliqueux</b> (+72 % de puissance grâce aux PV). Arme du test : <a href="/builds/coda-bassocyst">Coda Bassocyst</a>. Énergie autonome (Adrénaline du Chasseur + le 1 en rend). <b>Variante ultra-confort</b> partagée par un viewer et validée en live (<a href="https://www.youtube.com/watch?v=J3UD7KIBNrc" target="_blank" rel="noopener">vidéo</a>) : remplacer Ophanim Eyes par <b>Barrage Tempête</b> d'<a href="/builds/hydroid">Hydroïde</a> + augment <b>Tempête Virale</b> (Corrosif + Viral en zone) sur le 4, et finir tout survivant — y compris sous garde renforcée — d'un coup de <a href="/builds/pox">Pox</a> en secondaire. On sacrifie Continuité (durée) pour caser l'augment ; l'énergie tient grâce à Adrénaline du Chasseur + l'arcane Batterie. Pandaahh prévoit d'en faire son premier level cap solo en cascade.`,
    en: `"Nidus has become too good" — Pandaahh's post-rework (Update 43) comfort build, video-tested and his next level-cap candidate. Stack cap raised to <b>200</b>; <b>Parasitic Vitality</b> augment on the 3 for "insane" HP (~26,000 in game) and, new: the <b>link can be hold-cast onto your animal companion</b> — and survives its death (⚠️ never the Panzer Devolution mod: the phase change breaks the link; sentinels excluded since a patch). Rotation: <b>2</b> to group → <b>1</b> for stacks, <b>Teeming Virulence</b> augment = red crits on primaries (+1,233% crit chance in the demo). On the 4: <b>Ophanim Eyes</b> (Jade, Helminth) as mass strip (−10%/s armor AND shields). Arcanes: <b>Persistence</b> (armor &gt; 700 via Umbral Fiber: damage taken capped at 500/s) + <b>Bellicose</b> (+72% strength from the HP). Test weapon: <a href="/en/builds/coda-bassocyst">Coda Bassocyst</a>. Self-sufficient energy (Hunter Adrenaline + the 1 refunds some). <b>Ultra-comfort variant</b> shared by a viewer and live-approved: swap Ophanim Eyes for <a href="/en/builds/hydroid">Hydroid</a>'s <b>Tempest Barrage</b> + <b>Viral Tempest</b> augment (area Corrosive + Viral) on the 4, then finish any survivor — even Overguard-shielded ones — with one <a href="/en/builds/pox">Pox</a> hit as your secondary. Drop Continuity (duration) to fit the augment; energy holds up via Hunter Adrenaline + the Battery arcane. Pandaahh plans to make this his first solo level-cap cascade.`,
  },
  "coda-bassocyst": {
    fr: `L'arme du <a href="https://www.youtube.com/watch?v=uwh7ZEDqrXI" target="_blank" rel="noopener">Nidus post-retouche de Pandaahh</a> : très bon fusil à pompe de liche Coda, dont le <b>tir secondaire</b> colle une mite infestée sur la tête (Impact + <b>Magnétique</b>) et <b>ouvre les finishers</b> sur n'importe quel ennemi. Build simple : valence Poison + un seul mod de Froid = Viral, <b>Munitions du chasseur</b> pour le Tranchant, et l'arcane <b>Vendetta au Fusil</b> (kill à moins de 5 m : +180 % de tir multiple, +75 % de recharge) qui gomme son vrai défaut, la recharge.`,
    en: `The weapon of Pandaahh's post-rework Nidus: a strong Coda lich shotgun whose <b>alt fire</b> sticks an infested mite to heads (Impact + <b>Magnetic</b>) and <b>opens finishers</b> on any enemy. Simple build: Toxin valence + a single Cold mod = Viral, <b>Hunter Munitions</b> for Slash, and the <b>Shotgun Vendetta</b> arcane (kill within 5 m: +180% multishot, +75% reload) which erases its real flaw, the reload.`,
  },
  "pharaoh-predasite": {
    fr: `Le compagnon du <a href="https://www.youtube.com/watch?v=uwh7ZEDqrXI" target="_blank" rel="noopener">Nidus post-retouche</a>, conseil validé en live : ses précepts posent du <b>Viral</b> et un nuage de spores qui donne <b>+100 % de dégâts Poison</b> pendant 10 s — « le compagnon est beaucoup trop fort, il tue tout seul ». Se récupère facilement sur Deimos, et le lien de Nidus (appui long sur le 3) s'y accroche parfaitement.`,
    en: `The companion of the post-rework Nidus, validated live: its precepts apply <b>Viral</b> and a spore cloud granting <b>+100% Toxin damage</b> for 10 s — "the companion is way too strong, it kills on its own". Easy to get on Deimos, and Nidus' link (hold the 3) latches onto it perfectly.`,
  },
  "panzer-vulpaphyla": {
    fr: `Excellent choix pour le <a href="https://www.youtube.com/watch?v=uwh7ZEDqrXI" target="_blank" rel="noopener">lien de Nidus</a>, à un piège près : <b>jamais le mod Régression Panzer</b> — quand le Panzer change de phase et vole au-dessus de ta tête, le lien casse. Sans ce mod, tout roule : le lien survit même à sa mort.`,
    en: `An excellent pick for Nidus' link, with one trap: <b>never equip Panzer Devolution</b> — when the Panzer shifts phase and floats above your head, the link breaks. Without that mod everything works: the link even survives its death.`,
  },
  "war-prime": {
    fr: `« Presque offerte » selon <a href="https://www.youtube.com/watch?v=WF2zdRFlYHc" target="_blank" rel="noopener">Pandaahh</a> : après la quête Constellations, ~20 Talents de chaque couleur tombent par run des nouvelles missions Railjack d'Uranus, et le <b>bibelot de Hunhow</b> (tour Pontis, 12 + 12 Talents) la débloque — <b>slot et catalyseur pré-installés</b>, non échangeable. Profil très <b>Impact</b> (chaque coup en proc un), multiplicateur de crit et statut relevés par rapport à la War. Pistes de build : <b>Tempo Royale</b>, Surcharge d'État, et au choix électrique + Melee Influence ou poison + Melee Exposure — et de la vitesse d'attaque, c'est une lame lourde.`,
    en: `"Almost a gift" per Pandaahh: after the Constellations quest, ~20 Talents of each color drop per run of the new Uranus Railjack missions, and <b>Hunhow's Trinket</b> (Pontis Tower, 12 + 12 Talents) unlocks it — <b>slot and catalyst pre-installed</b>, untradable. Heavily <b>Impact</b>-flavored (every hit procs one), with higher crit multiplier and status than the War. Build leads: <b>Tempo Royale</b>, Condition Overload, and either electric + Melee Influence or toxin + Melee Exposure — plus attack speed, it's a heavy blade.`,
  },
  "broken-war": {
    fr: `Rien à voir avec la War malgré leur histoire commune, rappelle <a href="https://www.youtube.com/watch?v=WF2zdRFlYHc" target="_blank" rel="noopener">Pandaahh</a> : la Broken War fait <b>beaucoup plus de Tranchant</b>. Et depuis la maj 43, fini le farm au compte-gouttes : un <b>bibelot chez Hunhow</b> (tour Pontis, Talents des nouvelles missions d'Uranus) la donne directement — deux runs suffisent pour elle ET la War Prime.`,
    en: `Nothing like the War despite their shared story, Pandaahh reminds: the Broken War deals <b>far more Slash</b>. And since Update 43, no more drip-feed farming: a <b>trinket at Hunhow's</b> (Pontis Tower, Talents from the new Uranus missions) grants it directly — two runs cover both it AND the War Prime.`,
  },
  "gotva-prime": {
    fr: `Sa particularité, rappelée par <a href="https://www.youtube.com/watch?v=_GbK9rRsVs4" target="_blank" rel="noopener">Pandaahh</a> : chaque tir a une <b>chance de critique fixe à 300 %</b> — une valeur non modifiable par les mods (empiler du crit ne fait rien), mais qui garantit un crit rouge à chaque déclenchement. Chez Baro Ki'Teer, pas de farm alternatif.`,
    en: `Its quirk, per Pandaahh: every shot carries a <b>fixed 300% crit chance</b> — a value mods can't modify (stacking crit chance does nothing), but it guarantees a red crit whenever it triggers. Sold by Baro Ki'Teer, no alternative farm.`,
  },
  "vastilok": {
    fr: `La meilleure gunblade pour striper les défenses ennemies selon <a href="https://www.youtube.com/watch?v=_GbK9rRsVs4" target="_blank" rel="noopener">Pandaahh</a> : « si tu as besoin de strip avec une gunblade, c'est le Vastilok, cherche pas ». Vendu chez Baro Ki'Teer.`,
    en: `The best gunblade for stripping enemy defenses per Pandaahh: "if you need a strip with a gunblade, it's the Vastilok, don't look further". Sold by Baro Ki'Teer.`,
  },
  "paris-prime": {
    fr: `Le build « boost de compagnon » de <a href="https://www.youtube.com/watch?v=_sxFT6MzngI" target="_blank" rel="noopener">Pandaahh</a> : équipé sur l'Opérateur, il pousse les <b>griffes du compagnon</b> jusqu'à ~280 % de chance de statut et ~126 % de chance critique — combo testé avec un Huras sur un <a href="/builds/styanax">Styanax</a> level cap.`,
    en: `Pandaahh's "companion boost" build: equipped on the Operator, it pushes <b>companion claws</b> up to ~280% status chance and ~126% crit chance — combo tested with a Huras on a level-cap <a href="/en/builds/styanax">Styanax</a>.`,
  },
  "huras-kubrow": {
    fr: `Le compagnon « confort » de <a href="https://www.youtube.com/watch?v=_sxFT6MzngI" target="_blank" rel="noopener">Pandaahh</a> : reste invisible la majeure partie du temps, et sa <b>Posture Assassine</b> le fait cibler en priorité les ennemis à Surgarde — testé sur un <a href="/builds/styanax">Styanax</a> level cap avec un <a href="/builds/paris-prime">Paris Prime</a> pour booster ses griffes.`,
    en: `Pandaahh's "comfort" companion: stays invisible most of the time, and its <b>Assassin Posture</b> makes it prioritize Overguard targets — tested on a level-cap <a href="/en/builds/styanax">Styanax</a> with a <a href="/en/builds/paris-prime">Paris Prime</a> to boost its claws.`,
  },
  "smeeta-kavat": {
    fr: `Le ×2 ressources du Charm n'existe plus sous sa forme historique : il est devenu un mod précepte dédié, <b>Loyal Retriever</b> (13 % de chance de doubler chaque ressource et crédit ramassés, effet permanent, équipable sur toutes les bêtes — offert automatiquement si tu possédais déjà un Smeeta). Charm, lui, déclenche désormais ses buffs plus souvent (40 %).`,
    en: `Charm's resource ×2 is gone in its historical form: it moved to a dedicated precept mod, <b>Loyal Retriever</b> (13% chance to double every resource and credit pickup, always active, equippable on all Beasts — granted for free to existing Smeeta owners). Charm itself now procs its buffs more often (40%).`,
  },
  "citrine": {
    fr: `<a href="/builds/citrine-prime">Citrine Prime</a> est disponible depuis la maj 44 (<a href="/guides/iceblade-de-narin">Iceblade of Narin</a>, 23/09/2026), avec le Steflos Prime et le Corufell Prime — <a href="/o/citrine_prime_set">prix du set</a>. La version standard reste une excellente buffeuse de zone grâce à son Voile qui empile résistance aux dégâts et bonus offensifs sur toute l'équipe.`,
    en: `<a href="/en/builds/citrine-prime">Citrine Prime</a> has been out since Update 44 (<a href="/en/guides/iceblade-of-narin">Iceblade of Narin</a>, 9/23/2026), with Steflos Prime and Corufell Prime. The standard version remains an excellent squad buffer thanks to her Veil, which stacks damage resistance and offensive bonuses for the whole team.`,
  },
  "qorvex": {
    fr: `Le skin <b>Deluxe</b> de Qorvex, <b>Basilica</b> (thème gargouille, architecture gothique), est sorti avec la maj 44 — <a href="/guides/iceblade-de-narin">tout le contenu d'Iceblade of Narin</a>.`,
    en: `Qorvex's <b>Deluxe</b> skin, <b>Basilica</b> (gargoyle, gothic-architecture theme), was released with Update 44 — <a href="/en/guides/iceblade-of-narin">everything in Iceblade of Narin</a>.`,
  },
  "nyx": {
    fr: `Compo partagée par un viewer et retestée en live (<a href="https://www.youtube.com/watch?v=XeIHvnsM5s4" target="_blank" rel="noopener">vidéo</a>) : on joue <b>sans le 4</b> (Absorption), remplacé au Helminth par <b>Prime explosive de Nova</b> ou, encore mieux selon Pandaahh, <b>Murmure de Xata</b>. Le <b>2</b> (Carreaux psychiques) avec l'augment <b>Carreau pacificateur</b> vole de la garde renforcée à chaque tir (jusqu'à 7 500 cumuls) — pratique, mais ⚠️ n'enlève pas 100 % de la garde en un coup : un peu de <b>Magnétique</b> sur l'arme reste nécessaire pour finir le travail. Arme conseillée pour le test : <a href="/builds/tenet-glaxion">Tenet Glaxion</a> avec l'arcane Affaiblissement.`,
    en: `A build shared by a viewer and live-retested (video): played <b>without the 4</b> (Absorb), replaced via Helminth with <b>Nova's Molecular Prime</b> or, Pandaahh's preferred pick, <b>Xata's Whisper</b>. The <b>2</b> (Psychic Bolts) with the <b>Pacifying Bolts</b> augment steals Overguard on every hit (up to a 7,500 cap) — handy, but ⚠️ it doesn't strip 100% in one go: a bit of <b>Magnetic</b> on the weapon is still needed to finish the job. Recommended test weapon: <a href="/en/builds/tenet-glaxion">Tenet Glaxion</a> with the Primary Debilitate arcane.`,
  },
  "nyx-prime": {
    fr: `Compo partagée par un viewer et retestée en live (<a href="https://www.youtube.com/watch?v=XeIHvnsM5s4" target="_blank" rel="noopener">vidéo</a>) : on joue <b>sans le 4</b> (Absorption), remplacé au Helminth par <b>Prime explosive de Nova</b> ou, encore mieux selon Pandaahh, <b>Murmure de Xata</b>. Le <b>2</b> (Carreaux psychiques) avec l'augment <b>Carreau pacificateur</b> vole de la garde renforcée à chaque tir (jusqu'à 7 500 cumuls) — pratique, mais ⚠️ n'enlève pas 100 % de la garde en un coup : un peu de <b>Magnétique</b> sur l'arme reste nécessaire pour finir le travail. Arme conseillée pour le test : <a href="/builds/tenet-glaxion">Tenet Glaxion</a> avec l'arcane Affaiblissement.`,
    en: `A build shared by a viewer and live-retested (video): played <b>without the 4</b> (Absorb), replaced via Helminth with <b>Nova's Molecular Prime</b> or, Pandaahh's preferred pick, <b>Xata's Whisper</b>. The <b>2</b> (Psychic Bolts) with the <b>Pacifying Bolts</b> augment steals Overguard on every hit (up to a 7,500 cap) — handy, but ⚠️ it doesn't strip 100% in one go: a bit of <b>Magnetic</b> on the weapon is still needed to finish the job. Recommended test weapon: <a href="/en/builds/tenet-glaxion">Tenet Glaxion</a> with the Primary Debilitate arcane.`,
  },
  "pox": {
    fr: `Le finisseur mono-cible du build confort <a href="/builds/nidus">Nidus + Hydroïde</a> (<a href="https://www.youtube.com/watch?v=J3UD7KIBNrc" target="_blank" rel="noopener">testé en live</a>) : un coup de Pox suffit à achever à peu près n'importe quel ennemi grâce à son nuage toxique, y compris ceux protégés par de la garde renforcée que le 1 de Nidus n'arrive pas à regrouper.`,
    en: `The single-target finisher of the <a href="/en/builds/nidus">Nidus + Hydroid</a> comfort build (live-tested): one Pox hit is enough to finish off almost any enemy thanks to its toxic cloud, including ones shielded by Overguard that Nidus's 1 can't pull in.`,
  },
  "hydroid": {
    fr: `Donneur Helminth malin, <a href="https://www.youtube.com/watch?v=J3UD7KIBNrc" target="_blank" rel="noopener">repéré en live</a> sur <a href="/builds/nidus">Nidus</a> : sa <b>Barrage Tempête</b> (1) inflige 100 % de Corrosif de base, et avec l'augment <b>Tempête Virale</b>, chaque projectile ajoute aussi du Viral — armure en moins, dégâts subis en plus, sur toute une zone, sans consommer le slot de pouvoir d'origine de la frame hôte.`,
    en: `A clever Helminth donor, spotted live on <a href="/en/builds/nidus">Nidus</a>: his <b>Tempest Barrage</b> (1) deals 100% Corrosive by default, and with the <b>Viral Tempest</b> augment, every projectile also adds Viral — less armor, more damage taken, over a whole area, without using up the host frame's own ability slot.`,
  },
  "hydroid-prime": {
    fr: `Donneur Helminth malin, <a href="https://www.youtube.com/watch?v=J3UD7KIBNrc" target="_blank" rel="noopener">repéré en live</a> sur <a href="/builds/nidus">Nidus</a> : sa <b>Barrage Tempête</b> (1) inflige 100 % de Corrosif de base, et avec l'augment <b>Tempête Virale</b>, chaque projectile ajoute aussi du Viral — armure en moins, dégâts subis en plus, sur toute une zone, sans consommer le slot de pouvoir d'origine de la frame hôte.`,
    en: `A clever Helminth donor, spotted live on <a href="/en/builds/nidus">Nidus</a>: his <b>Tempest Barrage</b> (1) deals 100% Corrosive by default, and with the <b>Viral Tempest</b> augment, every projectile also adds Viral — less armor, more damage taken, over a whole area, without using up the host frame's own ability slot.`,
  },
};
/* Notes maj 44 « Iceblade of Narin » (28/09/2026) — source : notes de mise à jour
   officielles (Update 44 + hotfix 44.0.1). Retirer quand l'info n'est plus d'actualité. */
const SLUG_NOTES_MAJ44 = {
  "narin": {
    fr: `Nouvelle Warframe de la maj 44 (<a href="/guides/iceblade-de-narin">Iceblade of Narin</a>, 23/09/2026). Chaque pouvoir qui touche remplit sa jauge de <b>Glace</b> ; le 4 (Nurinarim) exige la jauge pleine. Son 2 recharge les boucliers en absorbant le Froid posé (Overguard boucliers pleins), et frapper un ennemi gelé pendant le 4 le fait exploser. Plans au Zariman ou chez Cephalon Melica contre du <b>Kuva Entropique</b> (Eximus Entropiques). Son 1, Neote, est son pouvoir Helminth.`,
    en: `New Warframe from Update 44 (<a href="/en/guides/iceblade-of-narin">Iceblade of Narin</a>, 9/23/2026). Every ability that lands fills her <b>Ice</b> gauge; her 4 (Nurinarim) needs it full. Her 2 refills shields by absorbing the Cold she applied (Overguard at full shields), and hitting a frozen enemy during her 4 makes it explode. Blueprints from the Zariman or Cephalon Melica for <b>Entropic Kuva</b> (Entropic Eximus). Her 1, Neote, is her Helminth ability.`,
  },
  "citrine-prime": {
    fr: `Sortie avec la maj 44 (<a href="/guides/iceblade-de-narin">Iceblade of Narin</a>, 23/09/2026) avec le <a href="/builds/steflos-prime">Steflos Prime</a> et le <a href="/builds/corufell-prime">Corufell Prime</a>. Se farme en reliques — compare le <a href="/o/citrine_prime_set">prix du set</a> avant d'acheter.`,
    en: `Released with Update 44 (<a href="/en/guides/iceblade-of-narin">Iceblade of Narin</a>, 9/23/2026) alongside <a href="/en/builds/steflos-prime">Steflos Prime</a> and <a href="/en/builds/corufell-prime">Corufell Prime</a>. Farmable from relics — check the set price before buying.`,
  },
  "steflos-prime": {
    fr: `Arme signature de <a href="/builds/citrine-prime">Citrine Prime</a> (maj 44, <a href="/guides/iceblade-de-narin">Iceblade of Narin</a>) : plus de portée que le Steflos. Pièces en reliques — <a href="/o/steflos_prime_set">prix du set</a>.`,
    en: `<a href="/en/builds/citrine-prime">Citrine Prime</a>'s signature weapon (Update 44, <a href="/en/guides/iceblade-of-narin">Iceblade of Narin</a>): longer reach than the Steflos. Parts from relics.`,
  },
  "corufell-prime": {
    fr: `Arme signature de <a href="/builds/citrine-prime">Citrine Prime</a> (maj 44, <a href="/guides/iceblade-de-narin">Iceblade of Narin</a>) : attaques lourdes plus rapides que le Corufell. Pièces en reliques — <a href="/o/corufell_prime_set">prix du set</a>.`,
    en: `<a href="/en/builds/citrine-prime">Citrine Prime</a>'s signature weapon (Update 44, <a href="/en/guides/iceblade-of-narin">Iceblade of Narin</a>): faster heavy attacks than the Corufell. Parts from relics.`,
  },
  "nunchasa": {
    fr: `Arc signature de <a href="/builds/narin">Narin</a> (maj 44, <a href="/guides/iceblade-de-narin">Iceblade of Narin</a>) : le tir alternatif chargé lâche une flèche de blizzard qui gèle les ennemis touchés et laisse une traînée glacée — parfait pour préparer les explosions du 4 de Narin. Plans chez Cephalon Melica contre du Kuva Entropique.`,
    en: `<a href="/en/builds/narin">Narin</a>'s signature bow (Update 44, <a href="/en/guides/iceblade-of-narin">Iceblade of Narin</a>): the charged alt fire looses a blizzard arrow that freezes enemies it touches and leaves a chilling path — ideal to set up Narin's 4 explosions. Blueprints from Cephalon Melica for Entropic Kuva.`,
  },
  "aksondol": {
    fr: `Pistolets signature de <a href="/builds/narin">Narin</a> (maj 44, <a href="/guides/iceblade-de-narin">Iceblade of Narin</a>) : recharger libère une brume gelante qui applique du Froid, d'autant plus large qu'on recharge de balles. Plans chez Cephalon Melica contre du Kuva Entropique.`,
    en: `<a href="/en/builds/narin">Narin</a>'s signature pistols (Update 44, <a href="/en/guides/iceblade-of-narin">Iceblade of Narin</a>): reloading releases a freezing mist that applies Cold, wider the more rounds you reload. Blueprints from Cephalon Melica for Entropic Kuva.`,
  },
};
/* Excalibur Umbra (21/10/2026) : ce qui diffère d'Excalibur. Wiki officiel lu le 21/10/2026
   (Excalibur/Umbra, Exalted Blade) ; projet : voidrelay/contenu/FAQ_EXCALIBUR_2026-10-21.md. */
SLUG_NOTES["excalibur-umbra"] = {
  fr: `Excalibur Umbra garde les pouvoirs d'Excalibur sauf le 2 : <b>Hurlement Radial</b> (Radial Howl) aveugle ou étourdit comme l'Aveuglement Radial, et retire en plus les résistances des Sentients et du Shadow Stalker. Sa Lame Exaltée Umbra a les mêmes stats que la Lame Exaltée, donc le build est le même. Il a 3 emplacements de polarité Umbra (plus 1 Madurai) et arrive avec 3 mods Umbraux (Intensité, Fibre, Vitalité). Son passif ajoute la Sentience : il continue à se battre seul quand tu passes en Opérateur. Au rang 30 : 315 d'armure et 225 d'énergie (Excalibur : 240 et 150). Il s'obtient par la quête The Sacrifice, un seul par compte.`,
  en: `Excalibur Umbra keeps Excalibur's abilities except the 2: <b>Radial Howl</b> blinds or staggers like Radial Blind, and also strips the resistances of Sentients and the Shadow Stalker. Its Exalted Umbra Blade has the same stats as Exalted Blade, so the build is the same. It has 3 Umbra polarity slots (plus 1 Madurai) and comes with 3 Umbral mods (Intensify, Fiber, Vitality). Its passive adds Sentience: it keeps fighting on its own while you play as the Operator. At rank 30: 315 armor and 225 energy (Excalibur: 240 and 150). It comes from The Sacrifice quest, one per account.`,
};
Object.assign(SLUG_NOTES, SLUG_NOTES_SUITE);
Object.assign(SLUG_NOTES, SLUG_NOTES_MAJ44);
const slugNote = (slug, lang) => SLUG_NOTES[slug]?.[lang]
  ? `<p class="modnote" style="font-size:.9rem;border-left:3px solid var(--gold-2);padding-left:10px;margin:14px 0 0">💡 ${SLUG_NOTES[slug][lang]}</p>`
  : "";

const COMP_RULES = {
  "Bête": {
    deb:  { mods: ["Link Vitality", "Link Fiber", "Animal Instinct", "Fetch", "Pack Leader"], claws: ["Maul", "Bite"], cost: "0–1 forma",
            note: "Link Health/Armor (héritent de TES stats), Fetch (aimant à loot) et Pack Leader (soin via ta mêlée) : le kit de survie de toute bête." },
    mid:  { mods: ["Link Vitality", "Link Fiber", "Animal Instinct", "Fetch", "Pack Leader", "Hunter Recovery"], claws: ["Maul", "Bite"], cost: "1–2 formas",
            note: "Hunter Recovery (chasses Ostrons) soigne ton compagnon quand TU fais des dégâts. Depuis la 37.0, Bite et Maul se posent sur les griffes (l'arme de la bête), plus dans ses mods." },
    exp:  { mods: ["Link Vitality", "Link Fiber", "Primed Animal Instinct", "Fetch", "Momentous Bond", "Tenacious Bond", "Duplex Bond", "Hunter Recovery"], cost: "2–3 formas",
            note: "Les mods Bond (Duviri/Cavia) transforment le compagnon en vrai coéquipier ; Primed Animal Instinct chez Baro. Depuis la refonte, les compagnons ne meurent plus définitivement." },
  },
  "Sentinelle": {
    deb:  { mods: ["Enhanced Vitality", "Metal Fiber", "Animal Instinct", "Vacuum", "Regen", "Assault Mode", "Guardian", "Sanctuary"], cost: "0–1 forma",
            note: "Vacuum (aimant à loot), Regen (récupération plus courte) et la survie de base. Guardian recharge TES boucliers." },
    mid:  { mods: ["Enhanced Vitality", "Metal Fiber", "Animal Instinct", "Vacuum", "Primed Regen", "Guardian", "Synth Deconstruct", "Synth Fiber"], cost: "1–2 formas",
            note: "Primed Regen (Baro) : −35 s de récupération au lieu de −20 s. Le set Synth (Simaris) fait tomber des orbes de santé — combo avec Equilibrium sur ta frame." },
    exp:  { mods: ["Enhanced Vitality", "Metal Fiber", "Primed Animal Instinct", "Vacuum", "Primed Regen", "Momentous Bond", "Manifold Bond", "Guardian"], cost: "2–3 formas",
            note: "Les mods Bond marchent aussi sur les sentinelles ; Manifold Bond fait appliquer aux précepts les statuts de l'arme de la sentinelle. Pense à moder l'ARME de la sentinelle séparément (Serration/Hornet Strike y passent)." },
  },
};

/* ---------- fragments d'Archonte (5 emplacements, bulle Expert des frames) ---------- */
/* Vérifié sur wiki.warframe.com/w/Archon_Shard le 21/10/2026 (noms FR : fr.wiki Helminth et
   Update_35). Avant : « Cramoisi » (le nom FR est Écarlate), « Azur — Recharge de bouclier »
   (n'existe pas : l'Azur régénère la SANTÉ), « Violet — dégâts électriques → gain d'énergie »
   (n'existe pas). Chaque éclat donne UN bonus au choix ; valeurs normal (tauforgé = ×1,5).
   Aucun bouclier ici : Inaros, Kullervo, Nidus n'en ont pas. eclatsInvalides() contrôle tout. */
const ECLAT_FR = {
  force: "🔴 Écarlate — Puissance de pouvoir +10 % (+15 % tauforgé)",
  duree: "🔴 Écarlate — Durée de pouvoir +10 % (+15 % tauforgé)",
  incant: "🟡 Ambre — Vitesse d'incantation +25 % (+37,5 % tauforgé)",
  parkour: "🟡 Ambre — Vélocité de parkour +15 % (+22,5 % tauforgé)",
  orbesSante: "🟡 Ambre — Efficacité des orbes de santé +100 % (+150 % tauforgé)",
  apparition: "🟡 Ambre — Énergie max remplie à l'apparition +30 % (+45 % tauforgé)",
  energie: "🔵 Azur — Énergie max +50 (+75 tauforgé)",
  armure: "🔵 Azur — Armure +150 (+225 tauforgé)",
  sante: "🔵 Azur — Santé +150 (+225 tauforgé)",
};
function shardPlan(f) {
  const caster = (f.e || 0) >= 150, tank = (f.ar || 0) >= 250, fast = (f.spd || 1) >= 1.15;
  const E = ECLAT_FR;
  if (caster) return {
    profil: "Lanceur de capacités",
    slots: [E.force, E.force, E.incant, E.energie, E.armure],
    alt: "Variante : un 🟣 Violet à la place d'un Azur si tes pouvoirs ou ton arme posent déjà le statut Électrique : +10 % (+15 % tauforgé) de dégâts de pouvoir sur ces ennemis. Ne compte que si le statut est posé avant le pouvoir ; sans effet sur les armes exaltées.",
  };
  if (tank) return {
    profil: "Tank / mêlée au contact",
    slots: [E.armure, E.sante, E.duree, E.orbesSante, E.force],
    alt: "Variante : un 🟢 Émeraude si tu joues Corrosif : +10 % (+15 % tauforgé) de dégâts de pouvoir sur les ennemis sous statut Corrosif, ou +2 (+3) cumuls de Corrosif au maximum.",
  };
  if (fast) return {
    profil: "Mobile / escarmouche",
    slots: [E.parkour, E.force, E.sante, E.armure, E.duree],
    alt: "Variante : un 2e Ambre (Vitesse d'incantation) à la place de l'Armure, pour enchaîner les pouvoirs plus vite.",
  };
  return {
    profil: "Polyvalent",
    slots: [E.force, E.sante, E.armure, E.apparition, E.duree],
    alt: "Un fragment tauforgé donne 1,5 fois le bonus normal : garde-les pour ta frame principale.",
  };
}

/* ---------- rendu ---------- */
/* Pages FR (21/10/2026) : nom français officiel du catalogue WFCD en titre de carte, nom
   anglais en petit dessous — le joueur francophone lit sa langue et garde le nom à taper sur
   warframe.market. Sans traduction (lib_noms_fr), la carte reste en anglais, rien n'est inventé.
   Les règles, SIM_MAP et les pages EN continuent de parler en anglais : seul l'affichage change. */
function modCard(name) {
  const m = MODS[name];
  const fr = nomFr(name);
  const libelle = fr ? `${fr} (${name})` : name; // infobulle + alt : les deux noms
  const fx = EFFECTS[name] ? `<span class="fx">${esc(EFFECTS[name])}</span>` : "";
  if (m) {
    return `<div class="modc" title="${esc(libelle)}"><img loading="lazy" src="${vignette(`/assets/wfimg/${m.img}`)}" alt="${esc(libelle)}" width="120" height="120"><span class="pol">${POL[m.pol]}</span><span class="rk">${m.rk}</span><span class="nm">${nomBilingue(name)}</span>${fx}</div>`;
  }
  return `<div class="modc modc-txt" title="${esc(libelle)}"><span class="pol">${POL.V}</span><span class="nm">${nomBilingue(name)}</span>${fx}</div>`;
}

/* Griffes des Bêtes (37.0) : Maul et Bite sont des mods de cette arme, pas du compagnon
   (wiki.warframe.com/w/Maul et /w/Bite, lus le 21/10/2026). */
const clawBlock = (claws, titre, carte) => claws && claws.length
  ? `<h4 class="btier-sub">${titre}</h4><div class="modg" style="margin:6px 0">${claws.map(carte).join("")}</div>` : "";
/* Les Hounds et les MOA sont rangés en « Bête » mais sont robotiques : pas de griffes.
   Savagery est le précepte du seul Sunika Kubrow (wiki.warframe.com/w/Savagery). */
const aDesGriffes = c => c.k === "Bête" && !/\b(Hound|Moa)\b/.test(c.n);
function reglesComp(c) {
  const R = COMP_RULES[c.k] || COMP_RULES["Bête"];
  if (c.k !== "Bête") return R;
  const g = aDesGriffes(c), t = p => ({ ...p, claws: g ? p.claws : undefined });
  return { deb: { ...t(R.deb), mods: c.n === "Sunika Kubrow" ? [...R.deb.mods, "Savagery"] : R.deb.mods }, mid: t(R.mid), exp: t(R.exp) };
}
function bulle(tier, opts) {
  const { aura, exilus, mods, note, cost, arcanes, shards, sim, claws } = opts;
  const simHtml = sim
    ? `<p style="margin:10px 0 0"><a class="simbtn" href="/arsenal?sim=${encodeURIComponent(sim.slug)}&tier=${sim.tier}">⚔ Simuler ce palier dans l'Arsenal →</a></p>` : "";
  const auraHtml = aura ? `<div class="pollabel" style="margin:0 0 6px">Aura</div>${modCard(aura)}` : "";
  const exiHtml = exilus ? `<div class="pollabel" style="margin:10px 0 6px">Exilus</div>${modCard(exilus)}` : "";
  const side = (auraHtml || exiHtml) ? `<div>${auraHtml}${exiHtml}</div>` : "";
  // Arcanes : « Arcane Grâce Arcane Grace (ou Mue Augmentée Molt Augmented) » — l'anglais
  // reste visible (pas en infobulle) parce que c'est lui qu'on tape sur warframe.market.
  const arcHtml = arcanes && arcanes.length
    ? `<h4 class="btier-sub">Arcanes</h4><div class="abilities">${arcanes.map(a => `<div class="modslot"><span class="pol"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="none" stroke="#e2c873" stroke-width="2"/></svg></span><span><b>${franciserProse(esc(a), { visible: true })}</b></span></div>`).join("")}</div>` : "";
  const shHtml = shards
    ? `<h4 class="btier-sub">Fragments d'Archonte — 5 emplacements (profil : ${esc(shards.profil)})</h4><ol class="shardlist">${shards.slots.map(s => `<li>${esc(s)}</li>`).join("")}</ol><p class="modnote">${esc(shards.alt)}</p>` : "";
  // Dans la prose de la note, l'anglais passe en infobulle (title) pour ne pas alourdir la phrase.
  return `<section class="panel btier"><h3>${tier.t}</h3><p class="btier-cost">${esc(tier.cost || cost)}</p>${side ? `<div class="bcols" style="grid-template-columns:1fr 3fr;align-items:start;margin:10px 0 6px">${side}<div><div class="pollabel" style="margin-bottom:6px">Mods principaux</div><div class="modg">${mods.map(modCard).join("")}</div></div></div>` : `<div class="modg" style="margin:10px 0 6px">${mods.map(modCard).join("")}</div>`}<p class="bodytext btier-note">${franciserProse(note)}</p>${clawBlock(claws, "Griffes (arme de la bête, depuis la 37.0)", modCard)}${arcHtml}${shHtml}${simHtml}</section>`;
}

const EXTRA_CSS = `<style>
.simbtn{display:inline-block;font:600 .85rem/1 "Oswald",sans-serif;letter-spacing:.08em;text-transform:uppercase;
  color:var(--gold-2);border:1px solid var(--line-2);padding:8px 14px;border-radius:10px;text-decoration:none}
.simbtn:hover{border-color:var(--gold);background:var(--gold-soft)}
.btier{margin:14px 0}
.btier h3{margin-bottom:2px}
.btier-cost{font:600 .8rem/1.4 "Oswald",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-2);margin:0 0 8px}
.btier-sub{margin:14px 0 6px;color:var(--muted);font-size:.95rem}
.btier-note{margin-top:10px}
.modg{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px}
/* Cartes de mods AVEC ligne d'effet : pandaahh (.modc) impose aspect-ratio 1/1 + nom en overlay
   + overflow:hidden — l'effet serait coupé. Dans les bulles (.btier), la carte devient
   image carrée + bloc texte DESSOUS (nom + effet), fond sombre fixe = lisible dans les 2 thèmes. */
.btier .modc{aspect-ratio:auto;display:flex;flex-direction:column;background:#0b1322}
.btier .modc img{width:100%;height:auto;aspect-ratio:1/1;object-fit:cover}
.btier .modc .nm{position:static;padding:7px 8px 2px;background:none;font:600 .78rem/1.25 Inter,sans-serif;color:#eef3fb}
.btier .modc .fx{display:block;padding:0 8px 8px;font:500 .7rem/1.3 Inter,sans-serif;color:#9fb1cb}
.btier .modc-txt{min-height:132px;justify-content:flex-end}
.btier .modc-txt .pol{position:absolute;top:6px;left:6px;width:22px;height:22px;background:rgba(6,10,20,.7);border-radius:7px;display:grid;place-items:center}
.modslot{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:7px 13px;margin:0 8px 8px 0;background:var(--surface-2)}
.modslot .pol{width:16px;height:16px;display:inline-grid;place-items:center}
.shardlist{margin:6px 0 8px;padding-left:22px}
.shardlist li{padding:3px 0;color:var(--ink)}
.bstats{width:100%;border-collapse:collapse;font-size:.92rem}
.bstats td{padding:6px 8px;border-top:1px solid var(--line)}
.bstats td:last-child{text-align:right;font-weight:700}
.tierjump{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.tierjump a{border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-weight:600;font-size:.88rem;color:var(--ink);text-decoration:none;background:var(--surface)}
.tierjump a:hover{border-color:var(--gold-2);color:var(--gold-2)}
.bhero-img{position:absolute;right:22px;top:50%;transform:translateY(-50%);width:132px;height:132px;object-fit:contain;filter:drop-shadow(0 6px 18px rgba(0,0,0,.45));pointer-events:none}
@media (max-width:700px){.bhero-img{width:84px;height:84px;right:10px;opacity:.5}}
</style>`;

// hreflang réciproque FR ↔ EN (x-default = FR, comme /o/ ↔ /en/o/).
function hreflangPair(frPath, enPath) {
  return `<link rel="alternate" hreflang="fr" href="${SITE}${frPath}"><link rel="alternate" hreflang="en" href="${SITE}${enPath}"><link rel="alternate" hreflang="x-default" href="${SITE}${frPath}">`;
}

// image du héros (rendu self-hosté) — champ i des data, couverture vérifiée 100 % (117+593+39).
function heroImg(dir, i) {
  return (i && fs.existsSync(path.join(ROOT, "assets", dir, i))) ? `/assets/${dir}/${i}` : null;
}
// Vignette WebP 264 px du portrait (scripts/generer_vignettes.py) : affiché en 132 px, le PNG
// de 512 px pesait ~80 Ko par page. Le PNG reste l'og:image ; sans vignette, on retombe dessus.
// Même traitement pour les cartes de mods (assets/wfimg, 120 px affichés → vignette 240 px).
function vignette(img) {
  if (!img) return img;
  const v = img.replace(/^\/assets\/([a-z]+)\/([^/]+)\.(png|jpe?g)$/, "/assets/$1/v/$2.webp");
  return v !== img && fs.existsSync(path.join(ROOT, v.slice(1))) ? v : img;
}

/* Pages FR seulement (les pages EN restent octet pour octet identiques) : nom anglais en petit
   sous le nom français des cartes, et pointillé sous les noms francisés de la prose (infobulle). */
const CSS_NOMS_FR = `<style>
.btier .modc .nm .en{display:block;margin-top:2px;font:400 .66rem/1.2 Inter,sans-serif;color:#8294ab;text-transform:none;letter-spacing:0}
.modslot .nmfr .en{font-weight:400;font-size:.8em;color:var(--muted);margin-left:.15em}
.btier-note .nmfr,.modnote .nmfr,.bodytext .nmfr{border-bottom:1px dotted currentColor;cursor:help;text-decoration:none}
</style>`;
function head(title, desc, canonical, lang = "fr", hreflangHtml = "", ogImage = "") {
  return `<!DOCTYPE html><html lang="${lang}"><head><script>(function(){try{var t=localStorage.getItem("vr-theme")||"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}})();</script>
${MARKER}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://warframe.market; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.warframestat.us https://cloudflareinsights.com https://voidrelay-prix.vercel.app https://api.allorigins.win https://api.codetabs.com https://api.warframe.market; form-action 'self'; frame-src 'none'; upgrade-insecure-requests">
<meta http-equiv="X-Content-Type-Options" content="nosniff"><meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">${hreflangHtml}<meta name="robots" content="index, follow, max-image-preview:large"><meta name="author" content="VoidRelay"><meta name="theme-color" content="#0a0f1c">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230e1729'/%3E%3Cpath d='M14 18 L32 48 L50 18' fill='none' stroke='%23d4af37' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"><link rel="stylesheet" href="/css/pandaahh.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta property="og:type" content="article"><meta property="og:site_name" content="VoidRelay"><meta property="og:locale" content="${lang === "en" ? "en_US" : "fr_FR"}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canonical}">
${ogImage ? `<meta property="og:image" content="${SITE}${ogImage}"><meta name="twitter:card" content="summary"><meta name="twitter:image" content="${SITE}${ogImage}">` : ""}<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: title, description: desc, url: canonical, author: { "@type": "Organization", name: "VoidRelay" }, publisher: { "@id": SITE + "/#org" }, inLanguage: lang, ...(ogImage ? { image: SITE + ogImage } : {}) })}</script>
<!-- display=optional (PAS swap) : anti-CLS mesuré 10/07/2026 — voir builds/mesa.html. -->
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Oswald:wght@400;500;600;700&display=optional" rel="stylesheet">
${EXTRA_CSS}${lang === "fr" ? CSS_NOMS_FR : ""}</head><body>`;
}

const TOPBAR = `<div class="topwrap"><header class="topbar"><a href="/" class="brand"><span class="logo">◆</span> VoidRelay</a><div class="search"><span>🔎</span><input type="search" id="vr-search" class="vr-search-input" placeholder="Rechercher un objet, un build…" aria-label="Rechercher un objet Warframe" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="vr-search-results" aria-autocomplete="list"><kbd>K</kbd><div class="vr-search-results" id="vr-search-results" role="listbox" aria-label="Résultats de recherche" hidden></div></div><nav class="topnav"><div class="topnav-search"><input type="search" id="vr-search-m" class="vr-search-input" placeholder="Rechercher un objet…" aria-label="Rechercher un objet Warframe" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="vr-search-results-m" aria-autocomplete="list"><div class="vr-search-results" id="vr-search-results-m" role="listbox" aria-label="Résultats de recherche" hidden></div></div><a href="/">Accueil</a><a href="/voie-du-platine/">La Voie du Platine</a><a href="/builds/" class="cur">Builds</a><a href="/warframes/">Warframes</a><a href="/armes/">Armes</a><a href="/compagnons/">Compagnons</a><a href="/ressources/">Ressources</a><a href="/arcanes/">Arcanes</a><a href="/guides/">Guides</a><a href="/skins/">Skins</a><a href="/o/">Objets</a><a href="/hub">Tableau de bord</a><a href="/outils">Outils</a><a href="/faq">FAQ</a></nav><button class="navburger" id="navburger" type="button" aria-label="Menu" aria-expanded="false">&#9776;</button>
<button class="themebtn" id="themebtn" type="button" aria-label="Basculer le thème" title="Thème sombre / clair">☾</button><a href="/outils" class="avatar" title="Outils Warframe" aria-label="Outils Warframe">◈</a></header></div>`;

const FOOTER = `<footer class="foot"><div class="in"><div><span class="brand" style="color:#fff"><span class="logo">◆</span> VoidRelay</span><div style="font-size:.85rem;margin-top:6px">Hub Warframe non officiel — fan-made, gratuit.</div></div><div class="links" style="font-size:.9rem"><a href="/voie-du-platine/">La Voie</a><a href="/builds/">Builds</a><a href="/guides/">Guides</a><a href="/skins/">Skins</a><a href="/o/">Objets</a><a href="/hub">Tableau de bord</a><a href="/faq">FAQ</a><a href="/a-propos">À propos</a><a href="mailto:contact@voidrelay.fr">Feedback</a></div></div><div class="in" style="padding-top:0;font-size:.8rem;color:#8294ab">« Warframe » est une marque de Digital Extremes. Images des mods via le projet communautaire warframe-items. Prix : warframe.market. · <a href="/confidentialite">Confidentialité</a> · <a href="/mentions-legales">Mentions légales</a></div></footer>
<script defer src="/js/nav-toggle.js"></script>
<script defer src="/js/search.js"></script><script defer src="/js/warp.js"></script>
</body></html>`;

const TIERJUMP = `<div class="tierjump"><a href="#debutant">🌱 Débutant</a><a href="#intermediaire">⚙️ Intermédiaire</a><a href="#expert">🔥 Expert</a></div>`;
const DISCLAIMER = `<p class="modnote" style="margin-top:14px">⚠️ Builds « evergreen » générés par archétype — le méta évolue. Ajuste selon les mods, arcanes et fragments que tu possèdes. Les 3 paliers utilisent uniquement des mods réels du jeu.</p>`;

function anchorize(html) {
  return html
    .replace('<section class="panel btier"><h3>🌱', '<section class="panel btier" id="debutant"><h3>🌱')
    .replace('<section class="panel btier"><h3>⚙️', '<section class="panel btier" id="intermediaire"><h3>⚙️')
    .replace('<section class="panel btier"><h3>🔥', '<section class="panel btier" id="expert"><h3>🔥');
}

/* Builds FR PROPRES aux variantes Prime (21/10/2026). mesa-prime et excalibur-prime
   tombaient sur le gabarit générique alors que leurs pages EN reprennent le build vérifié
   (BUILDS_SPECIFIQUES_EN). Pouvoirs et arme exaltée identiques à Mesa / Excalibur (Regulators
   Prime = mêmes stats que Regulators, wiki 21/10/2026) : le texte vient MOT POUR MOT de la page
   FR faite main de la base, lue à la génération (de « Configuration des mods » aux conseils et à
   la fiche) — rien n'est recopié ici, donc rien ne peut diverger. En-tête, stats et image restent
   ceux de la Prime. Excalibur Umbra n'y figure pas : pouvoirs et polarités différents. */
const BUILDS_SPECIFIQUES_FR = {
  "mesa-prime": { base: "mesa", nom: "Mesa", que: "que Mesa", titre: "Build Mesa Prime (Peacemaker) : débutant à Steel Path | VoidRelay",
    polAura: "V", slots: ["BAR", "BAR", "D", "V"],
    desc: "Build Mesa Prime pour le Peacemaker : mods, Valse de Mesa, arcanes, mods recommandés pour les Regulators, fragments d'Archon et Helminth. Valeurs vérifiées sur le wiki officiel." },
  "excalibur-prime": { base: "excalibur", nom: "Excalibur", que: "qu'Excalibur", titre: "Build Excalibur Prime (Lame Exaltée) : débutant à Steel Path | VoidRelay",
    polAura: "V", slots: ["D", "V", "V"],
    desc: "Build Excalibur Prime pour la Lame Exaltée : mods, arcanes, mods recommandés pour la Lame Exaltée, fragments d'Archon et Helminth. Valeurs vérifiées sur le wiki officiel." },
  /* Umbra (21/10/2026) : pouvoir 2 différent (Hurlement Radial), mais Lame Exaltée Umbra = mêmes
     stats que la Lame Exaltée (wiki Excalibur/Umbra) → même build ; la différence est dite dans
     SLUG_NOTES["excalibur-umbra"]. Polarités wiki : aura Madurai, Madurai + 3 Umbra. */
  "excalibur-umbra": { base: "excalibur", nom: "Excalibur", que: "qu'Excalibur, sauf le 2 (voir ci-dessus)", titre: "Build Excalibur Umbra (Lame Exaltée) : débutant à Steel Path | VoidRelay",
    polAura: "V", slots: ["V", "U", "U", "U"],
    desc: "Build Excalibur Umbra pour la Lame Exaltée Umbra : Hurlement Radial, emplacements Umbra, mods, arcanes, fragments d'Archon. Valeurs vérifiées sur le wiki officiel." },
};
/* Polarités des Prime (wiki officiel, 21/10/2026) : la rangée « Emplacements d'origine » du bloc
   de base est celle de la frame de BASE, fausse pour une Prime (Mesa : Naramon ×2 ; Mesa Prime :
   Naramon ×2 + Vazarin + Madurai ; Excalibur Prime : Vazarin + Madurai ×2). Elle est la seule
   partie du bloc reconstruite ; même HTML que la page faite main, Exilus « aucun ». */
function rangeePolarites({ polAura, slots }) {
  const slot = k => `<span class="polslot">${POL[k]}</span>`;
  return `<div class="polrow"><div class="polgrp"><span class="pollabel">Aura</span><span class="polslot aura">${POL[polAura]}</span></div><div class="polgrp"><span class="pollabel">Exilus</span><span class="polslot"><span style="color:var(--muted);font-size:.85rem">aucun</span></span></div><div class="polgrp"><span class="pollabel">Emplacements d'origine</span>${slots.map(slot).join("")}</div></div>`;
}
function blocBuildVerifieFR(base, pol) {
  const h = fs.readFileSync(path.join(OUT, base + ".html"), "utf8");
  if (h.includes(MARKER)) throw new Error(`builds/${base}.html est généré : la source d'un build vérifié doit être une page faite main`);
  const a = h.indexOf('<div class="loadout">'), b = h.indexOf('<p class="bc"', a);
  if (a < 0 || b < 0) throw new Error(`builds/${base}.html : blocs « loadout » introuvables`);
  const bloc = h.slice(a, b);
  const r0 = bloc.indexOf('<div class="polrow">'), r1 = bloc.indexOf('<div class="bcols"', r0);
  if (r0 < 0 || r1 < 0) throw new Error(`builds/${base}.html : rangée de polarités « polrow » introuvable`);
  return bloc.slice(0, r0) + rangeePolarites(pol) + bloc.slice(r1);
}

/* ---------- pages Warframes ---------- */
function framePage(f) {
  const slug = slugify(f.n);
  const url = `${SITE}/builds/${slug}`;
  const hl = hreflangPair(`/builds/${slug}`, `/en/builds/${slug}`);
  const B = BUILDS_SPECIFIQUES_FR[slug];
  const title = B ? B.titre : `Build ${f.n} Warframe : débutant, intermédiaire, expert | VoidRelay`;
  const desc = B ? B.desc : `Build ${f.n} en 3 paliers : mods pour débuter sans ressources, version intermédiaire, et build expert avec mods Primed/Umbral, arcanes et les 5 fragments d'Archon.`;
  const stats = `<table class="bstats"><tr><td>Santé</td><td>${esc(f.h)}</td></tr><tr><td>Bouclier</td><td>${esc(f.s)}</td></tr><tr><td>Armure</td><td>${esc(f.ar)}</td></tr><tr><td>Énergie</td><td>${esc(f.e)}</td></tr><tr><td>Vitesse</td><td>${esc(f.spd)}</td></tr><tr><td>Maîtrise requise</td><td>MR ${esc(f.mr)}</td></tr></table>`;
  const abils = (f.ab || []).map(a => `<span class="modslot"><b>${esc(a)}</b></span>`).join("");
  const img = heroImg("frames", f.i);
  const shards = shardPlan(f);
  const bulles = anchorize(
    bulle(FRAME_TIERS.deb, { aura: FRAME_TIERS.deb.aura, exilus: FRAME_TIERS.deb.exilus, mods: FRAME_TIERS.deb.mods, note: FRAME_TIERS.deb.note, sim: { slug, tier: "deb" } })
    + bulle(FRAME_TIERS.mid, { aura: FRAME_TIERS.mid.aura, exilus: FRAME_TIERS.mid.exilus, mods: FRAME_TIERS.mid.mods, note: FRAME_TIERS.mid.note, arcanes: ["Arcane Guardian", "Arcane Nullifier"], sim: { slug, tier: "mid" } })
    + bulle(FRAME_TIERS.exp, { aura: FRAME_TIERS.exp.aura, exilus: FRAME_TIERS.exp.exilus, mods: FRAME_TIERS.exp.mods, note: FRAME_TIERS.exp.note, arcanes: ["Arcane Energize", "Arcane Grace (ou Molt Augmented)"], shards, sim: { slug, tier: "exp" } })
  );
  simEnregistre(slug, "frame", f.n, FRAME_TIERS);
  return head(title, desc, url, "fr", hl, img) + TOPBAR + `<main class="wrap">
<nav class="bc"><a href="/">Accueil</a> › <a href="/builds/">Builds</a> › <span>${esc(f.n)}</span></nav>
<div class="bhero">${img ? `<img class="bhero-img" src="${vignette(img)}" alt="${esc(f.n)}" width="132" height="132" loading="eager">` : ""}<h1 class="nm">Build ${esc(f.n)}</h1><span class="btag">◈ Warframe${f.prime ? " Prime" : ""} · MR ${esc(f.mr)}</span><p class="role">${esc(f.desc || "")}</p></div>
<div class="bcols"><div class="panel"><h3>Statistiques de base</h3>${stats}</div><div class="panel"><h3>Compétences</h3><div class="abilities" style="margin-bottom:8px">${abils}</div>${lignePassif("Passif :", PASSIF_FR.get(f.n))}</div></div>
${franciserProse(slugNote(slug, "fr"))}${B ? `<p class="modnote" style="margin:14px 0">Mêmes pouvoirs ${B.que} : le build est identique. <a href="/builds/${B.base}">Voir le build ${B.nom}</a>.</p>${blocBuildVerifieFR(B.base, B)}` : `<h2 style="margin:18px 0 4px">Les 3 builds</h2>${TIERJUMP}${bulles}${DISCLAIMER}`}
<p class="bc" style="margin-top:14px"><a href="/builds/">← Tous les builds</a> · <a href="/warframes/">Fiche ${esc(f.n)}</a> · ${marketLink(f.n)?`<a href="${marketLink(f.n)}">💰 Prix du set ${esc(f.n)}</a>`:`<a href="/o/">Prix des objets</a>`}</p>${guidesLinkLine(f.n, "fr")}
</main>` + FOOTER;
}

/* ---------- pages Armes ---------- */
function weaponPage(w) {
  const slug = slugify(w.n);
  const url = `${SITE}/builds/${slug}`;
  const hl = hreflangPair(`/builds/${slug}`, `/en/builds/${slug}`);
  const fam = WEAPON_RULES[w.t] ? w.t : (TYPE_ALIAS[w.t] || null);
  if (!fam) return null;
  const R = WEAPON_RULES[fam];
  simEnregistre(slug, "arme", w.n, R);
  const catFr = { Primary: "Arme principale", Secondary: "Arme secondaire", Melee: "Mêlée" }[w.c] || w.c;
  const title = `Build ${w.n} Warframe : débutant, intermédiaire, expert | VoidRelay`;
  const desc = `Build ${w.n} (${R.label}) en 3 paliers : mods accessibles pour débuter, palier intermédiaire, et build expert (Galvanized/Primed + arcane d'arme).`;
  const typeNote = TYPE_NOTE[w.t] ? `<p class="modnote">${franciserProse(esc(TYPE_NOTE[w.t]))}</p>` : "";
  const riven = (typeof w.d === "number" && w.d > 0) ? `<tr><td>Disposition Riven</td><td>${"●".repeat(Math.max(1, Math.min(5, w.d)))}${"○".repeat(5 - Math.max(1, Math.min(5, w.d)))}</td></tr>` : "";
  const img = heroImg("weapons", w.i);
  const stats = `<table class="bstats"><tr><td>Catégorie</td><td>${esc(catFr)}</td></tr><tr><td>Type</td><td>${esc(w.t)}</td></tr><tr><td>Maîtrise requise</td><td>MR ${esc(w.mr)}</td></tr>${riven}</table>`;
  const bulles = anchorize(
    bulle({ t: "🌱 Débutant", cost: R.deb.cost + " · mods des premières planètes" }, { mods: R.deb.mods, note: R.deb.note, sim: { slug, tier: "deb" } })
    + bulle({ t: "⚙️ Intermédiaire", cost: R.mid.cost + " · 60/60 syndicats, mods rares courants" }, { mods: R.mid.mods, note: R.mid.note, sim: { slug, tier: "mid" } })
    + bulle({ t: "🔥 Expert", cost: R.exp.cost + " · Galvanized (Arbitrages), Primed (Baro), Riven" }, { mods: R.exp.mods, note: R.exp.note, arcanes: R.arcExp ? [R.arcExp] : undefined, sim: { slug, tier: "exp" } })
  );
  return head(title, desc, url, "fr", hl, img) + TOPBAR + `<main class="wrap">
<nav class="bc"><a href="/">Accueil</a> › <a href="/builds/">Builds</a> › <span>${esc(w.n)}</span></nav>
<div class="bhero">${img ? `<img class="bhero-img" src="${vignette(img)}" alt="${esc(w.n)}" width="132" height="132" loading="eager">` : ""}<h1 class="nm">Build ${esc(w.n)}</h1><span class="btag">⚔ ${esc(R.label)} · MR ${esc(w.mr)}</span><p class="role">${esc(catFr)} — 3 paliers de mods, du premier forma au build de fou.</p></div>
<div class="panel" style="margin:14px 0"><h3>Fiche</h3>${stats}${typeNote}</div>
${franciserProse(slugNote(slug, "fr"))}<h2 style="margin:18px 0 4px">Les 3 builds</h2>${TIERJUMP}${bulles}${DISCLAIMER}
<p class="bc" style="margin-top:14px"><a href="/builds/">← Tous les builds</a> · <a href="/armes/">Fiche ${esc(w.n)}</a> · ${marketLink(w.n)?`<a href="${marketLink(w.n)}">💰 Prix du set ${esc(w.n)}</a>`:`<a href="/o/">Prix des objets</a>`}</p>${guidesLinkLine(w.n, "fr")}
</main>` + FOOTER;
}

/* ---------- pages Compagnons ---------- */
function compPage(c) {
  const slug = slugify(c.n);
  const url = `${SITE}/builds/${slug}`;
  const hl = hreflangPair(`/builds/${slug}`, `/en/builds/${slug}`);
  const R = reglesComp(c);
  const title = `Build ${c.n} (compagnon) Warframe : débutant à expert | VoidRelay`;
  const desc = `Build ${c.n} (${c.k}) en 3 paliers : survie et utilitaires accessibles, puis mods Bond et Primed pour un compagnon expert.`;
  const img = heroImg("companions", c.i);
  const stats = `<table class="bstats"><tr><td>Type</td><td>${esc(c.k)}${c.prime ? " · Prime" : ""}</td></tr>${c.h ? `<tr><td>Santé</td><td>${esc(c.h)}</td></tr>` : ""}${c.ar ? `<tr><td>Armure</td><td>${esc(c.ar)}</td></tr>` : ""}<tr><td>Maîtrise requise</td><td>MR ${esc(c.mr || 0)}</td></tr></table>`;
  const bulles = anchorize(
    bulle({ t: "🌱 Débutant", cost: R.deb.cost + " · mods de drops courants" }, { mods: R.deb.mods, claws: R.deb.claws, note: R.deb.note })
    + bulle({ t: "⚙️ Intermédiaire", cost: R.mid.cost }, { mods: R.mid.mods, claws: R.mid.claws, note: R.mid.note })
    + bulle({ t: "🔥 Expert", cost: R.exp.cost + " · mods Bond (Cavia) + Primed (Baro)" }, { mods: R.exp.mods, claws: R.exp.claws, note: R.exp.note })
  );
  return head(title, desc, url, "fr", hl, img) + TOPBAR + `<main class="wrap">
<nav class="bc"><a href="/">Accueil</a> › <a href="/builds/">Builds</a> › <span>${esc(c.n)}</span></nav>
<div class="bhero">${img ? `<img class="bhero-img" src="${vignette(img)}" alt="${esc(c.n)}" width="132" height="132" loading="eager">` : ""}<h1 class="nm">Build ${esc(c.n)}</h1><span class="btag">🐾 Compagnon · ${esc(c.k)}</span><p class="role">${esc(c.desc || "")}</p></div>
<div class="panel" style="margin:14px 0"><h3>Fiche</h3>${stats}</div>
${franciserProse(slugNote(slug, "fr"))}<h2 style="margin:18px 0 4px">Les 3 builds</h2>${TIERJUMP}${bulles}${DISCLAIMER}
<p class="bc" style="margin-top:14px"><a href="/builds/">← Tous les builds</a> · <a href="/compagnons/">Fiche ${esc(c.n)}</a> · ${marketLink(c.n)?`<a href="${marketLink(c.n)}">💰 Prix de ${esc(c.n)}</a>`:`<a href="/o/">Prix des objets</a>`}</p>${guidesLinkLine(c.n, "fr")}
</main>` + FOOTER;
}

/* ---------- index ---------- */
function indexPage(entries, manualSlugs) {
  const title = "Builds Warframe : toutes les Warframes, armes et compagnons | VoidRelay";
  const desc = `${entries.length} builds en 3 paliers (débutant, intermédiaire, expert) : ${wfs.length} Warframes, ${entries.filter(e => e.cat === "weapon").length} armes et ${comps.length} compagnons. Mods réels, arcanes et fragments d'Archon.`;
  const star = manualSlugs.map(s => {
    const e = entries.find(x => x.slug === s);
    return `<a class="modslot" href="/builds/${s}"><b>★ ${esc(e ? e.n : s)}</b></a>`;
  }).join("");
  const groups = [
    ["frame", "◈ Warframes", entries.filter(e => e.cat === "frame")],
    ["primary", "🔫 Armes principales", entries.filter(e => e.cat === "weapon" && e.c === "Primary")],
    ["secondary", "🔫 Armes secondaires", entries.filter(e => e.cat === "weapon" && e.c === "Secondary")],
    ["melee", "⚔ Mêlée", entries.filter(e => e.cat === "weapon" && e.c === "Melee")],
    ["arch", "🛰 Archwing", entries.filter(e => e.cat === "weapon" && /^Arch/.test(e.t || ""))],
    ["comp", "🐾 Compagnons", entries.filter(e => e.cat === "comp")],
  ].filter(g => g[2].length);
  const sections = groups.map(([id, label, list]) => `<h2 id="${id}" style="margin:22px 0 8px">${label} <span style="color:var(--muted);font-size:.8em">(${list.length})</span></h2>
<div class="modg" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${list.map(e =>
    `<a class="modslot bx" data-n="${esc(e.n.toLowerCase())}" href="/builds/${e.slug}" style="justify-content:space-between"><span>${manualSlugs.includes(e.slug) ? "★ " : ""}${esc(e.n)}</span><span style="color:var(--muted);font-size:.75rem;flex:none">MR ${esc(e.mr || 0)}</span></a>`).join("")}</div>`).join("");
  return head(title, desc, `${SITE}/builds/`, "fr", hreflangPair("/builds/", "/en/builds/"), "/assets/og.png") + TOPBAR + `<main class="wrap">
<nav class="bc"><a href="/">Accueil</a> › <span>Builds</span></nav>
<div class="bhero"><h1 class="nm">Builds Warframe</h1><span class="btag">${entries.length} fiches · 3 paliers chacune</span><p class="role">Chaque build existe en <b>3 versions</b> : 🌱 débutant (presque aucun prérequis), ⚙️ intermédiaire, 🔥 expert (Primed, Galvanized, arcanes — et les 5 fragments d'Archon sur les Warframes). Les fiches ★ sont des builds détaillés à la main.</p></div>
<div class="panel" style="margin:14px 0"><input id="bq" type="search" data-vr-suggest placeholder="Filtrer (ex : Mesa, Soma, Kavat…)" autocomplete="off" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid var(--line);background:var(--bg2);color:var(--ink);font-size:1rem">
<div class="tierjump" style="margin:12px 0 0">${groups.map(([id, label, list]) => `<a href="#${id}">${label.replace(/^[^ ]+ /, "")} (${list.length})</a>`).join("")}</div></div>
${star ? `<h2 style="margin:18px 0 8px">★ Builds détaillés</h2><div>${star}</div>` : ""}
${sections}
<p class="bc" style="margin-top:16px"><a href="/voie-du-platine/">La Voie du Platine</a> · <a href="/o/">Prix des objets</a> · <a href="/hub">Tableau de bord</a></p>
</main>
<script>(function(){var q=document.getElementById("bq");if(!q)return;q.addEventListener("input",function(){var v=q.value.trim().toLowerCase();document.querySelectorAll(".bx").forEach(function(a){a.style.display=(!v||a.dataset.n.indexOf(v)!==-1)?"":"none"})});})();</script>` + FOOTER;
}

/* ============================ SECTION ANGLAISE ============================
   Mêmes builds, textes de scripts/builds_i18n_en.mjs. Fonctions séparées des
   FR (duplication contrôlée ~100 lignes) pour ne prendre AUCUN risque de
   régression sur le rendu français. Sortie : en/builds/<slug>.html.        */
const OUT_EN = path.join(ROOT, "en", "builds");

/* fxPropre : effet propre à une grille (« mods recommandés »), sans toucher EFFECTS_EN, partagé par
   toutes les pages. Séparé en 2 fonctions : modCardEN sert aussi de callback à .map(), qui lui
   passerait l'index en 2e argument. */
function modCardEN(name) { return modCardFxEN(name, null); }
function modCardFxEN(name, fxPropre) {
  const m = MODS[name];
  const fx = fxPropre ? `<span class="fx">${esc(fxPropre)}</span>` : EFFECTS_EN[name] ? `<span class="fx">${esc(EFFECTS_EN[name])}</span>` : "";
  if (m) {
    return `<div class="modc" title="${esc(name)}"><img loading="lazy" src="${vignette(`/assets/wfimg/${m.img}`)}" alt="${esc(name)}" width="120" height="120"><span class="pol">${POL[m.pol]}</span><span class="rk">${m.rk}</span><span class="nm">${esc(name)}</span>${fx}</div>`;
  }
  return `<div class="modc modc-txt" title="${esc(name)}"><span class="pol">${POL.V}</span><span class="nm">${esc(name)}</span>${fx}</div>`;
}

function bulleEN(tier, opts) {
  const { aura, exilus, mods, note, cost, arcanes, shards, sim, claws } = opts;
  const simHtml = sim
    ? `<p style="margin:10px 0 0"><a class="simbtn" href="/en/arsenal?sim=${encodeURIComponent(sim.slug)}&tier=${sim.tier}">⚔ Simulate this tier in the Arsenal →</a></p>` : "";
  const auraHtml = aura ? `<div class="pollabel" style="margin:0 0 6px">${UI_EN.aura}</div>${modCardEN(aura)}` : "";
  const exiHtml = exilus ? `<div class="pollabel" style="margin:10px 0 6px">${UI_EN.exilus}</div>${modCardEN(exilus)}` : "";
  const side = (auraHtml || exiHtml) ? `<div>${auraHtml}${exiHtml}</div>` : "";
  const arcHtml = arcanes && arcanes.length
    ? `<h4 class="btier-sub">${UI_EN.arcanes}</h4><div class="abilities">${arcanes.map(a => `<div class="modslot"><span class="pol"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="none" stroke="#e2c873" stroke-width="2"/></svg></span><span><b>${esc(a)}</b></span></div>`).join("")}</div>` : "";
  const shHtml = shards
    ? `<h4 class="btier-sub">${esc(UI_EN.shards(shards.profil))}</h4><ol class="shardlist">${shards.slots.map(s => `<li>${esc(s)}</li>`).join("")}</ol><p class="modnote">${esc(shards.alt)}</p>` : "";
  return `<section class="panel btier"><h3>${tier.t}</h3><p class="btier-cost">${esc(tier.cost || cost)}</p>${side ? `<div class="bcols" style="grid-template-columns:1fr 3fr;align-items:start;margin:10px 0 6px">${side}<div><div class="pollabel" style="margin-bottom:6px">${UI_EN.mainMods}</div><div class="modg">${mods.map(m => modCardEN(m)).join("")}</div></div></div>` : `<div class="modg" style="margin:10px 0 6px">${mods.map(m => modCardEN(m)).join("")}</div>`}<p class="bodytext btier-note">${note}</p>${clawBlock(claws, UI_EN.claws, modCardEN)}${arcHtml}${shHtml}${simHtml}</section>`;
}

const TOPBAR_EN = `<div class="topwrap"><header class="topbar"><a href="/en/" class="brand"><span class="logo">◆</span> VoidRelay</a><div class="search"><span>🔎</span><input type="search" id="vr-search" class="vr-search-input" placeholder="Search an item or build…" aria-label="Search a Warframe item" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="vr-search-results" aria-autocomplete="list"><kbd>K</kbd><div class="vr-search-results" id="vr-search-results" role="listbox" aria-label="Search results" hidden></div></div><nav class="topnav"><div class="topnav-search"><input type="search" id="vr-search-m" class="vr-search-input" placeholder="Search an item…" aria-label="Search a Warframe item" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="vr-search-results-m" aria-autocomplete="list"><div class="vr-search-results" id="vr-search-results-m" role="listbox" aria-label="Search results" hidden></div></div><a href="/en/">Home</a><a href="/en/platinum-path/">Platinum Path</a><a href="/en/builds/" class="cur">Builds</a><a href="/en/o/">Items</a><a href="/en/guides/">Guides</a><a href="/en/tools">Tools</a><a href="/hub">Dashboard</a><a href="/faq-en">FAQ</a><a href="/" hreflang="fr" title="Version française">FR</a></nav><button class="navburger" id="navburger" type="button" aria-label="Menu" aria-expanded="false">&#9776;</button>
<button class="themebtn" id="themebtn" type="button" aria-label="Toggle theme" title="Dark / light theme">☾</button><a href="/outils" class="avatar" title="Warframe tools" aria-label="Warframe tools">◈</a></header></div>`;

const FOOTER_EN = `<footer class="foot"><div class="in"><div><span class="brand" style="color:#fff"><span class="logo">◆</span> VoidRelay</span><div style="font-size:.85rem;margin-top:6px">Unofficial Warframe hub — fan-made, free.</div></div><div class="links" style="font-size:.9rem"><a href="/en/platinum-path/">Platinum Path</a><a href="/en/builds/">Builds</a><a href="/en/o/">Items</a><a href="/en/guides/">Guides</a><a href="/en/tools">Tools</a><a href="/hub">Dashboard</a><a href="/faq-en">FAQ</a><a href="/a-propos">About</a></div></div><div class="in" style="padding-top:0;font-size:.8rem;color:#8294ab">"Warframe" is a trademark of Digital Extremes. Mod images via the community warframe-items project. Prices: warframe.market. · <a href="/confidentialite">Privacy</a> · <a href="/mentions-legales">Legal</a></div></footer>
<script defer src="/js/nav-toggle.js"></script>
<script defer src="/js/search.js"></script><script defer src="/js/warp.js"></script>
</body></html>`;

const TIERJUMP_EN = `<div class="tierjump"><a href="#debutant">🌱 Beginner</a><a href="#intermediaire">⚙️ Intermediate</a><a href="#expert">🔥 Expert</a></div>`;
const DISCLAIMER_EN = `<p class="modnote" style="margin-top:14px">${UI_EN.disclaimer}</p>`;

function shardPlanEN(f) {
  const caster = (f.e || 0) >= 150, tank = (f.ar || 0) >= 250, fast = (f.spd || 1) >= 1.15;
  return caster ? SHARD_EN.caster : tank ? SHARD_EN.tank : fast ? SHARD_EN.fast : SHARD_EN.poly;
}

/* Builds EN PROPRES à une Warframe (20/10/2026). Le gabarit par archétype donnait à Mesa une
   aura de mêlée (Steel Charge) et Archon Stretch (énergie sur dégâts Électricité, qu'elle
   n'inflige pas), sans Mesa's Waltz ni Peacemaker. Ce sont les 2 seules pages qui gardent des
   impressions Google (« mesa build », « excalibur build », position ~30). Valeurs : wiki
   officiel consulté le 20/10/2026 ; méta : warframegodbuilds.com (05/09/2026). Détail et sources :
   Project « voidrelay/contenu/BUILDS_MESA_EXCALIBUR_VERIFIES_2026-10-20.md ».
   Pas de lien « simuler » : l'arsenal simule les paliers génériques, pas ceux-ci. */
const BUILD_MESA = {
  nom: "Mesa",
  title: "Mesa build (Peacemaker): beginner to Steel Path | VoidRelay",
  desc: "Mesa Peacemaker build in 3 tiers: Pistol Amp aura, Mesa's Waltz, Shatter Shield at its 95% cap, arcanes, Archon Shards and Helminth. Values checked on the official wiki.",
  deb: { aura: "Pistol Amp", exilus: "Power Drift",
    mods: ["Intensify", "Continuity", "Streamline", "Flow", "Vitality", "Redirection", "Stretch", "Steel Fiber"],
    note: "Pistol Amp, not Steel Charge: Peacemaker fires the Regulators, which count as a secondary weapon, so a melee aura does nothing for them. Intensify + Power Drift give 145% Ability Strength, above the 119% that caps Shatter Shield at 95% damage reduction." },
  mid: { aura: "Pistol Amp", exilus: "Mesa's Waltz",
    mods: ["Intensify", "Blind Rage", "Transient Fortitude", "Primed Continuity", "Primed Flow", "Adaptation", "Rolling Guard", "Narrow Minded"],
    note: "Mesa's Waltz is an Exilus augment: it lets you move at 50% speed while Peacemaker is active and frees a main slot. Narrow Minded doubles Shatter Shield uptime; Peacemaker's 50 m targeting range does not depend on Ability Range. Rolling Guard (3 s of invulnerability on dodge) is your escape from melee enemies, which Shatter Shield does not stop.",
    arcanes: ["Arcane Energize", "Arcane Velocity"] },
  exp: { aura: "Pistol Amp", exilus: "Mesa's Waltz",
    mods: ["Umbral Intensify", "Blind Rage", "Transient Fortitude", "Primed Continuity", "Primed Flow", "Adaptation", "Rolling Guard", "Narrow Minded"],
    note: "Umbral Intensify (+44%) replaces Intensify (+30%). Subsume Grendel's Nourish over Ballistic Battery for extra energy and Viral damage. Peacemaker costs 25 energy then 15 per second, so keep Arcane Energize. Put Secondary Merciless in the Regulators' arcane slot if you own it (community pick, not confirmed by the wiki).",
    arcanes: ["Arcane Energize", "Arcane Velocity"],
    shards: { profil: "Peacemaker", slots: ["🔴 Crimson — +25% Secondary Critical Chance (applies to the Regulators)", "🔴 Crimson — +25% Secondary Critical Chance", "🔴 Crimson — +25% Secondary Critical Chance", "🔴 Crimson — +25% Secondary Critical Chance", "🟡 Amber — +25% Casting Speed"], alt: "Topaz variant: 3 Topaz instead of 3 Crimson (+1% Secondary Critical Chance per kill on an enemy under Heat status, max 50% each), only if the Regulators carry a Heat mod: without Heat, Topaz gives nothing. No Ability Strength shard: Shatter Shield is already capped and +10% Strength adds at most 4.4% Peacemaker damage (wiki damage formula). Tauforged shards give +50%. Shard values: official wiki, 21 October 2026." } },
  reco: { titre: "Recommended mods for Peacemaker",
    intro: "Peacemaker fires the Regulators (or Regulators Prime, same stats): an Exalted weapon you mod with <b>pistol</b> mods. Ammo is infinite, so magazine and reload mods do nothing; Hydraulic Crosshairs, Sharpened Bullets, Spry Sights, Targeting Subsystem and Hawk Eye do not work (there is no aiming).",
    grille: [["Hornet Strike", "+220% Damage"], ["Primed Pistol Gambit", "+187% Critical Chance"], ["Primed Target Cracker", "+110% Critical Damage"],
      ["Galvanized Diffusion", "+110% Multishot, +30% per kill for 20 s (4 stacks)"], ["Barrel Diffusion", "+120% Multishot"], ["Lethal Torrent", "+60% Fire Rate, +60% Multishot"],
      ["Galvanized Shot", "+80% Status Chance, +40% damage per status type on kill, 14 s (3 stacks)"], ["Primed Convulsion", "+165% Electricity"]],
    note: "These are recommended mods, not a full grid: the weapon's capacity and slots have not been checked." },
  howto: "Stack your buffs in order: Nourish (1) if subsumed, Shatter Shield (3), Shooting Gallery (2), then hold Peacemaker (4). Peacemaker's damage ramps up by 7.5% per burst to +150% after 20 bursts, and drops when you release it (with Mesa's Waltz the bonus decays over time). Shatter Shield reflects gunfire but not melee or area damage: release Peacemaker and roll away when enemies close in. Never channel into a Nullifier bubble — pop it first, then recast.",
  /* FAQ (21/10/2026) : répond aux requêtes Search Console « does mesa need range », « mesa prime
     build », « best mesa build ». Chaque valeur : wiki officiel lu le 21/10/2026 (Peacemaker, Shatter
     Shield, Shooting Gallery, Mesa/Prime) ; « la Portée ne change pas les 50 m » vient du wiki FR
     (Pacificateurs), le wiki EN ne le dit pas. Projet : voidrelay/contenu/FAQ_MESA_2026-10-21.md. */
  faq: [
    ["What is the best Mesa build?", "Everything revolves around <b>Peacemaker</b> (4): <b>Pistol Amp</b> aura (+27% pistol damage), because the Regulators count as a secondary weapon; <b>Mesa's Waltz</b> in the Exilus slot to walk at 50% speed while firing; and at least <b>119% Ability Strength</b> so <b>Shatter Shield</b> reaches its 95% damage reduction cap. Peacemaker costs 25 energy to cast, then 15 per second. The three tiers above give the full mod lists."],
    ["Does Mesa need Ability Range?", "Not for shooting distance: Peacemaker hits up to <b>50 m</b>, and the official French wiki states that Ability Range does not change that radius. Range does set the <b>size of the targeting ring</b>: 15° at 100% Range, wider above, tighter below, and only enemies inside the ring are hit. Damage, cost and drain do not depend on Range. Range matters for <b>Shooting Gallery</b> (16 m at max rank) and for Shatter Shield, which diverts gunfire to an enemy within 11 m at max rank. That is why the Intermediate and Expert tiers trade Range for Duration with Narrow Minded: a longer Shatter Shield for a tighter ring."],
    ["Mesa or Mesa Prime: does the build change?", "No: same four abilities and same passive, so the same build. At rank 30, Mesa Prime has <b>135 armor</b> (105 for Mesa), <b>190 energy</b> (150), 500 health (465) and starts with 65 energy (50); shields (280) and sprint speed (1.1) are identical. Its slots come with 4 polarities (2 Naramon, 1 Vazarin, 1 Madurai) versus 2 Naramon on Mesa, so fewer Formas. The official wiki lists Mesa Prime as vaulted on 21 October 2026: <a href=\"/o/mesa_prime_set\">Mesa Prime set price</a>."],
  ],
};
const BUILD_EXCALIBUR = {
  nom: "Excalibur",
  title: "Excalibur build (Exalted Blade): beginner to Steel Path | VoidRelay",
  desc: "Excalibur Exalted Blade build in 3 tiers: Steel Charge, Chromatic Blade, Radial Blind, arcanes, Archon Shards. Values checked on the official wiki.",
  deb: { aura: "Steel Charge", exilus: "Power Drift",
    mods: ["Intensify", "Continuity", "Stretch", "Streamline", "Flow", "Vitality", "Steel Fiber", "Augur Secrets"],
    note: "Steel Charge works here: Exalted Blade counts as a melee weapon, so the +60% melee aura boosts it. Strength and duration first, the rest keeps Radial Blind long and wide." },
  mid: { aura: "Steel Charge", exilus: "Power Drift",
    mods: ["Chromatic Blade", "Blind Rage", "Intensify", "Primed Continuity", "Primed Flow", "Equilibrium", "Rolling Guard", "Adaptation"],
    note: "Chromatic Blade turns the blade into an elemental status sword (+300% Status Chance, element set by your primary emissive color). Equilibrium turns health orbs into energy for the blade's upkeep.",
    arcanes: ["Arcane Fury", "Arcane Guardian"] },
  exp: { aura: "Steel Charge", exilus: "Power Drift",
    mods: ["Chromatic Blade", "Blind Rage", "Umbral Intensify", "Primed Continuity", "Primed Flow", "Equilibrium", "Rolling Guard", "Adaptation"],
    note: "Arcane Fury (+180% melee damage on crit) applies to Exalted Blade; Molt Augmented stacks up to +60% Ability Strength, which also raises Chromatic Blade's status. Put Melee Influence in the blade's arcane slot and pick a blue or purple primary emissive color for Electricity. Variant: Furious Javelin instead of Chromatic Blade (+15% melee damage per enemy hit for 16 s), keeping Radial Javelin.",
    arcanes: ["Arcane Fury", "Molt Augmented"],
    shards: { profil: "Exalted Blade", slots: ["🟣 Violet — +25% Melee Critical Damage, doubled when Max Energy is over 500 (applies to Exalted Blade)", "🟣 Violet — +25% Melee Critical Damage (doubled over 500 energy)", "🟣 Violet — +25% Melee Critical Damage (doubled over 500 energy)", "🔵 Azure — +50 Max Energy", "🔵 Azure — +50 Max Energy (with Primed Flow: 427.5 → 527.5)"], alt: "Excalibur Prime and Umbra (225 energy at rank 30) are already over 500 with Primed Flow alone: run 5 Violet. No Ability Strength shard: a doubled Violet (+50% Critical Damage) adds more than +10% Strength, even at the blade's base 15% crit chance. Tauforged shards give +50%. Shard values: official wiki, 21 October 2026." } },
  reco: { titre: "Recommended mods for Exalted Blade",
    intro: "Exalted Blade takes <b>melee</b> mods and arcanes. It has its own stance (no stance mods). Base: 70% Slash, 15% critical chance at x2, 15% status chance. Its energy waves feed the combo, and Excalibur's passive (+10% damage and speed) applies.",
    grille: [["Primed Pressure Point", "+165% Melee Damage"], ["Condition Overload", "+80% damage per status type"], ["Organ Shatter", "+90% Critical Damage"], ["True Steel", "+120% Critical Chance"],
      ["Blood Rush", "+40% Critical Chance x combo multiplier"], ["Weeping Wounds", "+40% Status Chance x combo multiplier"], ["Buzz Kill", "+120% Slash"],
      ["Berserker Fury", "+35% Attack Speed per melee kill, 10 s (2 stacks)"]],
    note: "Chromatic Blade variant: an elemental mod replaces Buzz Kill (physical mods no longer count). These are recommended mods, not a full grid: the weapon's capacity and slots have not been checked." },
  howto: "Cast Radial Blind (2) to blind the room, then summon Exalted Blade (4) and swing: every swing sends out an energy wave that passes through enemies, so blinded targets die at range. Slash Dash (1) crosses the room and each hit also releases a wave. The blade costs 25 energy to summon and 2.5 per second to keep: recast Radial Blind whenever enemies start shooting again.",
  /* FAQ (21/10/2026) : requêtes Search Console « excalibur build », « excalibur umbra build »,
     « warframe excalibur builds ». Valeurs : wiki officiel lu le 21/10/2026 (Exalted Blade,
     Exalted Weapon, Excalibur/Prime/Umbra, Chromatic Blade). Projet : voidrelay/contenu/FAQ_EXCALIBUR_2026-10-21.md. */
  faq: [
    ["What is the best Excalibur build?", "Everything revolves around <b>Exalted Blade</b> (4): 25 energy to cast, then 2.5 per second, and every swing sends out an energy wave that passes through enemies. <b>Steel Charge</b> aura (+60% melee damage), which applies to the blade; <b>Chromatic Blade</b> (+300% Status Chance at max rank) to give it an element; <b>Radial Blind</b> (2) to blind the room before you swing. The blade's own mod grid is above."],
    ["Do my melee weapon's mods apply to Exalted Blade?", "No. Since Update 23, Exalted Blade has its own mod slots in the Arsenal, and since Update 38.5 its own Arcane slot (Melee Influence, for example). It forces its own stance, which ranks up with the ability. Some Warframe mods count too: Ability Strength, Duration and Efficiency."],
    ["Which color for Chromatic Blade?", "The element follows Excalibur's <b>primary emission color</b>; other colors (secondary emission and so on) do nothing. White, grey, black or faded colors = Cold; blues and purples = Electricity; red, magenta, brown, orange, bright yellow = Heat; green, lime, teal, dark yellow = Toxin. The element replaces physical damage (physical mods stop counting) and combines with elemental mods: green emission + an Electricity mod = Corrosive."],
    ["Excalibur, Excalibur Prime or Excalibur Umbra: does the build change?", "<b>Prime</b>: same abilities, same build. At rank 30 it has 315 armor (240 for Excalibur), 225 energy (150), starts with 100 energy (50), a Madurai aura and 3 innate polarities (2 on Excalibur). It was a Founders exclusive and can no longer be obtained. <b>Umbra</b>: same passive (+10% damage and attack speed with swords) and same abilities except the 2: <b>Radial Howl</b>, which blinds or staggers and also strips the resistances of Sentients and the Shadow Stalker. Its Exalted Umbra Blade has the same stats; its 3 Umbra slots take Umbral mods. It comes from The Sacrifice quest, one per account."],
  ],
};
const BUILDS_SPECIFIQUES_EN = { "mesa": BUILD_MESA, "mesa-prime": BUILD_MESA, "excalibur": BUILD_EXCALIBUR, "excalibur-prime": BUILD_EXCALIBUR, "excalibur-umbra": BUILD_EXCALIBUR };

function framePageEN(f) {
  const slug = slugify(f.n);
  const B = BUILDS_SPECIFIQUES_EN[slug];
  const url = `${SITE}/en/builds/${slug}`;
  const hl = hreflangPair(`/builds/${slug}`, `/en/builds/${slug}`);
  // Variante Prime : même build, nom de la frame substitué dans le titre et la description.
  const title = B ? B.title.replace(B.nom, f.n) : UI_EN.titleFrame(f.n), desc = B ? B.desc.replace(B.nom, f.n) : UI_EN.descFrame(f.n);
  const stats = `<table class="bstats"><tr><td>${UI_EN.statH}</td><td>${esc(f.h)}</td></tr><tr><td>${UI_EN.statS}</td><td>${esc(f.s)}</td></tr><tr><td>${UI_EN.statAr}</td><td>${esc(f.ar)}</td></tr><tr><td>${UI_EN.statE}</td><td>${esc(f.e)}</td></tr><tr><td>${UI_EN.statSpd}</td><td>${esc(f.spd)}</td></tr><tr><td>${UI_EN.statMr}</td><td>MR ${esc(f.mr)}</td></tr></table>`;
  const abils = (f.ab || []).map(a => `<span class="modslot"><b>${esc(a)}</b></span>`).join("");
  const img = heroImg("frames", f.i);
  const shards = shardPlanEN(f);
  const T = FRAME_TIERS_EN, TF = FRAME_TIERS;
  const bulles = B ? anchorize(
    bulleEN(T.deb, { ...B.deb })
    + bulleEN(T.mid, { ...B.mid })
    + bulleEN(T.exp, { ...B.exp })
  ) + (B.reco ? `<section class="panel btier"><h3>${B.reco.titre}</h3><p class="bodytext btier-note">${B.reco.intro}</p><p class="modnote">⚠️ Indicative grid: check your weapon's capacity and polarities.</p><div class="modg" style="margin:10px 0 6px">${B.reco.grille.map(([m, fx]) => modCardFxEN(m, fx)).join("")}</div><p class="bodytext btier-note">${B.reco.note} <span class="muted">Verified on the official wiki on 21 October 2026.</span></p></section>` : "") + `<section class="panel"><h3>How to play</h3><p>${esc(B.howto)}</p><p class="modnote">Values checked on the official Warframe wiki on 20 October 2026.</p></section>` + (B.faq ? `<section class="panel" id="faq"><h2 style="margin:0 0 6px">${esc(B.nom)} FAQ</h2>${B.faq.map(([q, r]) => `<h3>${esc(q)}</h3><p class="bodytext">${r}</p>`).join("")}<p class="modnote">Values checked on the official Warframe wiki on 21 October 2026.</p></section>` : "") : anchorize(
    bulleEN(T.deb, { aura: TF.deb.aura, exilus: TF.deb.exilus, mods: TF.deb.mods, note: T.deb.note, sim: { slug, tier: "deb" } })
    + bulleEN(T.mid, { aura: TF.mid.aura, exilus: TF.mid.exilus, mods: TF.mid.mods, note: T.mid.note, arcanes: UI_EN.midArcanes, sim: { slug, tier: "mid" } })
    + bulleEN(T.exp, { aura: TF.exp.aura, exilus: TF.exp.exilus, mods: TF.exp.mods, note: T.exp.note, arcanes: UI_EN.expArcanes, shards, sim: { slug, tier: "exp" } })
  );
  return head(title, desc, url, "en", hl, img) + TOPBAR_EN + `<main class="wrap">
<nav class="bc"><a href="/en/">${UI_EN.home}</a> › <a href="/en/builds/">${UI_EN.breadcrumbBuilds}</a> › <span>${esc(f.n)}</span></nav>
<div class="bhero">${img ? `<img class="bhero-img" src="${vignette(img)}" alt="${esc(f.n)}" width="132" height="132" loading="eager">` : ""}<h1 class="nm">${esc(f.n)} build</h1><span class="btag">${f.prime ? UI_EN.heroFramePrime(f.mr) : UI_EN.heroFrame(f.mr)}</span><p class="role">${esc(f.desc || "")}</p></div>
<div class="bcols"><div class="panel"><h3>${UI_EN.baseStats}</h3>${stats}</div><div class="panel"><h3>${UI_EN.abilities}</h3><div class="abilities" style="margin-bottom:8px">${abils}</div>${lignePassif(UI_EN.passive, PASSIF_EN.get(f.n))}</div></div>
${slugNote(slug, "en")}<h2 style="margin:18px 0 4px">${UI_EN.the3builds}</h2>${TIERJUMP_EN}${bulles}${DISCLAIMER_EN}
<p class="bc" style="margin-top:14px"><a href="/en/builds/">${UI_EN.allBuilds}</a> · ${marketLink(f.n)?`<a href="${marketLink(f.n)}">${esc(UI_EN.priceOfSet(f.n))}</a>`:`<a href="/en/o/">${UI_EN.itemPrices}</a>`}</p>${guidesLinkLine(f.n, "en")}
</main>` + FOOTER_EN;
}

function weaponPageEN(w) {
  const slug = slugify(w.n);
  const url = `${SITE}/en/builds/${slug}`;
  const hl = hreflangPair(`/builds/${slug}`, `/en/builds/${slug}`);
  const fam = WEAPON_RULES[w.t] ? w.t : (TYPE_ALIAS[w.t] || null);
  if (!fam) return null;
  const R = WEAPON_RULES[fam], RE = WEAPON_RULES_EN[fam];
  const catEn = UI_EN.catFr[w.c] || w.c;
  const title = UI_EN.titleWeapon(w.n), desc = UI_EN.descWeapon(w.n, RE.label);
  const typeNote = TYPE_NOTE_EN[w.t] ? `<p class="modnote">${esc(TYPE_NOTE_EN[w.t])}</p>` : "";
  const riven = (typeof w.d === "number" && w.d > 0) ? `<tr><td>${UI_EN.riven}</td><td>${"●".repeat(Math.max(1, Math.min(5, w.d)))}${"○".repeat(5 - Math.max(1, Math.min(5, w.d)))}</td></tr>` : "";
  const img = heroImg("weapons", w.i);
  const stats = `<table class="bstats"><tr><td>${UI_EN.cat}</td><td>${esc(catEn)}</td></tr><tr><td>${UI_EN.type}</td><td>${esc(w.t)}</td></tr><tr><td>${UI_EN.statMr}</td><td>MR ${esc(w.mr)}</td></tr>${riven}</table>`;
  const bulles = anchorize(
    bulleEN({ t: "🌱 Beginner", cost: RE.deb.cost + UI_EN.costDebW }, { mods: R.deb.mods, note: RE.deb.note, sim: { slug, tier: "deb" } })
    + bulleEN({ t: "⚙️ Intermediate", cost: RE.mid.cost + UI_EN.costMidW }, { mods: R.mid.mods, note: RE.mid.note, sim: { slug, tier: "mid" } })
    + bulleEN({ t: "🔥 Expert", cost: RE.exp.cost + UI_EN.costExpW }, { mods: R.exp.mods, note: RE.exp.note, arcanes: R.arcExp ? [R.arcExp] : undefined, sim: { slug, tier: "exp" } })
  );
  return head(title, desc, url, "en", hl, img) + TOPBAR_EN + `<main class="wrap">
<nav class="bc"><a href="/en/">${UI_EN.home}</a> › <a href="/en/builds/">${UI_EN.breadcrumbBuilds}</a> › <span>${esc(w.n)}</span></nav>
<div class="bhero">${img ? `<img class="bhero-img" src="${vignette(img)}" alt="${esc(w.n)}" width="132" height="132" loading="eager">` : ""}<h1 class="nm">${esc(w.n)} build</h1><span class="btag">${UI_EN.heroWeapon(RE.label, w.mr)}</span><p class="role">${esc(UI_EN.weaponRole(catEn))}</p></div>
<div class="panel" style="margin:14px 0"><h3>${UI_EN.sheet}</h3>${stats}${typeNote}</div>
${slugNote(slug, "en")}<h2 style="margin:18px 0 4px">${UI_EN.the3builds}</h2>${TIERJUMP_EN}${bulles}${DISCLAIMER_EN}
<p class="bc" style="margin-top:14px"><a href="/en/builds/">${UI_EN.allBuilds}</a> · ${marketLink(w.n)?`<a href="${marketLink(w.n)}">${esc(UI_EN.priceOfSet(w.n))}</a>`:`<a href="/en/o/">${UI_EN.itemPrices}</a>`}</p>${guidesLinkLine(w.n, "en")}
</main>` + FOOTER_EN;
}

function compPageEN(c) {
  const slug = slugify(c.n);
  const url = `${SITE}/en/builds/${slug}`;
  const hl = hreflangPair(`/builds/${slug}`, `/en/builds/${slug}`);
  const R = reglesComp(c);
  const RE = COMP_RULES_EN[c.k] || COMP_RULES_EN["Bête"];
  const title = UI_EN.titleComp(c.n), desc = UI_EN.descComp(c.n, c.k);
  const img = heroImg("companions", c.i);
  const stats = `<table class="bstats"><tr><td>${UI_EN.type}</td><td>${esc(c.k === "Bête" ? "Beast" : "Sentinel")}${c.prime ? " · Prime" : ""}</td></tr>${c.h ? `<tr><td>${UI_EN.statH}</td><td>${esc(c.h)}</td></tr>` : ""}${c.ar ? `<tr><td>${UI_EN.statAr}</td><td>${esc(c.ar)}</td></tr>` : ""}<tr><td>${UI_EN.statMr}</td><td>MR ${esc(c.mr || 0)}</td></tr></table>`;
  const bulles = anchorize(
    bulleEN({ t: "🌱 Beginner", cost: RE.deb.cost + UI_EN.costDebC }, { mods: R.deb.mods, claws: R.deb.claws, note: RE.deb.note })
    + bulleEN({ t: "⚙️ Intermediate", cost: RE.mid.cost }, { mods: R.mid.mods, claws: R.mid.claws, note: RE.mid.note })
    + bulleEN({ t: "🔥 Expert", cost: RE.exp.cost + UI_EN.costExpC }, { mods: R.exp.mods, claws: R.exp.claws, note: RE.exp.note })
  );
  return head(title, desc, url, "en", hl, img) + TOPBAR_EN + `<main class="wrap">
<nav class="bc"><a href="/en/">${UI_EN.home}</a> › <a href="/en/builds/">${UI_EN.breadcrumbBuilds}</a> › <span>${esc(c.n)}</span></nav>
<div class="bhero">${img ? `<img class="bhero-img" src="${vignette(img)}" alt="${esc(c.n)}" width="132" height="132" loading="eager">` : ""}<h1 class="nm">${esc(c.n)} build</h1><span class="btag">${UI_EN.heroComp(c.k)}</span><p class="role">${esc(c.desc || "")}</p></div>
<div class="panel" style="margin:14px 0"><h3>${UI_EN.sheet}</h3>${stats}</div>
${slugNote(slug, "en")}<h2 style="margin:18px 0 4px">${UI_EN.the3builds}</h2>${TIERJUMP_EN}${bulles}${DISCLAIMER_EN}
<p class="bc" style="margin-top:14px"><a href="/en/builds/">${UI_EN.allBuilds}</a> · ${marketLink(c.n)?`<a href="${marketLink(c.n)}">${esc(UI_EN.priceOf(c.n))}</a>`:`<a href="/en/o/">${UI_EN.itemPrices}</a>`}</p>${guidesLinkLine(c.n, "en")}
</main>` + FOOTER_EN;
}

function indexPageEN(entries) {
  const title = "Warframe builds: every Warframe, weapon and companion | VoidRelay";
  const desc = `${entries.length} builds in 3 tiers (beginner, intermediate, expert): ${wfs.length} Warframes, ${entries.filter(e => e.cat === "weapon").length} weapons and ${comps.length} companions. Real mods, arcanes and Archon Shards.`;
  const groups = [
    ["frame", "◈ Warframes", entries.filter(e => e.cat === "frame")],
    ["primary", "🔫 Primary weapons", entries.filter(e => e.cat === "weapon" && e.c === "Primary")],
    ["secondary", "🔫 Secondary weapons", entries.filter(e => e.cat === "weapon" && e.c === "Secondary")],
    ["melee", "⚔ Melee", entries.filter(e => e.cat === "weapon" && e.c === "Melee")],
    ["arch", "🛰 Archwing", entries.filter(e => e.cat === "weapon" && /^Arch/.test(e.t || ""))],
    ["comp", "🐾 Companions", entries.filter(e => e.cat === "comp")],
  ].filter(g => g[2].length);
  const sections = groups.map(([id, label, list]) => `<h2 id="${id}" style="margin:22px 0 8px">${label} <span style="color:var(--muted);font-size:.8em">(${list.length})</span></h2>
<div class="modg" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${list.map(e =>
    `<a class="modslot bx" data-n="${esc(e.n.toLowerCase())}" href="/en/builds/${e.slug}" style="justify-content:space-between"><span>${esc(e.n)}</span><span style="color:var(--muted);font-size:.75rem;flex:none">MR ${esc(e.mr || 0)}</span></a>`).join("")}</div>`).join("");
  return head(title, desc, `${SITE}/en/builds/`, "en", hreflangPair("/builds/", "/en/builds/"), "/assets/og.png") + TOPBAR_EN + `<main class="wrap">
<nav class="bc"><a href="/en/">${UI_EN.home}</a> › <span>${UI_EN.breadcrumbBuilds}</span></nav>
<div class="bhero"><h1 class="nm">Warframe builds</h1><span class="btag">${entries.length} builds · 3 tiers each</span><p class="role">Every build comes in <b>3 versions</b>: 🌱 beginner (almost no requirements), ⚙️ intermediate, 🔥 expert (Primed, Galvanized, arcanes — plus the 5 Archon Shard slots on Warframes).</p></div>
<div class="panel" style="margin:14px 0"><input id="bq" type="search" data-vr-suggest placeholder="Filter (e.g. Mesa, Soma, Kavat…)" autocomplete="off" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid var(--line);background:var(--bg2);color:var(--ink);font-size:1rem">
<div class="tierjump" style="margin:12px 0 0">${groups.map(([id, label, list]) => `<a href="#${id}">${label.replace(/^[^ ]+ /, "")} (${list.length})</a>`).join("")}</div></div>
${sections}
<p class="bc" style="margin-top:16px"><a href="/en/o/">${UI_EN.itemPrices}</a> · <a href="/en/guides/">Guides</a> · <a href="/hub">Dashboard</a></p>
</main>
<script>(function(){var q=document.getElementById("bq");if(!q)return;q.addEventListener("input",function(){var v=q.value.trim().toLowerCase();document.querySelectorAll(".bx").forEach(function(a){a.style.display=(!v||a.dataset.n.indexOf(v)!==-1)?"":"none"})});})();</script>` + FOOTER_EN;
}

/* ---------- main ---------- */
/* Toute page de builds passe par ici. Le fil d'Ariane déclaré est DÉRIVÉ du
   <nav class="bc"> que la page vient d'écrire : il n'y a aucune liste à tenir
   à jour à côté des gabarits, donc rien qui puisse s'en désynchroniser. */
/* --verifier (28/09/2026) : le lien « Feedback » du pied de page (PR #26) avait été
   ajouté À LA MAIN dans les 727 pages FR, pas ici. Une régénération l'aurait
   retiré sans bruit — la même dérive que celle des pages objet (CLAUDE.md, piège 1).
   En mode vérification, rien n'est écrit : on compte les fichiers qui changeraient. */
const VERIFIER = process.argv.includes("--verifier");
const divergents = [];
function ecrire(chemin, contenu) {
  if (!VERIFIER) return fs.writeFileSync(chemin, contenu);
  const actuel = fs.existsSync(chemin) ? fs.readFileSync(chemin, "utf8") : null;
  if (actuel !== contenu) divergents.push(path.relative(ROOT, chemin));
}
function ecrirePage(chemin, html) {
  ecrire(chemin, avecFilArianeDeclare(html));
}

const manual = fs.readdirSync(OUT).filter(f => f.endsWith(".html"))
  .filter(f => !fs.readFileSync(path.join(OUT, f), "utf8").includes(MARKER))
  .map(f => f.slice(0, -5));
const manualSlugs = manual.filter(s => s !== "index");
console.log(`Pages manuelles préservées (${manualSlugs.length}) : ${manualSlugs.join(", ")}`);

ALL_BUILD_NAMES = new Set([...wfs.map(f => f.n), ...weapons.map(w => w.n), ...comps.map(c => c.n)]);

const entries = [];
let written = 0, writtenEn = 0, skipped = 0;

for (const f of wfs) {
  const slug = slugify(f.n);
  entries.push({ slug, n: f.n, cat: "frame", mr: f.mr, img: heroImg("frames", f.i) });
  fs.mkdirSync(OUT_EN, { recursive: true });
  ecrirePage(path.join(OUT_EN, slug + ".html"), framePageEN(f)); writtenEn++;
  if (manualSlugs.includes(slug)) { skipped++; continue; }
  ecrirePage(path.join(OUT, slug + ".html"), framePage(f)); written++;
}
for (const w of weapons) {
  const slug = slugify(w.n);
  if (entries.some(e => e.slug === slug)) continue; // collision de nom → la 1re fiche gagne
  const html = weaponPage(w);
  if (!html) continue;
  entries.push({ slug, n: w.n, cat: "weapon", c: w.c, t: w.t, mr: w.mr, img: heroImg("weapons", w.i) });
  ecrirePage(path.join(OUT_EN, slug + ".html"), weaponPageEN(w)); writtenEn++;
  if (manualSlugs.includes(slug)) { skipped++; continue; }
  ecrirePage(path.join(OUT, slug + ".html"), html); written++;
}
for (const c of comps) {
  const slug = slugify(c.n);
  if (entries.some(e => e.slug === slug)) continue;
  entries.push({ slug, n: c.n, cat: "comp", mr: c.mr, img: heroImg("companions", c.i) });
  ecrirePage(path.join(OUT_EN, slug + ".html"), compPageEN(c)); writtenEn++;
  if (manualSlugs.includes(slug)) { skipped++; continue; }
  ecrirePage(path.join(OUT, slug + ".html"), compPage(c)); written++;
}

entries.sort((a, b) => a.n.localeCompare(b.n, "fr"));
ecrirePage(path.join(OUT, "index.html"), indexPage(entries, manualSlugs));
ecrirePage(path.join(OUT_EN, "index.html"), indexPageEN(entries));
// Index consommé par js/search.js (palette de recherche du site) : les builds deviennent trouvables.
ecrire(path.join(ROOT, "data/arsenal_builds.json"), JSON.stringify(SIM_MAP));
ecrire(path.join(ROOT, "data/builds_index.json"),
  JSON.stringify(entries.map(e => ({ s: e.slug, n: "Build " + e.n, ...(e.img ? { i: e.img } : {}) }))));
rapportFrancisation("builds FR");
/* Lame Chromatique (wiki, 21/10/2026) : l'élément suit la couleur ÉMISSIVE PRIMAIRE et c'est un
   élément simple. Trois pages disaient « couleur d'énergie » et « Corrosif ou Viral » directement. */
function chromatiqueFaux() {
  const faux = [];
  for (const dossier of [OUT, OUT_EN]) for (const f of fs.readdirSync(dossier).filter(x => x.endsWith(".html"))) {
    const txt = fs.readFileSync(path.join(dossier, f), "utf8").replace(/<[^>]+>/g, " ");
    const re = /Chromatic Blade|Lame Chromatique/gi;
    let m;
    while ((m = re.exec(txt))) {
      const zone = txt.slice(Math.max(0, m.index - 150), m.index + 300);
      if (/energy colou?r|couleur d.énergie/i.test(zone) || /\bViral/.test(zone)
        || (/Corrosi(f|ve)/.test(zone) && !/Toxi(n|ne)/.test(zone))) { faux.push(path.relative(ROOT, path.join(dossier, f))); break; }
    }
  }
  return faux;
}
/* Fragments d'Archonte (21/10/2026) : chaque ligne d'éclat doit nommer une couleur réelle ET un
   bonus que cette couleur donne vraiment (wiki.warframe.com/w/Archon_Shard, lu le 21/10/2026 ;
   noms FR : fr.wiki Helminth et Update_35). Le plan générique affichait « Cramoisi », « Azur —
   Recharge de bouclier » et « Violet → gain d'énergie », et 14 pages ★ « Efficacité de cast »,
   « Vitesse de course », « Portée de capacité » : aucun n'existe. Les pages ★ pas encore
   auditées sont listées à part ; la liste ne peut que rétrécir (une page corrigée doit en sortir). */
const BONUS_ECLATS = {
  "Écarlate": /dégâts critiques de mêlée|chance de statut d.arme principale|chance critique d.arme secondaire|puissance de pouvoir|durée de pouvoir/i,
  "Ambre": /énergie max remplie à l.apparition|efficacité des orbes de (santé|d.énergie)|vitesse d.incantation|vélocité de parkour/i,
  "Azur": /^\s*:?\s*(santé|capacité de bouclier|énergie max|armure|régénération de santé)(?=\s|$|[+:,])/i,
  "Violet": /dégâts de pouvoir.*électri|dégâts électriques.*arme principale|dégâts critiques de mêlée|orbes? de santé.*énergie/i,
  "Topaze": /santé max.*explosi|bouclier.*explosi|chance critique d.arme secondaire.*chaleur|dégâts de pouvoir.*radiation/i,
  "Émeraude": /statut (toxine|poison)|dégâts de pouvoir.*corrosi|cumuls.*corrosi/i,
  "Crimson": /melee critical damage|primary status chance|secondary critical chance|ability strength|ability duration/i,
  "Amber": /max energy filled on spawn|(health|energy) orb effectiveness|casting speed|parkour velocity/i,
  "Azure": /^\s*:?\s*\+?[\d.,]+\s*(health|shield capacity|energy max|max energy|armor|health\/s)(?=\s|$|[(,])|^\s*:?\s*\+?\s*(max health|shield capacity|energy max|armor)(?=\s|$|[(,])/i,
  "Violet ": /ability damage.*electric|primary electricity damage|melee critical damage|health pickups.*energy/i,
  "Topaz": /max health.*blast|shield.*blast|secondary critical chance.*heat|ability damage.*radiation/i,
  "Emerald": /toxin status|ability damage.*corrosi|corrosion stacks/i,
};
const ECLATS_EN_ATTENTE = new Set(["ash", "ember", "frost", "khora", "loki", "mag", "nekros", "nova",
  "octavia", "rhino", "saryn", "trinity", "volt", "wisp"]); // pages ★ FR à auditer (lot suivant)
function eclatsInvalides() {
  const erreurs = [], attenteCorrigee = [];
  for (const [dossier, en] of [[OUT, false], [OUT_EN, true]]) for (const f of fs.readdirSync(dossier).filter(x => x.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(dossier, f), "utf8");
    const blocs = [...html.matchAll(/<(ol|ul) class="(?:shardlist|shards)">([\s\S]*?)<\/\1>/g)];
    let ko = null;
    for (const b of blocs) for (const li of b[2].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const txt = li[1].replace(/<[^>]+>/g, " ").replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
      const couleurs = en ? ["Crimson", "Amber", "Azure", "Violet", "Topaz", "Emerald"] : ["Écarlate", "Ambre", "Azur", "Violet", "Topaze", "Émeraude"];
      const c = couleurs.find(x => new RegExp(`(^|[\\s×—🔴🟡🔵🟣🟠🟢])${x}(\\s|$|:)`).test(txt));
      if (!c) { ko = ko || `couleur absente : « ${txt.slice(0, 60)} »`; continue; }
      const reste = txt.slice(txt.indexOf(c) + c.length).replace(/^\s*[—:-]\s*/, "");
      const re = BONUS_ECLATS[en && c === "Violet" ? "Violet " : c];
      if (!re.test(reste)) ko = ko || `bonus inconnu pour ${c} : « ${reste.slice(0, 60)} »`;
    }
    const slug = f.slice(0, -5), rel = path.relative(ROOT, path.join(dossier, f));
    if (!en && ECLATS_EN_ATTENTE.has(slug)) { if (!ko) attenteCorrigee.push(rel); continue; }
    if (ko) erreurs.push(`${rel} — ${ko}`);
  }
  return { erreurs, attenteCorrigee };
}
if (VERIFIER) {
  const fauxChrom = chromatiqueFaux();
  const ecl = eclatsInvalides();
  if (ecl.erreurs.length) {
    console.error(`💥 Fragments d'Archonte : ${ecl.erreurs.length} page(s) avec une couleur ou un bonus qui n'existe pas (wiki Archon_Shard) :`);
    for (const e of ecl.erreurs.slice(0, 15)) console.error("   " + e);
    process.exit(1);
  }
  if (ecl.attenteCorrigee.length) {
    console.error("💥 Fragments d'Archonte : page(s) corrigée(s) encore dans ECLATS_EN_ATTENTE, retire-les de la liste :");
    for (const e of ecl.attenteCorrigee) console.error("   " + e);
    process.exit(1);
  }
  if (fauxChrom.length) {
    console.error("💥 Lame Chromatique : élément lié à la couleur d'énergie ou à Corrosif/Viral direct (c'est la couleur émissive primaire, élément simple) :");
    for (const f of fauxChrom) console.error("   " + f);
    process.exit(1);
  }
  if (divergents.length) {
    console.error(`💥 ${divergents.length} fichier(s) diffèrent de ce que le générateur produirait — une page de builds a été retouchée à la main, ou le gabarit a changé sans régénération :`);
    for (const f of divergents.slice(0, 10)) console.error("   " + f);
    process.exit(1);
  }
  console.log(`✅ builds : les ${written + writtenEn + 2} pages générées sont identiques au gabarit.`);
  process.exit(0);
}
console.log(`✅ ${written} pages FR + ${writtenEn} pages EN générées, ${skipped} manuelles préservées, index ${entries.length} fiches (+ builds_index.json).`);
