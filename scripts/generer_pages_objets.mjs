#!/usr/bin/env node
/* ============================================================================
 *  VoidRelay — Générateur de pages SEO par objet (SEO programmatique).
 *  Lit data/wm_catalog.json (slug, name, tags, img) et écrit :
 *    • o/<slug>.html   : une page par objet (prix live hydraté par js/objet.js)
 *    • o/index.html    : annuaire de tous les objets (regroupés par type)
 *    • sitemap.xml      : pages de base + toutes les pages objet
 *  Zéro dépendance. Lancé en local ou par .github/workflows/pages-objets.yml.
 *  Usage : node scripts/generer_pages_objets.mjs
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { GUIDES, GUIDES_EN, GUIDES_FAITS_MAIN, GUIDES_FAITS_MAIN_EN } from "./guides_content.mjs";
// Noms FR officiels des mods et arcanes (WFCD i18n) pour les pages FR — voir lib_noms_fr.mjs.
import { nomFr, nomBilingue, franciserProse, rapportFrancisation } from "./lib_noms_fr.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://voidrelay.fr";
const FORCE = process.argv.includes("--force");
/* --verifier : recalcule TOUT ce que ce script produirait et le compare au disque,
   sans rien écrire. Sort 1 à la première divergence.

   Pourquoi ce mode existe (04/09/2026) : le garde-fou de dérive ne se déclenche qu'au
   moment d'une génération, et une génération était devenue impossible — 4120 fichiers
   avaient été retouchés à la main depuis le dernier run, donc le script refusait de
   partir, donc plus personne ne le lançait. Le générateur et ses artefacts avaient
   silencieusement forké DANS LES DEUX SENS : les pages portaient des bannières et un
   lien « Platinum Path » que le gabarit ignorait, et le gabarit portait une entrée
   /marche-profils que l'index ⌘K français n'a jamais reçue. Personne ne pouvait le voir.
   Ce mode rend la divergence visible en CI, sans écrire une seule page. */
const VERIFIER = process.argv.includes("--verifier");
const MANIFEST_PATH = path.join(ROOT, "scripts", ".generated-manifest.json");
const sha256 = s => createHash("sha256").update(s).digest("hex");

/* Lot EN restreint (10/07/2026) : décision du Chef — ouvrir /en/o/ sur les objets
 * les plus échangés (critère mesurable : volume 48h warframe.market, cf.
 * scripts/rank_items_by_wm_volume.mjs), pas les 3834 d'un coup. La sélection est
 * un fichier de données à part (pas codée en dur ici) pour pouvoir être
 * recalculée sans toucher au générateur. Absence du fichier = aucune page EN
 * générée (dégradation gracieuse, ex. avant le tout premier calcul du lot). */
const EN_SELECTION_PATH = path.join(ROOT, "data", "en_objects_selection.json");
const EN_OBJECTS_SELECTION = new Set(
  fs.existsSync(EN_SELECTION_PATH) ? JSON.parse(fs.readFileSync(EN_SELECTION_PATH, "utf8")) : []
);
/* … PLUS tout objet qu'une page anglaise CITE déjà.

   Mesuré le 04/09/2026 : le guide « Jade Shadows » pointe vers /en/o/styanax_prime_set,
   /en/o/athodai_prime_set et /en/o/afentis_prime_set — trois pages qui n'existaient pas,
   donc trois 404 dans un guide publié. Le lot EN est volontairement restreint aux 250
   objets les plus échangés, et c'est un bon critère ; simplement, un objet dont on parle
   en anglais est un objet dont un lecteur anglais veut le prix.

   Ajouter les trois slugs à la main dans data/en_objects_selection.json ne tiendrait pas :
   rank_items_by_wm_volume.mjs RÉÉCRIT ce fichier, l'ajout disparaîtrait au prochain calcul.
   C'est exactement le fork que v72 vient de réparer. La règle vit donc ici, se recalcule
   à chaque génération, et se maintient toute seule quand un guide cite un nouvel objet. */
for (const dossier of [["en"], ["en", "guides"]]) {
  const abs = path.join(ROOT, ...dossier);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (!f.endsWith(".html")) continue;
    const html = fs.readFileSync(path.join(abs, f), "utf8");
    for (const m of html.matchAll(/href="\/en\/o\/([a-z0-9_()-]+)"/g)) EN_OBJECTS_SELECTION.add(m[1]);
  }
}

// 2026-07-15 : maillage objets -> builds. « Ash Prime Set » -> builds/ash-prime.html si la fiche
// existe (749 builds générés par generer_builds.mjs). Boucle inverse du lien « Prix du set »
// déjà présent sur les fiches builds.
function buildSlugFor(name) {
  const base = String(name).replace(/\s+set$/i, "");
  const slug = base.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return fs.existsSync(path.join(ROOT, "builds", slug + ".html")) ? { slug, base } : null;
}

/* ============================================================================
 * GARDE-FOUS (10/07/2026) — piège vécu le 09/07/2026 : une régénération de
 * "vérification" a écrasé une teinte CSS (color:#e2c05a) que le bot design
 * venait d'ajouter directement dans o/index.html + les 8 pages catégorie, car
 * ce script ignorait ce changement (son template source ne le connaissait
 * pas). Repéré et annulé avant commit — mais un run futur (le cron hebdo
 * pages-objets.yml, ou un run local pressé) pouvait très bien ne pas être
 * repéré à temps. Deux filets, dans cet ordre :
 *
 * 1) ARBRE DE TRAVAIL PROPRE — ce script ne modifie jamais silencieusement
 *    des fichiers déjà modifiés-mais-non-commités dans SES propres dossiers
 *    de sortie (o/, o/c/, guides/, en/guides/, sitemap.xml). Ne couvre PAS
 *    data/wm_catalog.json (légitimement modifié par maj_catalogue_objets.mjs
 *    juste avant, dans le même run CI, sans commit intermédiaire).
 * 2) DÉRIVE PAR EMPREINTE — après chaque run réussi, une empreinte SHA-256 de
 *    chaque fichier généré est sauvegardée (scripts/.generated-manifest.json,
 *    suivi par git). Au run suivant, AVANT d'écrire quoi que ce soit, le
 *    contenu actuel sur disque de chaque fichier est comparé à l'empreinte
 *    enregistrée : si un fichier a changé sans passer par ce script depuis
 *    (édition directe, patch ponctuel, tweak du bot design...), la
 *    génération est refusée — le prochain contenu généré écraserait ce
 *    changement en silence.
 *
 * Échappatoire volontaire : `--force` saute les deux (ex. une fois le
 * template source mis à jour pour refléter le tweak, ou pour rebâtir
 * l'empreinte après une divergence assumée).
 * ========================================================================== */
function assertCleanGitTree() {
  if (FORCE) return;
  let status;
  try {
    status = execSync('git status --porcelain -- o/ en/o/ guides/ en/guides/ sitemap.xml', { cwd: ROOT }).toString("utf8").trim();
  } catch (e) {
    console.warn("⚠️  git status indisponible (pas un dépôt git ?) — garde-fou d'arbre propre ignoré :", e.message);
    return;
  }
  if (status) {
    console.error("💥 ARBRE DE TRAVAIL SALE dans les dossiers gérés par ce générateur (o/, en/o/, guides/, en/guides/, sitemap.xml) :");
    console.error(status.split("\n").map(l => "   " + l).join("\n"));
    console.error("   Génération refusée (exit 1) — commite ou annule ces changements d'abord, ou relance avec --force pour les écraser sciemment.");
    process.exit(1);
  }
}
function loadManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")); } catch (e) { return {}; }
}
function assertNoDrift(manifest, plannedFiles) {
  if (FORCE) return;
  const drifted = [];
  for (const [rel, content] of plannedFiles) {
    const expected = manifest[rel];
    if (!expected) continue; // fichier neuf ou premier run : rien à comparer, pas de dérive possible.
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue; // déjà absent : rien à écraser.
    const onDisk = sha256(fs.readFileSync(abs, "utf8"));
    /* Disque = ce qu'on s'apprête à écrire : rien ne serait écrasé, donc pas de dérive,
       même si l'empreinte est périmée. Sans ce test, la fusion des sept branches (v88) a
       gardé l'empreinte d'une branche d'avant la régénération v78 : 270 fichiers
       parfaitement conformes au gabarit étaient déclarés « modifiés à la main », et
       pages-objets.yml refusait de tourner chaque lundi (mesuré le 21/09/2026). */
    if (onDisk !== expected && onDisk !== sha256(content)) drifted.push(rel);
  }
  if (drifted.length) {
    console.error(`💥 DÉRIVE DÉTECTÉE : ${drifted.length} fichier(s) déjà générés ont été modifiés EN DEHORS de ce script depuis le dernier run (édition manuelle, tweak design, patch ponctuel…) :`);
    console.error(drifted.map(f => "   " + f).join("\n"));
    console.error("   Régénérer maintenant écraserait ces changements en silence. Génération refusée (exit 1).");
    console.error("   → Répercute le changement dans le template source de ce script, puis relance ; ou relance avec --force pour écraser sciemment et rebâtir l'empreinte.");
    process.exit(1);
  }
}
function saveManifest(plannedFiles) {
  const manifest = {};
  for (const [rel, content] of plannedFiles) manifest[rel] = sha256(content);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 0) + "\n");
}

if (!VERIFIER) assertCleanGitTree();

const OUT = path.join(ROOT, "o");

const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "wm_catalog.json"), "utf8"));

/* Vignettes self-hostées (assets/objets/<slug>.png|webp) : priorité sur le hotlink warframe.market.
   Repli sur it.img si un futur objet n'est pas encore rapatrié (dégradation gracieuse, cf onerror). */
const OBJETS_DIR = path.join(ROOT, "assets", "objets");
const localImgFiles = new Set(fs.existsSync(OBJETS_DIR) ? fs.readdirSync(OBJETS_DIR) : []);
function localImg(slug) {
  for (const ext of ["webp", "png"]) {
    if (localImgFiles.has(`${slug}.${ext}`)) return `/assets/objets/${slug}.${ext}`;
  }
  return null;
}

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jstr = o => JSON.stringify(o).replace(/</g, "\\u003c"); // sûr dans <script>

/* Type lisible (FR) à partir des tags warframe.market. */
function typeLabel(tags) {
  const t = new Set(tags || []);
  if (t.has("riven_mod") || t.has("riven")) return "Riven";
  if (t.has("relic")) return "Relique";
  if (t.has("arcane_enhancement") || t.has("arcane")) return "Arcane";
  if (t.has("sculpture")) return "Sculpture Ayatan";
  if (t.has("set")) return t.has("prime") ? "Set Prime" : "Set";
  if (t.has("mod")) return "Mod";
  if (t.has("blueprint")) return t.has("prime") ? "Plan Prime" : "Plan";
  if (t.has("component")) return t.has("prime") ? "Pièce Prime" : "Composant";
  if (t.has("weapon")) return "Arme";
  if (t.has("warframe")) return "Warframe";
  return "Objet";
}
/* Catégorie de regroupement (pour l'index + objets liés). */
function groupKey(tags) {
  const l = typeLabel(tags);
  if (l.startsWith("Set")) return "Sets";
  if (l.startsWith("Pièce") || l.startsWith("Plan") || l === "Composant") return "Pièces & plans";
  return ({ "Riven": "Rivens", "Relique": "Reliques", "Arcane": "Arcanes", "Mod": "Mods", "Arme": "Armes", "Warframe": "Warframes", "Sculpture Ayatan": "Ayatan" })[l] || "Autres";
}
/* Type lisible (EN). */
function typeLabelEn(tags) {
  const t = new Set(tags || []);
  if (t.has("riven_mod") || t.has("riven")) return "Riven";
  if (t.has("relic")) return "Relic";
  if (t.has("arcane_enhancement") || t.has("arcane")) return "Arcane";
  if (t.has("sculpture")) return "Ayatan Sculpture";
  if (t.has("set")) return t.has("prime") ? "Prime Set" : "Set";
  if (t.has("mod")) return "Mod";
  if (t.has("blueprint")) return t.has("prime") ? "Prime Blueprint" : "Blueprint";
  if (t.has("component")) return t.has("prime") ? "Prime Component" : "Component";
  if (t.has("weapon")) return "Weapon";
  if (t.has("warframe")) return "Warframe";
  return "Item";
}
/* Regroupement (index EN) : même clé FR interne (groupKey), label EN à l'affichage. */
const GROUP_LABEL_EN = { "Sets": "Sets", "Pièces & plans": "Parts & blueprints", "Rivens": "Rivens", "Reliques": "Relics", "Arcanes": "Arcanes", "Mods": "Mods", "Armes": "Weapons", "Warframes": "Warframes", "Ayatan": "Ayatan", "Autres": "Other" };

/* Description riche FR par objet (contenu unique par page, dérivé des tags). */
const RARITY = { legendary: "légendaire", rare: "rare", uncommon: "peu commun", common: "commun" };
const KNOWN = new Set(["mod","rare","uncommon","common","legendary","relic","weapon","prime","component","warframe","primary","blueprint","melee","set","secondary","augment","axi","lith","meso","neo","scene","arcane_enhancement","archwing","pvp","misc","sentinel","pistol","shotgun","stance","rifle","syndicate","skin","necramech","railjack","fish","parazon","aura","archgun","kubrow","claws","sculpture","riven_mod","riven","beacon","amp","companion","bow","spear","glaive","sword","dagger","tonfa","hammer","whip","exalted","emote","key","resource","gem","captura","relics","extractor","ayatan","focus_lens","arch_melee"]);
function assocName(tags) { const x = (tags || []).find(t => !KNOWN.has(t)); return x ? x.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : ""; }
function eraName(tags) { for (const e of ["lith", "meso", "neo", "axi"]) if ((tags || []).includes(e)) return e.charAt(0).toUpperCase() + e.slice(1); return ""; }
function rarityFr(tags) { for (const r of ["legendary", "rare", "uncommon", "common"]) if ((tags || []).includes(r)) return RARITY[r]; return ""; }
function describe(name, tags) {
  const t = new Set(tags || []), a = assocName(tags), r = rarityFr(tags), pr = t.has("prime"), e = name;
  if (t.has("relic")) return `${e} est une relique du Vide${eraName(tags) ? ` (ère ${eraName(tags)})` : ""} dans Warframe. Ouvre-la pendant les Failles du Vide pour tenter d'obtenir des composants Prime. Les reliques s'échangent entre joueurs contre du platine sur Warframe Market.`;
  if (t.has("set")) return `${e} est le set ${pr ? "Prime " : ""}complet${a ? ` de ${a}` : ""} : il regroupe toutes les pièces nécessaires pour fabriquer l'objet entier. Acheter le set complet est souvent plus pratique que chaque pièce séparément — compare les prix ci-dessus avant d'acheter ou de vendre.`;
  if (t.has("component") || t.has("blueprint")) return `${e} est ${t.has("blueprint") ? "un plan" : "une pièce"} ${pr ? "Prime " : ""}${a ? `de ${a} ` : ""}à combiner avec les autres pièces du set pour fabriquer l'objet complet.${pr ? " Cette pièce s'obtient en ouvrant des reliques du Vide." : ""} Échangeable contre du platine sur Warframe Market.`;
  if (t.has("arcane_enhancement")) return `${e} est un arcane ${r || ""} dans Warframe. Les arcanes s'équipent pour ajouter des bonus puissants et montent en rang en cumulant des exemplaires identiques. Échangeable contre du platine sur Warframe Market.`;
  if (t.has("mod")) { const aug = t.has("augment"); const slot = t.has("warframe") ? `la Warframe${a ? ` ${a}` : ""}` : t.has("primary") ? "arme principale" : t.has("secondary") ? "arme secondaire" : t.has("melee") ? "arme de mêlée" : "l'objet"; return `${e} est un mod ${r || ""}${aug ? " d'augmentation" : ""} pour ${slot} dans Warframe.${aug ? " Les mods d'augmentation modifient ou renforcent une capacité et s'obtiennent en général auprès des syndicats." : ""} Échangeable contre du platine sur Warframe Market.`; }
  if (t.has("stance")) return `${e} est un mod de posture (stance) pour arme de mêlée dans Warframe : il débloque une combo d'attaques dédiée. Échangeable contre du platine sur Warframe Market.`;
  if (t.has("scene") || t.has("captura")) return `${e} est une scène Captura (décor de photo) dans Warframe. Cosmétique, elle s'échange entre joueurs contre du platine.`;
  if (t.has("skin")) return `${e} est un skin (apparence) dans Warframe. Purement cosmétique, échangeable contre du platine sur Warframe Market.`;
  if (t.has("sculpture")) return `${e} est une sculpture Ayatan : décorative et dotée d'emplacements pour des étoiles Ayatan, convertibles en Endo. Échangeable contre du platine sur Warframe Market.`;
  if (t.has("riven_mod") || t.has("riven")) return `${e} est un mod Riven dans Warframe : un mod aux statistiques aléatoires propre à une arme, dont le prix varie fortement selon ses stats. Échangeable contre du platine sur Warframe Market.`;
  return `${e} est un objet Warframe${r ? ` ${r}` : ""} échangeable entre joueurs contre du platine sur Warframe Market. Consulte son prix médian, sa vente la plus basse et sa tendance ci-dessus.`;
}

/* Équivalent EN — traduction du TEMPLATE (13 branches), pas objet par objet :
 * le prix affiché reste la même donnée en direct, seul le texte autour change. */
const RARITY_EN = { legendary: "legendary", rare: "rare", uncommon: "uncommon", common: "common" };
function rarityEn(tags) { for (const r of ["legendary", "rare", "uncommon", "common"]) if ((tags || []).includes(r)) return RARITY_EN[r]; return ""; }
function describeEn(name, tags) {
  const t = new Set(tags || []), a = assocName(tags), r = rarityEn(tags), pr = t.has("prime"), e = name;
  if (t.has("relic")) return `${e} is a Void Relic${eraName(tags) ? ` (${eraName(tags)} era)` : ""} in Warframe. Open it during Void Fissure missions for a chance at Prime components. Relics are traded between players for platinum on Warframe Market.`;
  if (t.has("set")) return `${e} is the complete ${pr ? "Prime " : ""}set${a ? ` for ${a}` : ""}: it bundles every part needed to build the full item. Buying the full set is often more convenient than each part separately — compare the prices above before buying or selling.`;
  if (t.has("component") || t.has("blueprint")) return `${e} is a ${pr ? "Prime " : ""}${t.has("blueprint") ? "blueprint" : "component"}${a ? ` for ${a}` : ""}, meant to be combined with the set's other parts to build the complete item.${pr ? " This part is obtained by opening Void relics." : ""} Tradeable for platinum on Warframe Market.`;
  if (t.has("arcane_enhancement")) return `${e} is a${r ? ` ${r}` : ""} arcane in Warframe. Arcanes are equipped to add powerful bonuses and rank up by stacking duplicates. Tradeable for platinum on Warframe Market.`;
  if (t.has("mod")) { const aug = t.has("augment"); const slot = t.has("warframe") ? `Warframe${a ? ` ${a}` : ""}` : t.has("primary") ? "primary weapons" : t.has("secondary") ? "secondary weapons" : t.has("melee") ? "melee weapons" : "this item"; return `${e} is a${r ? ` ${r}` : ""}${aug ? " augment" : ""} mod for ${slot} in Warframe.${aug ? " Augment mods modify or enhance an ability and are usually obtained from syndicates." : ""} Tradeable for platinum on Warframe Market.`; }
  if (t.has("stance")) return `${e} is a stance mod for melee weapons in Warframe: it unlocks a dedicated attack combo. Tradeable for platinum on Warframe Market.`;
  if (t.has("scene") || t.has("captura")) return `${e} is a Captura scene (photo backdrop) in Warframe. Purely cosmetic, traded between players for platinum.`;
  if (t.has("skin")) return `${e} is a skin (cosmetic appearance) in Warframe. Purely cosmetic, tradeable for platinum on Warframe Market.`;
  if (t.has("sculpture")) return `${e} is an Ayatan sculpture: decorative, with slots for Ayatan stars that convert into Endo. Tradeable for platinum on Warframe Market.`;
  if (t.has("riven_mod") || t.has("riven")) return `${e} is a Riven mod in Warframe: a mod with randomized stats tied to a specific weapon, whose price varies heavily depending on its rolled stats. Tradeable for platinum on Warframe Market.`;
  return `${e} is a${r ? ` ${r}` : ""} Warframe item tradeable between players for platinum on Warframe Market. Check its median price, lowest sale and trend above.`;
}

// Index par groupe pour les objets liés
const byGroup = new Map();
for (const it of cat) {
  const g = groupKey(it.tags);
  if (!byGroup.has(g)) byGroup.set(g, []);
  byGroup.get(g).push(it);
}

const HEAD_CSP = "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://warframe.market; font-src 'self'; connect-src 'self' https://api.warframestat.us https://cloudflareinsights.com https://voidrelay-prix.vercel.app https://api.allorigins.win https://api.codetabs.com https://api.warframe.market; form-action 'self'; frame-src 'none'; upgrade-insecure-requests";
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230b0f14'/%3E%3Cpath d='M14 18 L32 48 L50 18' fill='none' stroke='%2339d0d8' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

/* ============================================================================
 * Design « pandaahh » (guides FR + EN) — resynchronisé le 09/07/2026.
 * Les pages GUIDES en prod utilisent le thème clair/doré (css/pandaahh.css,
 * header .topwrap, footer .foot, bascule sombre/clair), PAS l'ancien design
 * (css/style.css / .vrtop) qui reste celui des pages /o/ (voulu). Avant cette
 * resynchro, toute régénération complète faisait régresser les 16 pages
 * guides vers l'ancien design en silence. Un garde-fou dans
 * scripts/verifier_invariants.sh échoue désormais si ça se reproduit.
 * ========================================================================== */
const FAVICON_OR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230b0f14'/%3E%3Cpath d='M14 18 L32 48 L50 18' fill='none' stroke='%23d4af37' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
// Anti-FOUC : pose le thème (sombre par défaut) avant le premier rendu.
const THEME_BOOT = `<script>(function(){try{var t=localStorage.getItem("vr-theme")||"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}})();</script>`;
// CSP des guides : comme HEAD_CSP + Google Fonts (Inter/Oswald du thème pandaahh).
const GUIDES_CSP = HEAD_CSP
  .replace("style-src 'self' 'unsafe-inline';", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;")
  .replace("font-src 'self';", "font-src 'self' https://fonts.gstatic.com;");
// display=optional (PAS swap) : mesure CLS reelle 10/07/2026 (PerformanceObserver, repete 3x) -> swap
// causait un reflow au moment du chargement de la police (CLS jusqu'a 1.03), optional -> CLS 0.0000.
// NE PAS repasser a swap sans re-mesurer. Ce template genere guides/ et en/guides/ (cf assertCleanGitTree
// plus haut) -- avant ce fix, une regeneration aurait silencieusement ecrase le meme correctif applique
// a la main sur les 18 pages guides (meme piege que le color:#e2c05a decrit en tete de fichier).
const FONTS_SNIPPET = `<!-- display=optional (PAS swap) : mesure CLS reelle 10/07/2026 (PerformanceObserver, repete 3x) -> swap causait un reflow au moment exact du chargement de la police (CLS jusqu'a 1.03), optional -> CLS 0.0000. NE PAS repasser a swap sans re-mesurer le CLS reel avant/apres sur plusieurs essais. Contexte complet : commit git "la prochaine classe de bug — CLS massif du au swap de police web". -->
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Oswald:wght@400;500;600;700&display=optional" rel="stylesheet">`;
// Header/footer du site (partagés FR/EN : les pages EN gardent la nav française, comme en prod).
function siteHeader(lang = "fr") {
  // « Vous êtes ici » (16/07/2026) : siteHeader ne sert qu'aux gabarits guides →
  // lien Guides marqué class="cur", comme sur les builds générés et la vrnav.
  // Depuis le 16/07/2026 (décision de l'admin) : les pages EN reçoivent une nav topbar TRADUITE,
  // alignée sur le TOPBAR_EN de generer_builds.mjs (Home/Builds/Items/Guides/Price check/
  // Dashboard/FAQ) — fin du « même header FR partout » historique.
  if (lang === "en") {
    return `<div class="topwrap"><header class="topbar"><a href="/en/" class="brand"><span class="logo">◆</span> VoidRelay</a><div class="search"><span>🔎</span><input type="search" id="vr-search" class="vr-search-input" placeholder="Search an item or build…" aria-label="Search a Warframe item" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="vr-search-results" aria-autocomplete="list"><kbd>K</kbd><div class="vr-search-results" id="vr-search-results" role="listbox" aria-label="Search results" hidden></div></div><nav class="topnav"><div class="topnav-search"><input type="search" id="vr-search-m" class="vr-search-input" placeholder="Search an item…" aria-label="Search a Warframe item" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="vr-search-results-m" aria-autocomplete="list"><div class="vr-search-results" id="vr-search-results-m" role="listbox" aria-label="Search results" hidden></div></div><a href="/en/">Home</a><a href="/en/platinum-path/">Platinum Path</a><a href="/en/builds/">Builds</a><a href="/en/o/">Items</a><a href="/en/guides/" class="cur">Guides</a><a href="/en/tools">Tools</a><a href="/hub">Dashboard</a><a href="/faq-en">FAQ</a><a href="/" hreflang="fr" title="Version française">FR</a></nav><button class="navburger" id="navburger" type="button" aria-label="Menu" aria-expanded="false">&#9776;</button>
<button class="themebtn" id="themebtn" type="button" aria-label="Toggle theme" title="Dark / light theme">☾</button><a href="/outils" class="avatar" title="Warframe tools" aria-label="Warframe tools">◈</a></header></div>`;
  }
  return `<div class="topwrap"><header class="topbar"><a href="/" class="brand"><span class="logo">◆</span> VoidRelay</a><div class="search"><span>🔎</span><input type="search" id="vr-search" class="vr-search-input" placeholder="Rechercher un objet, un build…" aria-label="Rechercher un objet Warframe" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="vr-search-results" aria-autocomplete="list"><kbd>K</kbd><div class="vr-search-results" id="vr-search-results" role="listbox" aria-label="Résultats de recherche" hidden></div></div><nav class="topnav"><div class="topnav-search"><input type="search" id="vr-search-m" class="vr-search-input" placeholder="Rechercher un objet…" aria-label="Rechercher un objet Warframe" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="vr-search-results-m" aria-autocomplete="list"><div class="vr-search-results" id="vr-search-results-m" role="listbox" aria-label="Résultats de recherche" hidden></div></div><a href="/">Accueil</a><a href="/voie-du-platine/">La Voie du Platine</a><a href="/builds/">Builds</a><a href="/warframes/">Warframes</a><a href="/armes/">Armes</a><a href="/compagnons/">Compagnons</a><a href="/ressources/">Ressources</a><a href="/arcanes/">Arcanes</a><a href="/guides/" class="cur">Guides</a><a href="/skins/">Skins</a><a href="/o/">Objets</a><a href="/hub">Tableau de bord</a><a href="/outils">Outils</a><a href="/faq">FAQ</a></nav><button class="navburger" id="navburger" type="button" aria-label="Menu" aria-expanded="false">&#9776;</button>
<button class="themebtn" id="themebtn" type="button" aria-label="Basculer le thème" title="Thème sombre / clair">☾</button><a href="/outils" class="avatar" title="Outils Warframe" aria-label="Outils Warframe">◈</a></header></div>`;
}
function siteFooter(lang = "fr") {
  if (lang === "en") {
    return `<footer class="foot"><div class="in"><div><span class="brand" style="color:#fff"><span class="logo">◆</span> VoidRelay</span><div style="font-size:.85rem;margin-top:6px">Unofficial Warframe hub — fan-made, free.</div></div><div class="links" style="font-size:.9rem"><a href="/en/platinum-path/">Platinum Path</a><a href="/en/builds/">Builds</a><a href="/en/o/">Items</a><a href="/en/guides/">Guides</a><a href="/en/tools">Tools</a><a href="/hub">Dashboard</a><a href="/faq-en">FAQ</a><a href="/a-propos">About</a></div></div><div class="in" style="padding-top:0;font-size:.8rem;color:#8294ab">"Warframe" is a trademark of Digital Extremes. Prices: warframe.market. · <a href="/confidentialite">Privacy</a> · <a href="/mentions-legales">Legal</a></div></footer>`;
  }
  return `<footer class="foot"><div class="in"><div><span class="brand" style="color:#fff"><span class="logo">◆</span> VoidRelay</span><div style="font-size:.85rem;margin-top:6px">Hub Warframe non officiel — fan-made, gratuit.</div></div><div class="links" style="font-size:.9rem"><a href="/voie-du-platine/">La Voie</a><a href="/builds/">Builds</a><a href="/guides/">Guides</a><a href="/skins/">Skins</a><a href="/o/">Objets</a><a href="/hub">Tableau de bord</a><a href="/faq">FAQ</a><a href="/a-propos">À propos</a><a href="mailto:contact@voidrelay.fr">Feedback</a></div></div><div class="in" style="padding-top:0;font-size:.8rem;color:#8294ab">« Warframe » est une marque de Digital Extremes. Prix : warframe.market. · <a href="/confidentialite">Confidentialité</a> · <a href="/mentions-legales">Mentions légales</a></div></footer>`;
}
// Bascule sombre/clair + repli du menu mobile (fin de <body>).
const THEME_SCRIPTS = `<script>(function(){var b=document.getElementById("themebtn");if(!b)return;function ic(){b.textContent=document.documentElement.getAttribute("data-theme")==="dark"?"☾":"☀";}ic();b.onclick=function(){var t=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("vr-theme",t)}catch(e){}ic();};})();</script><script defer src="/js/nav-toggle.js"></script><script defer src="/js/search.js"></script><script defer src="/js/warp.js"></script>`;
// Bascule seule (16/07/2026) pour les gabarits .vrtop (pages /o/, index, catégories) :
// pas de burger sur ce header, et search.js y est déjà inclus par ailleurs.
const THEME_TOGGLE_ONLY = `<script>(function(){var b=document.getElementById("themebtn");if(!b)return;function ic(){b.textContent=document.documentElement.getAttribute("data-theme")==="dark"?"☾":"☀";}ic();b.onclick=function(){var t=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("vr-theme",t)}catch(e){}ic();};})();</script>`;

/* Cloudflare Web Analytics (10/07/2026) — PAS de snippet manuel ici : l'analytics est
 * injecté automatiquement par Cloudflare au niveau de la zone (dashboard → Web Analytics
 * → "Automatic setup"), avant même que le HTML ne parte du serveur. Un <script> collé dans
 * les pages ferait doublon (double comptage) ou du bruit. Le 09/07/2026, un motif de
 * beacon manuel "inerte" (token jamais collé) avait été étendu à ~3900 pages en supposant
 * l'analytics non installé — en réalité il tournait déjà, mais filtrait les visiteurs UE
 * (donc zéro donnée FR, symptôme identique à "pas installé"). Retiré le 10/07/2026 une
 * fois le filtre UE corrigé côté dashboard. Si l'auto-injection devait un jour être
 * désactivée, vérifier D'ABORD son état réel dans le dashboard avant de recâbler quoi
 * que ce soit à la main. */

function header(lang = "fr") {
  // Recherche instantanée (16/07/2026) : même widget js/search.js que le header pandaahh,
  // libellés selon la langue de la page (les messages du dropdown suivent <html lang> côté JS).
  const ph = lang === "en" ? "Search an item or build…" : "Rechercher un objet, un build…";
  const al = lang === "en" ? "Search a Warframe item" : "Rechercher un objet Warframe";
  const rl = lang === "en" ? "Search results" : "Résultats de recherche";
  // Nav vrnav traduite pour les pages EN (16/07/2026, décision de l'admin) — liens vers les
  // sections EN quand elles existent (/en/o/, /en/builds/, /en/guides/, /faq-en) ;
  // Deals reste /bons-plans (page FR-only, même précédent que les bas de page EN).
  // « Vous êtes ici » (16/07/2026) : toutes les pages servies par ce header sont dans la
  // section Objets → même convention class="cur" que la topnav pandaahh (.vrnav a.cur).
  const nav = lang === "en"
    ? `<a href="/en/">Home</a><a href="/en/platinum-path/">Platinum Path</a> <a href="/hub">Dashboard</a> <a href="/en/o/" class="cur">Items</a> <a href="/en/builds/">Builds</a> <a href="/bons-plans">Deals</a> <a href="/en/guides/">Guides</a> <a href="/faq-en">FAQ</a>`
    : `<a href="/">Accueil</a> <a href="/hub">Tableau de bord</a> <a href="/o/" class="cur">Objets</a> <a href="/builds/">Builds</a> <a href="/bons-plans">Bons plans</a> <a href="/guides/">Guides</a> <a href="/faq">FAQ</a>`;
  const brandHref = lang === "en" ? "/en/" : "/";
  const tb = lang === "en"
    ? `<button class="themebtn" id="themebtn" type="button" aria-label="Toggle theme" title="Dark / light theme">☾</button>`
    : `<button class="themebtn" id="themebtn" type="button" aria-label="Basculer le thème" title="Thème sombre / clair">☾</button>`;
  return `<header class="vrtop"><a href="${brandHref}" class="brand">◆ VoidRelay</a><nav class="vrnav">${nav}</nav><div class="vrsearch"><input type="search" id="vr-search" class="vr-search-input" placeholder="${ph}" aria-label="${al}" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="vr-search-results" aria-autocomplete="list"><div class="vr-search-results" id="vr-search-results" role="listbox" aria-label="${rl}" hidden></div></div>${tb}</header>`;
}
function footer(lang = "fr") {
  if (lang === "en") {
    return `<footer class="ftr"><p class="muted">VoidRelay — unofficial Warframe dashboard. Prices: <a href="https://warframe.market" target="_blank" rel="noopener noreferrer nofollow">warframe.market</a>. "Warframe" is a trademark of Digital Extremes.</p><p class="muted"><a href="/en/guides/">Guides</a> · <a href="/outils">Tools</a> · <a href="/a-propos">About</a> · <a href="/confidentialite">Privacy</a> · <a href="/mentions-legales">Legal</a> · <a href="/faq-en">FAQ</a></p></footer>`;
  }
  return `<footer class="ftr"><p class="muted">VoidRelay — tableau de bord Warframe non officiel. Prix : <a href="https://warframe.market" target="_blank" rel="noopener noreferrer nofollow">warframe.market</a>. « Warframe » est une marque de Digital Extremes.</p><p class="muted"><a href="/guides/">Guides</a> · <a href="/outils">Outils</a> · <a href="/a-propos">À propos</a><a href="mailto:contact@voidrelay.fr">Feedback</a> · <a href="/confidentialite">Confidentialité</a> · <a href="/mentions-legales">Mentions légales</a> · <a href="/faq">FAQ</a></p></footer>`;
}
function shareBar(discord) {
  return `<div class="sharebar" data-share><span class="muted">Partager :</span><button class="sbtn" data-net="x">𝕏</button><button class="sbtn" data-net="reddit">Reddit</button>${discord ? '<button class="sbtn" data-net="discord">Copier pour Discord</button>' : ''}<button class="sbtn" data-net="copy">Copier le lien</button></div>`;
}
function shareBarEn(discord) {
  return `<div class="sharebar" data-share><span class="muted">Share:</span><button class="sbtn" data-net="x">𝕏</button><button class="sbtn" data-net="reddit">Reddit</button>${discord ? '<button class="sbtn" data-net="discord">Copy for Discord</button>' : ''}<button class="sbtn" data-net="copy">Copy link</button></div>`;
}

function related(it) {
  const g = groupKey(it.tags);
  const pool = byGroup.get(g) || [];
  const i = pool.findIndex(x => x.slug === it.slug);
  const out = [];
  for (let d = 1; out.length < 8 && d < pool.length; d++) {
    if (pool[i + d]) out.push(pool[i + d]);
    if (pool[i - d] && out.length < 8) out.push(pool[i - d]);
  }
  return out;
}

/* Pages FR (21/10/2026) : le nom français officiel (catalogue WFCD) s'affiche en titre, le nom
   anglais — celui de warframe.market, de l'URL, du <title> et des données structurées — reste
   en petit dessous. <title>, description, URL, FAQ et fil d'Ariane ne changent pas : la fiche
   reste trouvable par le nom du marché ; le nom FR est ajouté en `alternateName` (schema.org).
   Sans nom FR dans le catalogue, rien ne change sur la page. */
const CSS_NOMS_FR_FICHE = `<style>.objhead h1 .en,.rel .t .en{display:block;font-size:.62em;font-weight:400;color:var(--muted,#8294ab)}</style>
`;
const CSS_NOMS_FR_LISTE = `.idxlinks a .en{font-size:.78em;color:var(--muted,#8294ab);margin-left:.1em}`;
// Tri des listes FR sur le nom AFFICHÉ (français s'il existe) : « Vitalité Améliorée » se range
// à V, pas à E comme « Enhanced Vitality ».
// Seuls les mods et arcanes ont vocation à être dans le catalogue FR : les pièces Prime, reliques,
// etc. ne sont pas comptées comme « sans nom FR » dans le rapport de génération.
const estModOuArcane = tags => (tags || []).includes("mod") || (tags || []).includes("arcane_enhancement");
const nomAffiche = it => nomFr(it.name, false) || it.name;
const triFr = (a, b) => nomAffiche(a).localeCompare(nomAffiche(b), "fr");
function itemPage(it) {
  const name = it.name, slug = it.slug, tl = typeLabel(it.tags), url = `${SITE}/o/${slug}`;
  const title = `Prix de ${name} — Warframe : platine & ducats | VoidRelay`;
  const desc = `Prix de ${name} (${tl}) sur Warframe Market en direct : platine, vente la plus basse, volume et tendance. Estimation pour vendre ou acheter au bon prix.`;
  const img = localImg(slug) || it.img || "";
  // og:image / twitter:image / JSON-LD "image" doivent être des URLs absolues (les crawlers
  // sociaux ne résolvent pas fiablement un chemin relatif comme "/assets/objets/x.png").
  // NB : cette même correction a été appliquée directement sur les pages déjà générées via
  // scripts/patch_og_twitter_ponctuel.mjs (09/07/2026), pour ne pas re-régénérer o/ en entier
  // (le générateur régénère aussi guides/ et en/guides/ depuis guides_content.mjs, qui ne
  // connaît pas les fiches ajoutées à la main comme guides/fragments-archontes.html — relancer
  // ce script SANS d'abord synchroniser guides_content.mjs supprimerait ces pages).
  const imgAbs = img ? (/^https?:\/\//.test(img) ? img : SITE + img) : "";
  const rel = related(it);
  // AEO (09/07/2026) : répond à "combien coûte X ?" dès la 1re phrase, avant le descriptif
  // (lore/usage). Même correction appliquée directement aux pages déjà générées via
  // scripts/patch_aeo_intro_ponctuel.mjs (pas de régénération complète, cf. leçon guides).
  const de = /^[aeiouhAEIOUH]/.test(name) ? "d’" : "de ";
  const intro = `Le prix ${de}${name} s’affiche en direct ci-dessus (médiane, vente la plus basse, tendance), mis à jour en continu sur Warframe Market. ` + describe(name, it.tags);
  const badges = [tl, rarityFr(it.tags), eraName(it.tags) && ("Relique " + eraName(it.tags)), it.tags.includes("prime") && !tl.includes("Prime") && "Prime"].filter(Boolean);
  const ld = [
    { "@context": "https://schema.org", "@type": "Thing", name, ...(nomFr(name, false) ? { alternateName: nomFr(name, false) } : {}), ...(imgAbs ? { image: imgAbs } : {}), category: tl, url, sameAs: `https://warframe.market/items/${slug}`, description: intro, brand: { "@type": "Brand", name: "Warframe" } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Objets", item: SITE + "/o/" },
      { "@type": "ListItem", position: 3, name, item: url } ] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [
      { "@type": "Question", name: `Combien vaut ${name} sur Warframe ?`, acceptedAnswer: { "@type": "Answer", text: `Le prix de ${name} se mesure en platine sur Warframe Market et évolue selon l'offre et la demande. Le prix médian, la vente la plus basse et le volume des dernières 48 h sont affichés en direct sur cette page.` } },
      { "@type": "Question", name: `Comment vendre ${name} ?`, acceptedAnswer: { "@type": "Answer", text: `Place un ordre de vente sur Warframe Market au prix médian (ou légèrement en dessous pour vendre vite), puis échange en jeu via la messagerie. ${name} est un(e) ${tl}.` } },
      { "@type": "Question", name: `Où obtenir ${name} ?`, acceptedAnswer: { "@type": "Answer", text: `${name} s'obtient en jeu (drop, reliques Void, boutique ou événement selon le type) puis s'échange entre joueurs. Consulte le tableau de bord VoidRelay pour les reliques et le farm du moment.` } } ] }
  ];
  const faqHtml = `<section class="faq"><h2>Questions fréquentes</h2>
<details open><summary>Combien vaut ${esc(name)} ?</summary><p>${esc(name)} vaut <span id="faq-prix-val">le prix affiché ci-dessus</span>. Le prix du platine bouge selon l'offre et la demande — vérifie la valeur en direct en haut de page.</p></details>
<details><summary>Comment vendre ${esc(name)} ?</summary><p>Place un ordre de vente sur Warframe Market au prix médian (ou un peu en dessous pour vendre vite), puis échange en jeu. ${esc(name)} est un(e) ${esc(tl).toLowerCase()}.</p></details>
<details><summary>Où obtenir ${esc(name)} ?</summary><p>${esc(name)} s'obtient en jeu (drop, reliques Void, boutique ou événement selon le type) puis s'échange entre Tenno. Vois les <a href="/hub">reliques & le farm du moment</a>.</p></details></section>`;

  // hreflang réciproque uniquement si l'objet fait partie du lot EN restreint
  // (data/en_objects_selection.json) : pas de lien mort vers une page qui n'existe pas.
  const hasEn = EN_OBJECTS_SELECTION.has(slug);
  const enUrl = `${SITE}/en/o/${slug}`;
  const hreflangObjet = hasEn ? `<link rel="alternate" hreflang="fr" href="${url}"><link rel="alternate" hreflang="en" href="${enUrl}"><link rel="alternate" hreflang="x-default" href="${url}">` : "";

  return `<!DOCTYPE html><html lang="fr"><head>${THEME_BOOT}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${HEAD_CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff"><meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">${hreflangObjet}
<meta name="robots" content="index, follow, max-image-preview:large"><meta name="author" content="VoidRelay"><meta name="theme-color" content="#0b0f14">
<link rel="icon" href="${FAVICON}"><link rel="stylesheet" href="/css/style.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="preconnect" href="https://voidrelay-prix.vercel.app"><link rel="dns-prefetch" href="https://api.warframe.market"><link rel="dns-prefetch" href="https://warframe.market">
<meta property="og:type" content="product"><meta property="og:site_name" content="VoidRelay"><meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc("Prix de " + name + " — Warframe")}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">${imgAbs ? `<meta property="og:image" content="${esc(imgAbs)}">` : ""}
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc("Prix de " + name + " — Warframe")}"><meta name="twitter:description" content="${esc(desc)}">${imgAbs ? `<meta name="twitter:image" content="${esc(imgAbs)}">` : ""}
<script type="application/ld+json">${jstr(ld)}</script>
${(nomFr(name, false) || rel.some(r => nomFr(r.name, false))) ? CSS_NOMS_FR_FICHE : ""}</head><body>
${header()}
<main id="objet" data-slug="${esc(slug)}" class="wrap">
<nav class="bc" aria-label="fil d'Ariane"><a href="/">Accueil</a> › <a href="/o/">Objets</a> › <span>${esc(name)}</span></nav>
<div class="objhead">${img ? `<img class="objimg" src="${esc(img)}" alt="${esc(name)}" width="96" height="96" loading="lazy" onerror="this.onerror=null;this.src='/assets/objets/_unknown.png'">` : ""}<div><h1>${nomBilingue(name, { suivre: estModOuArcane(it.tags) })} — prix Warframe en direct</h1><p class="sub">${esc(tl)} · prix du platine sur Warframe Market, mis à jour en continu.</p></div></div>
<div class="objbadges">${badges.map(b => `<span class="badge">${esc(b)}</span>`).join("")}</div>
<p class="objdesc">${esc(intro)}</p>
<section class="card pad" id="px-wrap" aria-live="polite">
<div class="kv"><span class="k">Prix médian</span><span class="v"><b id="px-median">…</b></span></div>
<div class="kv"><span class="k">Vente la plus basse</span><span class="v"><b id="px-min">…</b></span></div>
<div class="kv"><span class="k">Volume</span><span class="v"><b id="px-vol">…</b></span></div>
<div class="kv"><span class="k">Tendance</span><span class="v"><b id="px-trend">…</b></span></div>
<div class="kv"><span class="k">Ducats</span><span class="v"><b id="px-ducats">…</b></span></div>
<div id="px-spark" class="vrspark"></div>
<p class="muted" id="px-updated"></p>
</section>
${it.tags.includes("set") ? `<section class="card pad" id="set-compare" style="min-height:140px"><p class="muted">Comparatif pièces / set en cours de chargement…</p></section>` : ""}
${shareBar(true)}
${faqHtml}
<section><h2>Objets similaires</h2><div class="grid cols-auto rel">${rel.map(r => `<a class="card tile" href="/o/${esc(r.slug)}"><div class="t">${nomBilingue(r.name, { suivre: false })}</div><div class="d muted">${esc(typeLabel(r.tags))}</div></a>`).join("")}</div></section>
<p class="muted"><a href="/o/">← Tous les objets Warframe</a>${(bl => bl ? ` · <a href="/builds/${bl.slug}">⚙️ Build ${esc(bl.base)}</a>` : "")(buildSlugFor(name))}${objGuideLinks(name, "fr")} · <a href="/hub">Tableau de bord live</a> · <a href="/faq">FAQ</a>${hasEn ? ` · <a href="${enUrl}">English version</a>` : ""}</p>
</main>
${footer()}
<script defer src="/js/objet.js"></script>
<script defer src="/js/share.js"></script>
<script defer src="/js/search.js"></script><script defer src="/js/warp.js"></script>${THEME_TOGGLE_ONLY}
</body></html>`;
}

function itemPageEn(it) {
  const name = it.name, slug = it.slug, tl = typeLabelEn(it.tags), url = `${SITE}/en/o/${slug}`, frUrl = `${SITE}/o/${slug}`;
  const title = `${name} Price — Warframe: Platinum & Ducats | VoidRelay`;
  const desc = `Live ${name} price (${tl}) on Warframe Market: platinum, lowest sale, volume and trend. Know the right price before you buy or sell.`;
  const img = localImg(slug) || it.img || "";
  const imgAbs = img ? (/^https?:\/\//.test(img) ? img : SITE + img) : "";
  const rel = related(it);
  const intro = `${name}'s price is shown live above (median, lowest sale, trend), updated continuously from Warframe Market. ` + describeEn(name, it.tags);
  const badges = [tl, rarityEn(it.tags), eraName(it.tags) && (eraName(it.tags) + " Relic"), it.tags.includes("prime") && !tl.includes("Prime") && "Prime"].filter(Boolean);
  const hl = `<link rel="alternate" hreflang="en" href="${url}"><link rel="alternate" hreflang="fr" href="${frUrl}"><link rel="alternate" hreflang="x-default" href="${frUrl}">`;
  const ld = [
    { "@context": "https://schema.org", "@type": "Thing", name, ...(imgAbs ? { image: imgAbs } : {}), category: tl, url, sameAs: `https://warframe.market/items/${slug}`, description: intro, brand: { "@type": "Brand", name: "Warframe" } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/en/" },
      { "@type": "ListItem", position: 2, name: "Items", item: SITE + "/en/o/" },
      { "@type": "ListItem", position: 3, name, item: url } ] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [
      { "@type": "Question", name: `How much is ${name} worth in Warframe?`, acceptedAnswer: { "@type": "Answer", text: `${name}'s price is measured in platinum on Warframe Market and moves with supply and demand. The median price, lowest sale and 48-hour volume are shown live on this page.` } },
      { "@type": "Question", name: `How do you sell ${name}?`, acceptedAnswer: { "@type": "Answer", text: `Place a sell order on Warframe Market at the median price (or slightly below to sell fast), then trade in-game via chat. ${name} is a ${tl.toLowerCase()}.` } },
      { "@type": "Question", name: `Where do you get ${name}?`, acceptedAnswer: { "@type": "Answer", text: `${name} is obtained in-game (drop, Void relics, shop or event depending on type) then traded between players. Check the VoidRelay dashboard for current relics and farming spots.` } } ] }
  ];
  const faqHtml = `<section class="faq"><h2>Frequently asked questions</h2>
<details open><summary>How much is ${esc(name)} worth?</summary><p>${esc(name)} is worth <span id="faq-prix-val">the price shown above</span>. Platinum prices move with supply and demand — check the live value at the top of the page.</p></details>
<details><summary>How do you sell ${esc(name)}?</summary><p>Place a sell order on Warframe Market at the median price (or a bit below to sell fast), then trade in-game. ${esc(name)} is a ${esc(tl).toLowerCase()}.</p></details>
<details><summary>Where do you get ${esc(name)}?</summary><p>${esc(name)} is obtained in-game (drop, Void relics, shop or event depending on type) then traded between Tenno. See <a href="/hub">current relics & farming spots</a>.</p></details></section>`;

  return `<!DOCTYPE html><html lang="en"><head>${THEME_BOOT}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${HEAD_CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff"><meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">${hl}
<meta name="robots" content="index, follow, max-image-preview:large"><meta name="author" content="VoidRelay"><meta name="theme-color" content="#0b0f14">
<link rel="icon" href="${FAVICON}"><link rel="stylesheet" href="/css/style.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="preconnect" href="https://voidrelay-prix.vercel.app"><link rel="dns-prefetch" href="https://api.warframe.market"><link rel="dns-prefetch" href="https://warframe.market">
<meta property="og:type" content="product"><meta property="og:site_name" content="VoidRelay"><meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(name + " Price — Warframe")}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">${imgAbs ? `<meta property="og:image" content="${esc(imgAbs)}">` : ""}
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(name + " Price — Warframe")}"><meta name="twitter:description" content="${esc(desc)}">${imgAbs ? `<meta name="twitter:image" content="${esc(imgAbs)}">` : ""}
<script type="application/ld+json">${jstr(ld)}</script>
</head><body>
${header("en")}
<main id="objet" data-slug="${esc(slug)}" class="wrap">
<nav class="bc" aria-label="breadcrumb"><a href="/en/">Home</a> › <a href="/en/o/">Items</a> › <span>${esc(name)}</span></nav>
<div class="objhead">${img ? `<img class="objimg" src="${esc(img)}" alt="${esc(name)}" width="96" height="96" loading="lazy" onerror="this.onerror=null;this.src='/assets/objets/_unknown.png'">` : ""}<div><h1>${esc(name)} — live Warframe price</h1><p class="sub">${esc(tl)} · platinum price on Warframe Market, updated continuously.</p></div></div>
<div class="objbadges">${badges.map(b => `<span class="badge">${esc(b)}</span>`).join("")}</div>
<p class="objdesc">${esc(intro)}</p>
<section class="card pad" id="px-wrap" aria-live="polite">
<div class="kv"><span class="k">Median price</span><span class="v"><b id="px-median">…</b></span></div>
<div class="kv"><span class="k">Lowest sale</span><span class="v"><b id="px-min">…</b></span></div>
<div class="kv"><span class="k">Volume</span><span class="v"><b id="px-vol">…</b></span></div>
<div class="kv"><span class="k">Trend</span><span class="v"><b id="px-trend">…</b></span></div>
<div class="kv"><span class="k">Ducats</span><span class="v"><b id="px-ducats">…</b></span></div>
<div id="px-spark" class="vrspark"></div>
<p class="muted" id="px-updated"></p>
</section>
${it.tags.includes("set") ? `<section class="card pad" id="set-compare" style="min-height:140px"><p class="muted">Loading parts / set comparison…</p></section>` : ""}
${shareBarEn(true)}
${faqHtml}
<section><h2>Similar items</h2><div class="grid cols-auto rel">${rel.map(r => `<a class="card tile" href="/o/${esc(r.slug)}"><div class="t">${esc(r.name)}</div><div class="d muted">${esc(typeLabel(r.tags))}</div></a>`).join("")}</div></section>
<p class="muted"><a href="/en/o/">← All Warframe items</a>${(bl => bl ? ` · <a href="/en/builds/${bl.slug}">⚙️ ${esc(bl.base)} build</a>` : "")(buildSlugFor(name))}${objGuideLinks(name, "en")} · <a href="/hub">Live dashboard</a> · <a href="/faq-en">FAQ</a> · <a href="${frUrl}">Version française</a></p>
</main>
${footer("en")}
<script defer src="/js/objet.js"></script>
<script defer src="/js/share.js"></script>
<script defer src="/js/search.js"></script><script defer src="/js/warp.js"></script>${THEME_TOGGLE_ONLY}
</body></html>`;
}

function indexPage() {
  const groups = [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length);
  const total = cat.length;
  const sections = groups.map(([g, arr]) => {
    const links = arr.slice().sort(triFr).map(it => {
      const im = localImg(it.slug) || it.img || "";
      const icon = im ? `<img src="${esc(im)}" alt="" width="28" height="28" loading="lazy" onerror="this.onerror=null;this.src='/assets/objets/_unknown.png'">` : "";
      return `<a href="/o/${esc(it.slug)}">${icon}${nomBilingue(it.name, { suivre: estModOuArcane(it.tags) })}</a>`;
    }).join("");
    return `<section class="idxgrp"><h2><a href="/o/c/${slugify(g)}">${esc(g)}</a> <span class="muted">(${arr.length})</span></h2><div class="idxlinks">${links}</div></section>`;
  }).join("");
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: "Tous les objets Warframe — prix platine", url: SITE + "/o/", description: `Annuaire des ${total} objets Warframe échangeables avec leur prix en platine en direct.` },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Objets", item: SITE + "/o/" } ] },
    { "@context": "https://schema.org", "@type": "Dataset", name: "Prix des objets Warframe (platine)", description: `Prix du platine en direct (médian, vente la plus basse, volume 48 h, tendance) pour ${total} objets Warframe échangeables, agrégés depuis warframe.market.`, url: SITE + "/o/", keywords: ["Warframe", "prix", "platine", "platinum price", "warframe.market", "ducats"], isAccessibleForFree: true, creator: { "@type": "Organization", name: "VoidRelay", url: SITE + "/" }, license: "https://creativecommons.org/licenses/by/4.0/" }
  ];
  return `<!DOCTYPE html><html lang="fr"><head>${THEME_BOOT}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${HEAD_CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff"><meta name="referrer" content="strict-origin-when-cross-origin">
<title>Prix des objets Warframe (platine & ducats) — ${total} objets | VoidRelay</title>
<meta name="description" content="Annuaire des ${total} objets Warframe échangeables : prix du platine en direct, mods, Prime, arcanes, reliques et rivens. Cherche et compare les prix.">
<link rel="canonical" href="${SITE}/o/">${EN_OBJECTS_SELECTION.size ? `<link rel="alternate" hreflang="fr" href="${SITE}/o/"><link rel="alternate" hreflang="en" href="${SITE}/en/o/"><link rel="alternate" hreflang="x-default" href="${SITE}/o/">` : ""}<meta name="robots" content="index, follow, max-image-preview:large"><meta name="theme-color" content="#0b0f14">
<link rel="icon" href="${FAVICON}"><link rel="stylesheet" href="/css/style.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="VoidRelay"><meta property="og:title" content="Prix des objets Warframe — ${total} objets"><meta property="og:url" content="${SITE}/o/">
<script type="application/ld+json">${jstr(ld)}</script>
<style>${CSS_NOMS_FR_LISTE}.idxlinks{display:flex;flex-wrap:wrap;gap:.5rem .8rem}.idxlinks a{font-size:.9rem;display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .5rem .25rem .25rem;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);color:var(--gold-2)}.idxlinks a:hover{border-color:var(--line-2)}.idxlinks img{width:28px;height:28px;object-fit:contain;border-radius:5px;background:var(--bg2);flex:none}.idxgrp{margin:1.4rem 0}#oq{width:100%;max-width:480px;padding:.6rem .8rem;margin:.5rem 0 1rem;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:inherit}</style>
</head><body>
${header()}
<main class="wrap">
<nav class="bc"><a href="/">Accueil</a> › <span>Objets</span></nav>
<h1>Prix des objets Warframe en direct</h1>
<p class="sub">${total} objets échangeables — clique un objet pour son prix en platine (médian, vente mini, volume, tendance), mis à jour en continu via Warframe Market.</p>
<p class="muted" style="margin:6px 0 0">🌐 Envie de tout voir d'un coup avec les prix en temps réel ? <a href="/marche-complet">Tout le marché en direct →</a></p>
<input id="oq" type="search" data-vr-suggest placeholder="Filtrer un objet (ex : Mirage Prime, Serration…)" aria-label="Filtrer les objets">
${sections}
</main>
${footer()}
<script>
const q=document.getElementById('oq');function filtrer(){const v=q.value.trim().toLowerCase();document.querySelectorAll('.idxgrp').forEach(g=>{let any=false;g.querySelectorAll('.idxlinks a').forEach(a=>{const m=!v||a.textContent.toLowerCase().includes(v);a.style.display=m?'':'none';if(m)any=true;});g.style.display=any?'':'none';});}q.addEventListener('input',filtrer);const qp=new URLSearchParams(location.search).get('q');if(qp){q.value=qp;filtrer();}
</script>
<script defer src="/js/share.js"></script>
<script defer src="/js/search.js"></script><script defer src="/js/warp.js"></script>${THEME_TOGGLE_ONLY}
</body></html>`;
}

function indexPageEn(selectedItems) {
  const total = selectedItems.length;
  const groupsEn = new Map();
  for (const it of selectedItems) {
    const g = groupKey(it.tags);
    if (!groupsEn.has(g)) groupsEn.set(g, []);
    groupsEn.get(g).push(it);
  }
  const groups = [...groupsEn.entries()].sort((a, b) => b[1].length - a[1].length);
  const sections = groups.map(([g, arr]) => {
    const links = arr.slice().sort((a, b) => a.name.localeCompare(b.name)).map(it => {
      const im = localImg(it.slug) || it.img || "";
      const icon = im ? `<img src="${esc(im)}" alt="" width="28" height="28" loading="lazy" onerror="this.onerror=null;this.src='/assets/objets/_unknown.png'">` : "";
      return `<a href="/en/o/${esc(it.slug)}">${icon}${esc(it.name)}</a>`;
    }).join("");
    return `<section class="idxgrp"><h2>${esc(GROUP_LABEL_EN[g] || g)} <span class="muted">(${arr.length})</span></h2><div class="idxlinks">${links}</div></section>`;
  }).join("");
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: "Warframe Item Prices — Platinum", url: SITE + "/en/o/", description: `Directory of the ${total} most actively traded Warframe items, with live platinum prices.` },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/en/" },
      { "@type": "ListItem", position: 2, name: "Items", item: SITE + "/en/o/" } ] },
    { "@context": "https://schema.org", "@type": "Dataset", name: "Warframe item prices (platinum)", description: `Live platinum prices (median, lowest sale, 48h volume, trend) for the ${total} most-traded Warframe items, aggregated from warframe.market.`, url: SITE + "/en/o/", keywords: ["Warframe", "price", "platinum price", "warframe.market", "ducats"], isAccessibleForFree: true, creator: { "@type": "Organization", name: "VoidRelay", url: SITE + "/" }, license: "https://creativecommons.org/licenses/by/4.0/" }
  ];
  return `<!DOCTYPE html><html lang="en"><head>${THEME_BOOT}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${HEAD_CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff"><meta name="referrer" content="strict-origin-when-cross-origin">
<title>Warframe Item Prices (Platinum & Ducats) — ${total} items | VoidRelay</title>
<meta name="description" content="Directory of the ${total} most actively traded Warframe items: live platinum prices, mods, Prime, arcanes, relics and rivens. Search and compare prices.">
<link rel="canonical" href="${SITE}/en/o/"><link rel="alternate" hreflang="en" href="${SITE}/en/o/"><link rel="alternate" hreflang="fr" href="${SITE}/o/"><link rel="alternate" hreflang="x-default" href="${SITE}/o/"><meta name="robots" content="index, follow, max-image-preview:large"><meta name="theme-color" content="#0b0f14">
<link rel="icon" href="${FAVICON}"><link rel="stylesheet" href="/css/style.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="VoidRelay"><meta property="og:locale" content="en_US"><meta property="og:title" content="Warframe Item Prices — ${total} items"><meta property="og:url" content="${SITE}/en/o/">
<script type="application/ld+json">${jstr(ld)}</script>
<style>.idxlinks{display:flex;flex-wrap:wrap;gap:.5rem .8rem}.idxlinks a{font-size:.9rem;display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .5rem .25rem .25rem;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);color:var(--gold-2)}.idxlinks a:hover{border-color:var(--line-2)}.idxlinks img{width:28px;height:28px;object-fit:contain;border-radius:5px;background:var(--bg2);flex:none}.idxgrp{margin:1.4rem 0}#oq{width:100%;max-width:480px;padding:.6rem .8rem;margin:.5rem 0 1rem;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:inherit}</style>
</head><body>
${header("en")}
<main class="wrap">
<nav class="bc"><a href="/en/">Home</a> › <span>Items</span></nav>
<h1>Live Warframe item prices</h1>
<p class="sub">The ${total} most actively traded items — click one for its platinum price (median, lowest sale, volume, trend), updated continuously via Warframe Market. Looking for something else? <a href="/o/">Browse all ${cat.length} items (French)</a>.</p>
<input id="oq" type="search" data-vr-suggest placeholder="Filter an item (e.g. Mirage Prime, Serration…)" aria-label="Filter items">
${sections}
</main>
${footer("en")}
<script>
const q=document.getElementById('oq');function filtrer(){const v=q.value.trim().toLowerCase();document.querySelectorAll('.idxgrp').forEach(g=>{let any=false;g.querySelectorAll('.idxlinks a').forEach(a=>{const m=!v||a.textContent.toLowerCase().includes(v);a.style.display=m?'':'none';if(m)any=true;});g.style.display=any?'':'none';});}q.addEventListener('input',filtrer);const qp=new URLSearchParams(location.search).get('q');if(qp){q.value=qp;filtrer();}
</script>
<script defer src="/js/share.js"></script>
<script defer src="/js/search.js"></script><script defer src="/js/warp.js"></script>${THEME_TOGGLE_ONLY}
</body></html>`;
}

const FR2EN = new Map(GUIDES_EN.map(g => [g.fr, g.slug]));
function hreflangFor(frUrl, enSlug) {
  if (!enSlug) return "";
  return `<link rel="alternate" hreflang="fr" href="${frUrl}"><link rel="alternate" hreflang="en" href="${SITE}/en/guides/${enSlug}"><link rel="alternate" hreflang="x-default" href="${frUrl}">`;
}
/* ---- Maillage guides → builds (16/07/2026) : chaque guide liste les builds que son texte
   mentionne réellement — même logique d'appariement que le sens inverse (generer_builds.mjs) :
   nom en limites de mots, le nom LONG gagne sur le court (« Mesa Prime » avale « Mesa »),
   garde « New War ». Source des noms : data/builds_index.json (749 fiches). ---- */
/* ---- Maillage objets → guides (16/07/2026) : les pages /o/ pointent vers les guides qui
   mentionnent réellement l'objet (nom complet, ou sans le suffixe « Set » pour les sets).
   Même corpus et même prudence que le maillage builds. Cap 2 (pages denses). ---- */
const GUIDE_TEXTS = { fr: null, en: null };
function guideCorpus(lang) {
  if (GUIDE_TEXTS[lang]) return GUIDE_TEXTS[lang];
  const strip = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const out = [];
  if (lang === "fr") {
    for (const g of GUIDES) out.push({ url: `/guides/${g.slug}`, h1: g.h1, text: strip(g.h1 + " " + g.desc + " " + g.body) });
    for (const m of GUIDES_FAITS_MAIN) {
      try {
        const html = fs.readFileSync(path.join(ROOT, "guides", m.slug + ".html"), "utf8");
        out.push({ url: `/guides/${m.slug}`, h1: m.h1, text: strip((html.match(/<main[\s\S]*?<\/main>/) || [html])[0]) });
      } catch (e) {}
    }
  } else {
    for (const g of GUIDES_EN) out.push({ url: `/en/guides/${g.slug}`, h1: g.h1, text: strip(g.h1 + " " + g.desc + " " + g.body) });
    for (const m of GUIDES_FAITS_MAIN_EN) {
      try {
        const html = fs.readFileSync(path.join(ROOT, "en", "guides", m.slug + ".html"), "utf8");
        out.push({ url: `/en/guides/${m.slug}`, h1: m.h1, text: strip((html.match(/<main[\s\S]*?<\/main>/) || [html])[0]) });
      } catch (e) {}
    }
  }
  return (GUIDE_TEXTS[lang] = out);
}
function objGuideLinks(name, lang) {
  const variants = [name];
  if (/\sSet$/i.test(name)) variants.push(name.replace(/\s+Set$/i, ""));
  const corpus = guideCorpus(lang);
  const hits = [];
  for (const g of corpus) {
    let count = 0;
    for (const v of variants) {
      if (g.text.indexOf(v) === -1) continue; // pré-filtre rapide
      const re = new RegExp("(^|[^A-Za-z0-9&])" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^A-Za-z0-9&])", "g");
      let m;
      while ((m = re.exec(g.text)) !== null) { count++; re.lastIndex = m.index + m[1].length + v.length; }
      if (count) break; // le nom complet suffit, pas besoin de la variante
    }
    if (count) hits.push({ g, count });
  }
  hits.sort((a, b) => b.count - a.count);
  const top = hits.slice(0, 2);
  if (!top.length) return "";
  const label = lang === "en" ? "📚 Guides:" : "📚 Guides :";
  return ` · ${label} ${top.map(x => `<a href="${x.g.url}">${esc(x.g.h1)}</a>`).join(" · ")}`;
}

const BUILDS_FOR_LINKS = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "builds_index.json"), "utf8"))
      .map(b => ({ s: b.s, n: String(b.n).replace(/^Build /, "") }));
  } catch (e) { return []; }
})();
const BUILD_NAME_SET = new Set(BUILDS_FOR_LINKS.map(b => b.n));
const stripT = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
function buildsMentionedIn(html) {
  const text = stripT(html);
  const found = [];
  for (const b of BUILDS_FOR_LINKS) {
    const re = new RegExp("(^|[^A-Za-z0-9&])" + b.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^A-Za-z0-9&])");
    const m = re.exec(text);
    if (!m) continue;
    const start = m.index + m[1].length, end = start + b.n.length;
    const nextWord = (text.slice(end, end + 24).match(/^\s+([A-ZÉ][\w'À-ſ-]*)/) || [])[1];
    const prevWord = (text.slice(Math.max(0, start - 24), start).match(/([A-ZÉ][\w'À-ſ-]*)\s+$/) || [])[1];
    if (nextWord && BUILD_NAME_SET.has(b.n + " " + nextWord)) continue;
    if (prevWord && (BUILD_NAME_SET.has(prevWord + " " + b.n) || (b.n === "War" && prevWord === "New"))) continue;
    found.push({ b, pos: start });
  }
  return found.sort((a, z) => a.pos - z.pos).slice(0, 8).map(x => x.b);
}
function buildChipsHtml(html, lang) {
  const hits = buildsMentionedIn(html);
  if (!hits.length) return "";
  const base = lang === "en" ? "/en/builds/" : "/builds/";
  const label = lang === "en" ? "⚙ Builds mentioned in this guide:" : "⚙ Builds mentionnés dans ce guide :";
  return `<p class="muted" style="margin-top:1.4rem">${label} ${hits.map(b => `<a href="${base}${b.s}">${esc(b.n)}</a>`).join(" · ")}</p>`;
}

function guidePage(g) {
  const url = `${SITE}/guides/${g.slug}`;
  // Noms de mods/arcanes francisés dans le corps (anglais en infobulle) ; le style ne part
  // que si au moins un nom a été remplacé, pour laisser les autres guides intacts.
  const corps = franciserProse(g.body);
  const styleNoms = corps !== g.body ? `<style>.article .nmfr{border-bottom:1px dotted currentColor;cursor:help}</style>\n` : "";
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: g.h1, description: g.desc, url, author: { "@type": "Organization", name: "VoidRelay" }, publisher: { "@id": SITE + "/#org" }, mainEntityOfPage: url, inLanguage: "fr" },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: SITE + "/guides/" },
      { "@type": "ListItem", position: 3, name: g.h1, item: url } ] },
    ...(g.faq ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
  ];
  return `<!DOCTYPE html><html lang="fr"><head>${THEME_BOOT}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${GUIDES_CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff"><meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(g.title)}</title>
<meta name="description" content="${esc(g.desc)}">
<link rel="canonical" href="${url}">${hreflangFor(url, FR2EN.get(g.slug))}<meta name="robots" content="index, follow, max-image-preview:large"><meta name="author" content="VoidRelay"><meta name="theme-color" content="#0b0f14">
<link rel="icon" href="${FAVICON_OR}"><link rel="stylesheet" href="/css/pandaahh.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta property="og:type" content="article"><meta property="og:site_name" content="VoidRelay"><meta property="og:title" content="${esc(g.h1)}"><meta property="og:description" content="${esc(g.desc)}"><meta property="og:url" content="${url}">
${g.banner ? `<meta property="og:image" content="${SITE}${esc(g.banner).replace(/\.webp$/, ".jpg")}">\n` : ""}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(g.h1)}"><meta name="twitter:description" content="${esc(g.desc)}">${g.banner ? `<meta name="twitter:image" content="${SITE}${esc(g.banner).replace(/\.webp$/, ".jpg")}">` : ""}
<script type="application/ld+json">${jstr(ld)}</script>
${FONTS_SNIPPET}
${styleNoms}</head><body>
${siteHeader()}
<main class="wrap article">
<nav class="bc"><a href="/">Accueil</a> › <a href="/guides/">Guides</a> › <span>${esc(g.h1)}</span></nav>
${g.banner ? `<img class="guide-banner" loading="lazy" alt="" src="${esc(g.banner)}">
` : ""}<h1>${esc(g.h1)}</h1>
${corps}
${buildChipsHtml(g.body, "fr")}
${shareBar(false)}
<p class="muted"><a href="/guides/">← Tous les guides</a> · <a href="/hub">Tableau de bord</a> · <a href="/o/">Prix des objets</a> · <a href="/bons-plans">Bons plans</a></p>
</main>
${siteFooter()}
<script defer src="/js/share.js"></script>
${THEME_SCRIPTS}
</body></html>`;
}
/* Insertion des guides écrits à la main dans une liste de guides générés.
   `apres` nomme le guide APRÈS lequel se placer ; la chaîne vide place EN TÊTE
   (bien-modder / modding-guide ouvrent l'annuaire) ; un `apres` introuvable
   place à la fin plutôt que de perdre l'entrée. La règle vivait en trois copies
   — annuaire FR, annuaire EN, index ⌘K — et une quatrième allait naître. */
function avecFaitsMain(liste, faits) {
  for (const m of faits) {
    if (m.apres === "") { liste.unshift(m); continue; }
    const i = liste.findIndex(g => g.slug === m.apres);
    liste.splice(i === -1 ? liste.length : i + 1, 0, m);
  }
  return liste;
}
function guidesIndex() {
  const url = SITE + "/guides/";
  // Annuaire = guides générés + guides écrits à la main (insérés à leur position via
  // `apres`) — sans GUIDES_FAITS_MAIN, la carte fragments-archontes disparaissait de
  // l'index à chaque régénération (la page elle-même, préservée par writeDir, devenait
  // orpheline : plus aucun lien interne ne pointait vers elle).
  const entries = [...GUIDES];
  avecFaitsMain(entries, GUIDES_FAITS_MAIN);
  const cards = entries.map(g => `<a class="card tile has-thumb" href="/guides/${esc(g.slug)}"><img class="gthumb" loading="lazy" alt="" src="${esc(g.banner)}"><div class="t">${esc(g.h1)}</div><div class="d muted">${esc(g.desc)}</div></a>`).join("");
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: "Guides Warframe", url, description: "Guides Warframe gratuits : farmer du platine, ducats, Baro Ki'Teer, trading, reliques.", isPartOf: { "@id": SITE + "/#site" } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: url } ] },
  ];
  return `<!DOCTYPE html><html lang="fr"><head>${THEME_BOOT}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${GUIDES_CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<title>Guides Warframe — platine, ducats, Baro, trading | VoidRelay</title>
<meta name="description" content="Guides Warframe gratuits : farmer du platine, ducats, retour de Baro Ki'Teer, trading sur le marché et reliques du Vide.">
<link rel="canonical" href="${url}"><link rel="alternate" hreflang="fr" href="${url}"><link rel="alternate" hreflang="en" href="${SITE}/en/guides/"><link rel="alternate" hreflang="x-default" href="${url}"><meta name="robots" content="index, follow"><meta name="theme-color" content="#0b0f14">
<link rel="icon" href="${FAVICON_OR}"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/assets/icon-180.png"><link rel="stylesheet" href="/css/pandaahh.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="VoidRelay"><meta property="og:title" content="Guides Warframe — VoidRelay"><meta property="og:description" content="Guides Warframe gratuits : farmer du platine, ducats, retour de Baro Ki'Teer, trading sur le marché et reliques du Vide."><meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/banners/fam-orbiter.jpg">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Guides Warframe — VoidRelay"><meta name="twitter:description" content="Guides Warframe gratuits : farmer du platine, ducats, retour de Baro Ki'Teer, trading sur le marché et reliques du Vide."><meta name="twitter:image" content="${SITE}/assets/banners/fam-orbiter.jpg">
<script type="application/ld+json">${jstr(ld)}</script>
${FONTS_SNIPPET}
</head><body>
${siteHeader()}
<main class="wrap">
<nav class="bc"><a href="/">Accueil</a> › <span>Guides</span></nav>
<h1>Guides Warframe</h1>
<p class="sub">Nos guides gratuits pour gagner du platine, des ducats et trader malin dans Warframe.</p>
<div class="grid cols-auto">${cards}</div>
<p class="muted" style="margin-top:1.5rem"><a href="/o/">Prix des objets →</a> · <a href="/bons-plans">Bons plans</a> · <a href="/outils">Tous les outils</a> (estimateur, ducats, Endo, marché) · <a href="/faq">FAQ</a></p>
</main>
${siteFooter()}
<script defer src="/js/share.js"></script>
${THEME_SCRIPTS}
</body></html>`;
}
// Depuis le 16/07/2026 (décision de l'admin) : les pages EN reçoivent la nav TRADUITE via
// siteHeader("en")/siteFooter("en")/header("en")/footer("en") — l'ancien choix « même
// header FR partout » est terminé.
function guidePageEn(g) {
  const url = `${SITE}/en/guides/${g.slug}`, frUrl = `${SITE}/guides/${g.fr}`;
  /* Les pages de guide EN n'avaient AUCUNE image de partage : 15 sur 22 se
     partageaient en lien nu sur Discord ou Twitter. Elles n'affichent pas de
     bannière (contrairement aux FR) mais elles ont un jumeau français qui en a
     une — on emprunte la sienne plutôt que d'en inventer une. Sans jumeau, pas
     d'image plutôt qu'une image fausse. */
  const banFr = (GUIDES.find(x => x.slug === g.fr) || {}).banner;
  const imgEn = banFr ? SITE + banFr.replace(/\.webp$/, ".jpg") : "";
  const hl = `<link rel="alternate" hreflang="en" href="${url}"><link rel="alternate" hreflang="fr" href="${frUrl}"><link rel="alternate" hreflang="x-default" href="${frUrl}">`;
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: g.h1, description: g.desc, url, author: { "@type": "Organization", name: "VoidRelay" }, publisher: { "@id": SITE + "/#org" }, mainEntityOfPage: url, inLanguage: "en" },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/en/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: SITE + "/en/guides/" },
      { "@type": "ListItem", position: 3, name: g.h1, item: url } ] },
    ...(g.faq ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
  ];
  return `<!DOCTYPE html><html lang="en"><head>${THEME_BOOT}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${GUIDES_CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff"><meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(g.title)}</title>
<meta name="description" content="${esc(g.desc)}">
<link rel="canonical" href="${url}">${hl}<meta name="robots" content="index, follow, max-image-preview:large"><meta name="author" content="VoidRelay"><meta name="theme-color" content="#0b0f14">
<link rel="icon" href="${FAVICON_OR}"><link rel="stylesheet" href="/css/pandaahh.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta property="og:type" content="article"><meta property="og:site_name" content="VoidRelay"><meta property="og:locale" content="en_US"><meta property="og:title" content="${esc(g.h1)}"><meta property="og:description" content="${esc(g.desc)}"><meta property="og:url" content="${url}">
${imgEn ? `<meta property="og:image" content="${imgEn}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(g.h1)}"><meta name="twitter:description" content="${esc(g.desc)}"><meta name="twitter:image" content="${imgEn}">
` : ""}<script type="application/ld+json">${jstr(ld)}</script>
${FONTS_SNIPPET}
</head><body>
${siteHeader("en")}
<main class="wrap article">
<nav class="bc"><a href="/en/">Home</a> › <a href="/en/guides/">Guides</a> › <span>${esc(g.h1)}</span></nav>
<h1>${esc(g.h1)}</h1>
${g.body}
${buildChipsHtml(g.body, "en")}
${shareBarEn(false)}
<p class="muted"><a href="/en/guides/">← All guides</a> · <a href="/hub">Dashboard</a> · <a href="${EN_OBJECTS_SELECTION.size ? "/en/o/" : "/o/"}">Item prices</a> · <a href="/bons-plans">Deals</a> · <a href="/guides/${esc(g.fr)}">Version française</a></p>
</main>
${siteFooter("en")}
<script defer src="/js/share.js"></script>
${THEME_SCRIPTS}
</body></html>`;
}
function guidesIndexEn() {
  const url = SITE + "/en/guides/";
  const entriesEn = [...GUIDES_EN];
  avecFaitsMain(entriesEn, GUIDES_FAITS_MAIN_EN);
  const cards = entriesEn.map(g => `<a class="card tile" href="/en/guides/${esc(g.slug)}"><div class="t">${esc(g.h1)}</div><div class="d muted">${esc(g.desc)}</div></a>`).join("");
  const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/en/" },
    { "@type": "ListItem", position: 2, name: "Guides", item: url } ] },
  { "@context": "https://schema.org", "@type": "CollectionPage", name: "Warframe Guides", url, description: "Free Warframe guides: farm platinum, ducats, Baro Ki'Teer, trading, starter Warframes.", isPartOf: { "@id": SITE + "/#site" } }];
  return `<!DOCTYPE html><html lang="en"><head>${THEME_BOOT}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${GUIDES_CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<title>Warframe Guides — platinum, ducats, Baro, trading | VoidRelay</title>
<meta name="description" content="Free Warframe guides: how to farm platinum, ducats, Baro Ki'Teer return, trading on the market and starter Warframes.">
<link rel="canonical" href="${url}"><link rel="alternate" hreflang="en" href="${url}"><link rel="alternate" hreflang="fr" href="${SITE}/guides/"><link rel="alternate" hreflang="x-default" href="${SITE}/guides/"><meta name="robots" content="index, follow"><meta name="theme-color" content="#0b0f14">
<link rel="icon" href="${FAVICON_OR}"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/assets/icon-180.png"><link rel="stylesheet" href="/css/pandaahh.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="VoidRelay"><meta property="og:locale" content="en_US"><meta property="og:title" content="Warframe Guides — VoidRelay"><meta property="og:description" content="Free Warframe guides: how to farm platinum, ducats, Baro Ki'Teer return, trading on the market and starter Warframes."><meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/banners/fam-orbiter.jpg">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Warframe Guides — VoidRelay"><meta name="twitter:description" content="Free Warframe guides: how to farm platinum, ducats, Baro Ki'Teer return, trading on the market and starter Warframes."><meta name="twitter:image" content="${SITE}/assets/banners/fam-orbiter.jpg">
<script type="application/ld+json">${jstr(ld)}</script>
${FONTS_SNIPPET}
</head><body>
${siteHeader("en")}
<main class="wrap">
<nav class="bc"><a href="/en/">Home</a> › <span>Guides</span></nav>
<h1>Warframe Guides</h1>
<p class="sub">Free guides to earn platinum, ducats and trade smart in Warframe.</p>
<div class="grid cols-auto">${cards}</div>
<p class="muted" style="margin-top:1.5rem"><a href="${EN_OBJECTS_SELECTION.size ? "/en/o/" : "/o/"}">Item prices →</a> · <a href="/en/price-check">Price checker</a> · <a href="/bons-plans">Deals</a> · <a href="/guides/">Guides (français)</a></p>
</main>
${siteFooter("en")}
<script defer src="/js/share.js"></script>
${THEME_SCRIPTS}
</body></html>`;
}
function slugify(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "et").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
const CAT_INTRO = {
  "Sets": "Tous les sets Warframe (Prime et standard) avec leur prix en platine en direct. Acheter un set complet est souvent plus avantageux que les pièces séparées — compare ici.",
  "Pièces & plans": "Pièces et plans Warframe (Prime inclus) à assembler pour fabriquer l'objet complet. Prix du platine en direct, utile pour acheter au meilleur prix ou revendre tes drops.",
  "Mods": "Mods Warframe (dont mods d'augmentation et postures) avec leur cote en platine. Repère les mods rares qui valent cher avant de les vendre.",
  "Arcanes": "Arcanes Warframe et leur prix en platine en direct. Les arcanes ajoutent des bonus puissants ; suis leur cote pour acheter ou revendre au bon moment.",
  "Reliques": "Reliques du Vide (Lith, Meso, Neo, Axi) et leur prix d'échange. Ouvre-les en Failles pour des composants Prime.",
  "Rivens": "Mods Riven Warframe : statistiques aléatoires, prix très variables. Suis les cotes du marché.",
  "Armes": "Armes Warframe et leurs composants échangeables, avec le prix du platine en direct.",
  "Warframes": "Warframes et composants échangeables avec leur prix en platine en direct.",
  "Ayatan": "Sculptures Ayatan (décoratives, convertibles en Endo) et leur prix d'échange.",
  "Autres": "Objets Warframe échangeables divers avec leur prix en platine en direct.",
};
function categoryPage(g, arr) {
  const total = arr.length, url = `${SITE}/o/c/${slugify(g)}`;
  const links = arr.slice().sort(triFr).map(it => {
    const im = localImg(it.slug) || it.img || "";
    const icon = im ? `<img src="${esc(im)}" alt="" width="28" height="28" loading="lazy" onerror="this.onerror=null;this.src='/assets/objets/_unknown.png'">` : "";
    return `<a href="/o/${esc(it.slug)}">${icon}${nomBilingue(it.name, { suivre: estModOuArcane(it.tags) })}</a>`;
  }).join("");
  const intro = CAT_INTRO[g] || `Objets de la catégorie ${g} avec leur prix en platine en direct.`;
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: `${g} Warframe — prix platine`, url, description: intro, isPartOf: { "@id": SITE + "/#site" } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Objets", item: SITE + "/o/" },
      { "@type": "ListItem", position: 3, name: g, item: url } ] }
  ];
  return `<!DOCTYPE html><html lang="fr"><head>${THEME_BOOT}
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${HEAD_CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff"><meta name="referrer" content="strict-origin-when-cross-origin">
<title>Prix des ${esc(g)} Warframe (platine) — ${total} objets | VoidRelay</title>
<meta name="description" content="${esc(intro)}">
<link rel="canonical" href="${url}"><meta name="robots" content="index, follow, max-image-preview:large"><meta name="theme-color" content="#0b0f14">
<link rel="icon" href="${FAVICON}"><link rel="stylesheet" href="/css/style.css"><link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="VoidRelay"><meta property="og:title" content="${esc(g)} Warframe — prix platine"><meta property="og:url" content="${url}">
<script type="application/ld+json">${jstr(ld)}</script>
<style>${CSS_NOMS_FR_LISTE}.idxlinks{display:flex;flex-wrap:wrap;gap:.5rem .8rem}.idxlinks a{font-size:.9rem;display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .5rem .25rem .25rem;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);color:var(--gold-2)}.idxlinks a:hover{border-color:var(--line-2)}.idxlinks img{width:28px;height:28px;object-fit:contain;border-radius:5px;background:var(--bg2);flex:none}#oq{width:100%;max-width:480px;padding:.6rem .8rem;margin:.5rem 0 1rem;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:inherit}</style>
</head><body>
${header()}
<main class="wrap">
<nav class="bc"><a href="/">Accueil</a> › <a href="/o/">Objets</a> › <span>${esc(g)}</span></nav>
<h1>Prix des ${esc(g)} Warframe en direct</h1>
<p class="sub">${esc(intro)} <b>${total}</b> objets.</p>
<input id="oq" type="search" data-vr-suggest placeholder="Filtrer dans ${esc(g)}…" aria-label="Filtrer">
<div class="idxlinks">${links}</div>
<p class="muted"><a href="/o/">← Toutes les catégories</a> · <a href="/marche-complet">Tout le marché en direct</a> · <a href="/bons-plans">Bons plans</a> · <a href="/hub">Tableau de bord</a></p>
</main>
${footer()}
<script>const q=document.getElementById('oq');q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();document.querySelectorAll('.idxlinks a').forEach(a=>{a.style.display=(!v||a.textContent.toLowerCase().includes(v))?'':'none';});});</script>
<script defer src="/js/share.js"></script>
<script defer src="/js/search.js"></script><script defer src="/js/warp.js"></script>${THEME_TOGGLE_ONLY}
</body></html>`;
}

// lastmod RÉELS (09/07/2026) : reflète la vraie date du dernier commit qui a touché chaque
// fichier (git ne committe que les fichiers dont le contenu a changé — cf. workflow
// pages-objets.yml, "git add" + commit conditionnel), plutôt qu'un unique "today" appliqué en
// masse à 3834 pages à chaque régénération hebdo, qui mentait à Google sur ce qui avait
// vraiment changé. Repli sur la date du jour pour un fichier neuf (pas encore commité).
// Nécessite un historique complet (fetch-depth: 0 dans le workflow CI, pas un clone superficiel).
function buildLastModMap() {
  const map = new Map();
  try {
    const log = execSync('git log --name-only --diff-filter=ACMR --pretty=format:"@@%aI"', { cwd: ROOT, maxBuffer: 1024 * 1024 * 128 }).toString("utf8");
    let current = null;
    for (const line of log.split("\n")) {
      if (line.startsWith("@@")) { current = line.slice(2, 12); continue; }
      if (line && current && !map.has(line)) map.set(line, current);
    }
  } catch (e) {
    console.warn("⚠️  git log indisponible (historique superficiel ?) — lastmod du jour en repli :", e.message);
  }
  return map;
}

function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const LASTMOD = buildLastModMap();
  const lm = rel => LASTMOD.get(rel) || today;
  const u = (loc, rel, changefreq, priority) => `<url><loc>${loc}</loc><lastmod>${lm(rel)}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
  const base = [
    u(`${SITE}/`, "index.html", "weekly", "1.0"),
    u(`${SITE}/en/`, "en/index.html", "weekly", "0.9"),
    u(`${SITE}/en/tools`, "en/tools.html", "weekly", "0.7"),
    u(`${SITE}/en/ducats`, "en/ducats.html", "monthly", "0.6"),
    u(`${SITE}/en/endo`, "en/endo.html", "monthly", "0.6"),
    u(`${SITE}/en/relic-calc`, "en/relic-calc.html", "monthly", "0.6"),
    u(`${SITE}/en/relics-tonight`, "en/relics-tonight.html", "daily", "0.6"),
    u(`${SITE}/hub`, "hub.html", "hourly", "1.0"),
    u(`${SITE}/codex`, "codex.html", "weekly", "0.7"),
    u(`${SITE}/fonderie`, "fonderie.html", "monthly", "0.6"),
    u(`${SITE}/taches`, "taches.html", "monthly", "0.6"),
    u(`${SITE}/calc-reliques`, "calc-reliques.html", "monthly", "0.6"),
    u(`${SITE}/reliques-ce-soir`, "reliques-ce-soir.html", "weekly", "0.6"),
    u(`${SITE}/assistant-farm`, "assistant-farm.html", "weekly", "0.7"),
    u(`${SITE}/compagnon`, "compagnon.html", "daily", "0.9"),
    u(`${SITE}/o/`, "o/index.html", "daily", "0.9"),
    u(`${SITE}/bons-plans`, "bons-plans.html", "daily", "0.8"),
    // Outils (09/07/2026) : pages finies et fonctionnelles mais jamais entrées au sitemap
    // ni maillées — invisibles des moteurs depuis leur création. courses/digest/trade sont
    // volontairement noindex (outils personnalisés) et restent hors sitemap.
    u(`${SITE}/outils`, "outils.html", "weekly", "0.7"),
    u(`${SITE}/marche`, "marche.html", "daily", "0.8"),
    u(`${SITE}/marche-complet`, "marche-complet.html", "daily", "0.8"),
    u(`${SITE}/marche-profils`, "marche-profils.html", "daily", "0.8"),
    u(`${SITE}/en/market-profiles`, "en/market-profiles.html", "daily", "0.8"),
    u(`${SITE}/arsenal`, "arsenal.html", "weekly", "0.8"),
    u(`${SITE}/en/arsenal`, "en/arsenal.html", "weekly", "0.8"),
    u(`${SITE}/estimateur`, "estimateur.html", "weekly", "0.7"),
    u(`${SITE}/en/price-check`, "en/price-check.html", "weekly", "0.7"),
    u(`${SITE}/ducats`, "ducats.html", "monthly", "0.7"),
    u(`${SITE}/endo`, "endo.html", "monthly", "0.7"),
    u(`${SITE}/faq`, "faq.html", "monthly", "0.8"),
    u(`${SITE}/faq-en`, "faq-en.html", "monthly", "0.8"),
    u(`${SITE}/a-propos`, "a-propos.html", "monthly", "0.5"),
    u(`${SITE}/confidentialite`, "confidentialite.html", "yearly", "0.3"),
    u(`${SITE}/mentions-legales`, "mentions-legales.html", "yearly", "0.3"),
    // Catalogues principaux (pages hors périmètre de ce générateur, maintenues à la main) :
    // sans cette liste, chaque régénération du sitemap les faisait disparaître.
    u(`${SITE}/voie-du-platine/`, "voie-du-platine/index.html", "weekly", "0.8"),
    u(`${SITE}/en/platinum-path/`, "en/platinum-path/index.html", "weekly", "0.8"),
    u(`${SITE}/warframes/`, "warframes/index.html", "weekly", "0.8"),
    u(`${SITE}/compagnons/`, "compagnons/index.html", "weekly", "0.8"),
    u(`${SITE}/ressources/`, "ressources/index.html", "weekly", "0.8"),
    u(`${SITE}/arcanes/`, "arcanes/index.html", "weekly", "0.8"),
    u(`${SITE}/armes/`, "armes/index.html", "weekly", "0.8"),
    u(`${SITE}/skins/`, "skins/index.html", "weekly", "0.7"),
    // Guides écrits à la main : déclarés dans GUIDES_FAITS_MAIN (guides_content.mjs),
    // seule source à maintenir — plus de ligne codée en dur par guide ici.
    ...GUIDES_FAITS_MAIN.map(g => u(`${SITE}/guides/${g.slug}`, `guides/${g.slug}.html`, g.changefreq || "monthly", "0.7")),
    u(`${SITE}/builds/`, "builds/index.html", "weekly", "0.8"),
    ...fs.readdirSync(path.join(ROOT, "builds")).filter(f => f.endsWith(".html") && f !== "index.html")
      .map(f => u(`${SITE}/builds/${f.slice(0, -5)}`, `builds/${f}`, "weekly", "0.7")),
    // Builds EN (2026-07-14) : même découverte automatique que les builds FR.
    ...(fs.existsSync(path.join(ROOT, "en/builds")) ? [u(`${SITE}/en/builds/`, "en/builds/index.html", "weekly", "0.8")] : []),
    ...(fs.existsSync(path.join(ROOT, "en/builds")) ? fs.readdirSync(path.join(ROOT, "en/builds")).filter(f => f.endsWith(".html") && f !== "index.html")
      .map(f => u(`${SITE}/en/builds/${f.slice(0, -5)}`, `en/builds/${f}`, "weekly", "0.6")) : []),
  ];
  const cats = [...byGroup.keys()].map(g => u(`${SITE}/o/c/${slugify(g)}`, `o/c/${slugify(g)}.html`, "daily", "0.7"));
  cats.unshift(u(`${SITE}/guides/`, "guides/index.html", "weekly", "0.8"));
  for (const g of GUIDES) cats.push(u(`${SITE}/guides/${g.slug}`, `guides/${g.slug}.html`, "monthly", "0.7"));
  cats.push(u(`${SITE}/en/guides/`, "en/guides/index.html", "weekly", "0.8"));
  for (const g of GUIDES_EN) cats.push(u(`${SITE}/en/guides/${g.slug}`, `en/guides/${g.slug}.html`, "monthly", "0.7"));
  cats.push(...GUIDES_FAITS_MAIN_EN.map(g => u(`${SITE}/en/guides/${g.slug}`, `en/guides/${g.slug}.html`, g.changefreq || "monthly", "0.7")));
  // Lot EN restreint /en/o/ (cf. EN_OBJECTS_SELECTION) : index + une URL par objet sélectionné.
  if (enSelectedItems.length) cats.push(u(`${SITE}/en/o/`, "en/o/index.html", "daily", "0.9"));
  const items = cat.map(it => u(`${SITE}/o/${it.slug}`, `o/${it.slug}.html`, "daily", "0.6"));
  const itemsEn = enSelectedItems.map(it => u(`${SITE}/en/o/${it.slug}`, `en/o/${it.slug}.html`, "daily", "0.6"));
  const _all = base.concat(cats, items, itemsEn);
  // AdSense (2026-09) : /o/ et /en/o/ sont passees en noindex (via _headers) pour
  // l'evaluation qualite du site. Un sitemap ne doit pas lister d'URL noindex :
  // on exclut les pages objet (categories /o/c/, items FR et EN).
  // Exception 20/10/2026 : les 2 pages-listes /o/ et /en/o/ sont de nouveau indexables
  // (exception dans _headers) → elles restent dans le sitemap.
  const _listesIndexables = new Set([`${SITE}/o/`, `${SITE}/en/o/`]);
  const _indexable = _all.filter(e => {
    const loc = (e.match(/<loc>([^<]*)<\/loc>/) || [])[1];
    if (_listesIndexables.has(loc)) return true;
    return !/<loc>[^<]*\/(?:en\/)?o(?:\/|<\/loc>)/.test(e);
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${_indexable.join("\n")}\n</urlset>\n`;
}

// --- écriture (SÛRE : ne supprime jamais un fichier qu'elle ne réécrit pas dans la foulée) ---
// Piège vécu (09/07/2026) : l'ancienne purge "supprime TOUT le dossier puis ne réécrit que ce
// que ce script connaît" effaçait silencieusement les pages ajoutées à la main et absentes de
// guides_content.mjs (ex. guides/fragments-archontes.html). Plus jamais : un fichier "étranger"
// (non généré par ce run) est conservé tel quel et signalé, jamais supprimé automatiquement.
function writeDir(dir, filesToWrite) {
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).filter(f => f.endsWith(".html"));
  const foreign = existing.filter(f => !filesToWrite.has(f));
  if (foreign.length) {
    console.warn(`⚠️  ${path.relative(ROOT, dir)}/ : ${foreign.length} fichier(s) conservé(s) (non gérés par ce script, probablement écrits à la main) : ${foreign.join(", ")}`);
  }
  for (const [name, content] of filesToWrite) fs.writeFileSync(path.join(dir, name), content);
}
// Test/validation : aucune page présente AVANT ce run ne doit avoir disparu APRÈS (garde-fou
// de non-régression, en plus de writeDir qui ne supprime déjà jamais rien par construction).
function assertNoneMissing(dir, beforeList, label) {
  const missing = beforeList.filter(f => !fs.existsSync(path.join(dir, f)));
  if (missing.length) {
    console.error(`💥 ERREUR : ${missing.length} page(s) ${label} ont disparu pendant la génération : ${missing.join(", ")}`);
    console.error(`   Génération refusée (exit 1) — aucune page existante ne doit disparaître silencieusement.`);
    process.exit(1);
  }
}
function snapshot(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".html")) : []; }

const OBJETS_REL = "o", OBJETS_EN_REL = "en/o", CAT_REL = "o/c", GUIDES_REL = "guides", GUIDES_EN_REL = "en/guides";

const objetsFiles = new Map();
for (const it of cat) objetsFiles.set(it.slug + ".html", itemPage(it));
objetsFiles.set("index.html", indexPage());
const n = cat.length;

// Lot EN restreint (data/en_objects_selection.json, cf. EN_OBJECTS_SELECTION en tête de
// fichier) : une page /en/o/<slug> par objet sélectionné + un index dédié. Vide tant que
// le fichier de sélection n'existe pas (dégradation gracieuse).
const enSelectedItems = cat.filter(it => EN_OBJECTS_SELECTION.has(it.slug));
const objetsEnFiles = new Map();
for (const it of enSelectedItems) objetsEnFiles.set(it.slug + ".html", itemPageEn(it));
if (enSelectedItems.length) objetsEnFiles.set("index.html", indexPageEn(enSelectedItems));

// pages de catégorie (SEO + maillage)
const catFiles = new Map();
for (const [g, arr] of byGroup) catFiles.set(slugify(g) + ".html", categoryPage(g, arr));
const nc = byGroup.size;

// guides éditoriaux (SEO contenu) — coexiste avec des fiches écrites à la main (cf. writeDir).
const guideFiles = new Map();
for (const g of GUIDES) guideFiles.set(g.slug + ".html", guidePage(g));
guideFiles.set("index.html", guidesIndex());

// guides EN (marché anglophone)
const guideEnFiles = new Map();
for (const g of GUIDES_EN) guideEnFiles.set(g.slug + ".html", guidePageEn(g));
guideEnFiles.set("index.html", guidesIndexEn());

const sitemapContent = sitemap();

// --- Garde-fou dérive (cf. commentaire en tête de fichier) : comparé et refusé AVANT
// toute écriture, sur la totalité des fichiers gérés par ce script. ---
// data/pages_index.json (16/07/2026, demande de l'admin « synchronicité entre tous les outils,
// tous les mots-clés ») : index des PAGES du site pour la recherche instantanée ⌘K —
// jusqu'ici elle ne trouvait que les objets et les builds ; taper « ducats », « codex » ou
// « baro » ne donnait rien. u=URL, n=libellé affiché, k=mots-clés de recherche (sans accents
// obligatoires : la recherche normalise). Les guides sont dynamiques (GUIDES +
// GUIDES_FAITS_MAIN, même insertion que l'annuaire).
/* Le nombre d'outils était écrit en dur (« les 16 outils gratuits ») et avait vieilli :
   /outils en portait 17 le 04/09/2026. Un chiffre recopié à la main se démode en
   silence — on le compte sur la page elle-même, il ne peut plus mentir. */
const NB_OUTILS = (fs.readFileSync(path.join(ROOT, "outils.html"), "utf8").match(/class="tool-card"/g) || []).length;
const pagesIndexEntries = [
  { u: "/voie-du-platine/", n: "La Voie du Platine — guide débutant", k: "debutant commencer nouveau joueur progression voie platine" },
  { u: "/builds/", n: "Builds — tout l'arsenal", k: "build mods configuration arsenal" },
  { u: "/warframes/", n: "Warframes — toutes les frames", k: "frame prime stats capacites" },
  { u: "/armes/", n: "Armes — catalogue complet", k: "arme weapon primaire secondaire melee archwing" },
  { u: "/compagnons/", n: "Compagnons — sentinelles & bêtes", k: "compagnon sentinelle kavat kubrow moa vulpaphyla predasite" },
  { u: "/ressources/", n: "Ressources — matériaux à farmer", k: "ressource materiaux gemmes plantes farm" },
  { u: "/arcanes/", n: "Arcanes — les 168 arcanes", k: "arcane energisee gardien" },
  { u: "/guides/", n: "Guides — tous les guides", k: "guide astuces tuto" },
  { u: "/skins/", n: "Skins — cosmétiques", k: "skin deluxe tennogen fashion frame cosmetique" },
  { u: "/o/", n: "Objets — prix du platine en direct", k: "objet item prix platine market echange" },
  { u: "/hub", n: "Tableau de bord — le monde en direct", k: "monde cycles cetus fissures sortie invasions nightwave baro alertes direct" },
  { u: "/outils", n: `Outils — les ${NB_OUTILS} outils gratuits`, k: "outil tools" },
  { u: "/faq", n: "FAQ — questions fréquentes", k: "question aide reponse faq" },
  { u: "/marche", n: "Outil : Marché en direct", k: "marche market tendances prix vendre acheter volume" },
  { u: "/arsenal", n: "Outil : Simulateur d'Arsenal", k: "arsenal simulateur build equipement loadout mods polarite forma capacite warframe arme stats" },
  { u: "/marche-complet", n: "Outil : Tout le marché en direct", k: "marche complet tout trafic temps reel live ordres offres set systeme chassis casque neuroptics schema blueprint" },
  { u: "/marche-profils", n: "Outil : Profils de marché", k: "profil farmeur monteur set flipper ducatier debutant marge ecart pieces revendre acheter bas revendre haut trader" },
  { u: "/estimateur", n: "Outil : Estimateur de prix", k: "estimer prix combien vaut valeur courbe historique" },
  { u: "/favoris", n: "Outil : Mes favoris", k: "favori suivre alerte prix cible etoile" },
  { u: "/ducats", n: "Outil : Convertisseur de ducats", k: "ducat baro kiteer pieces prime rareté" },
  { u: "/endo", n: "Outil : Calculateur d'Endo", k: "endo ayatan sculpture mods rank" },
  { u: "/trade", n: "Outil : Générateur de message de trade", k: "trade wts wtb vendre acheter message annonce" },
  { u: "/courses", n: "Outil : Liste de courses", k: "courses panier budget acheter liste shopping" },
  { u: "/digest", n: "Outil : Digest", k: "digest resume actu quoi de neuf temps forts" },
  { u: "/bons-plans", n: "Outil : Bons plans", k: "bons plans promo deals affaires darvo" },
  { u: "/codex", n: "Outil : Codex", k: "codex fiche encyclopedie maitrise polarites drops" },
  { u: "/fonderie", n: "Outil : Minuteurs de Foundry", k: "fonderie foundry fabrication craft minuteur timer" },
  { u: "/taches", n: "Outil : Tâches", k: "taches checklist quotidien hebdo routine" },
  { u: "/calc-reliques", n: "Outil : Calculateur de reliques", k: "relique probabilite chance drop raffinage radiant" },
  { u: "/reliques-ce-soir", n: "Outil : Reliques ce soir", k: "relique fissure ouvrir prime vaultee ce soir" },
  { u: "/assistant-farm", n: "Outil : Assistant de farm", k: "farm farmer ou drop plan assistant" },
  { u: "/compagnon", n: "Outil : Compagnon — recherche d'objet", k: "recherche objet prix farm reliques compagnon" },
];
{
  const gEntries = [...GUIDES];
  avecFaitsMain(gEntries, GUIDES_FAITS_MAIN);
  for (const g of gEntries) pagesIndexEntries.push({ u: `/guides/${g.slug}`, n: `Guide : ${g.h1}`, k: "guide" });
}
const pagesIndexContent = JSON.stringify(pagesIndexEntries) + "\n";

// data/en_pages_index.json (16/07/2026) : le même index de pages, en ANGLAIS, pour la
// recherche ⌘K des pages EN — avant, un anglophone tapant « ducats » recevait les libellés
// français. Destinations EN quand elles existent, sinon la page FR (même précédent que
// la vrnav EN : Deals → /bons-plans).
const enPagesIndexEntries = [
  { u: "/en/", n: "Home — English homepage", k: "home start english" },
  { u: "/en/platinum-path/", n: "The Platinum Path — earn platinum without paying", k: "platinum path plat farming trading earn money free rivens arcanes relics ducats" },
  { u: "/en/builds/", n: "Builds — full arsenal", k: "build mods loadout arsenal" },
  { u: "/en/o/", n: "Items — live platinum prices", k: "item price platinum market trade" },
  { u: "/en/guides/", n: "Guides — all guides", k: "guide tips tutorial" },
  { u: "/en/tools", n: "Tools — free Warframe tools", k: "tool tools" },
  { u: "/hub", n: "Dashboard — live world state", k: "world cycles cetus fissures sortie invasions nightwave baro alerts live dashboard" },
  { u: "/faq-en", n: "FAQ — frequently asked questions", k: "question help answer faq" },
  { u: "/en/price-check", n: "Tool: Price check", k: "price check value worth platinum median" },
  { u: "/en/ducats", n: "Tool: Ducats converter", k: "ducat baro kiteer prime parts rarity" },
  { u: "/en/market-profiles", n: "Tool: Market profiles", k: "profile farmer set builder flipper ducat newcomer margin gap parts resell buy low sell high trader" },
  { u: "/en/endo", n: "Tool: Endo calculator", k: "endo ayatan sculpture mods rank" },
  { u: "/en/favorites", n: "Tool: My favourites", k: "favorite favourite watch alert target price star" },
  { u: "/en/courses", n: "Tool: Shopping list", k: "shopping list cart budget buy" },
  { u: "/en/trade", n: "Tool: Trade message generator", k: "trade wts wtb sell buy message" },
  { u: "/en/relic-calc", n: "Tool: Relic calculator", k: "relic probability chance drop refinement radiant" },
  { u: "/en/relics-tonight", n: "Tool: Relics tonight", k: "relic fissure crack prime vaulted tonight" },
  { u: "/en/arsenal", n: "Tool: Arsenal simulator", k: "arsenal simulator build loadout mods polarity forma capacity" },
  { u: "/marche-complet", n: "Tool: Full live market (French)", k: "full market live orders feed set systems chassis neuroptics blueprint" },
  { u: "/bons-plans", n: "Deals (French)", k: "deals darvo promo" },
];
for (const g of GUIDES_EN) enPagesIndexEntries.push({ u: `/en/guides/${g.slug}`, n: `Guide: ${g.h1}`, k: "guide" });
for (const m of GUIDES_FAITS_MAIN_EN) enPagesIndexEntries.push({ u: `/en/guides/${m.slug}`, n: `Guide: ${m.h1}`, k: "guide" });
const enPagesIndexContent = JSON.stringify(enPagesIndexEntries) + "\n";

const plannedFiles = [
  ...[...objetsFiles].map(([name, content]) => [`${OBJETS_REL}/${name}`, content]),
  ...[...objetsEnFiles].map(([name, content]) => [`${OBJETS_EN_REL}/${name}`, content]),
  ...[...catFiles].map(([name, content]) => [`${CAT_REL}/${name}`, content]),
  ...[...guideFiles].map(([name, content]) => [`${GUIDES_REL}/${name}`, content]),
  ...[...guideEnFiles].map(([name, content]) => [`${GUIDES_EN_REL}/${name}`, content]),
  ["sitemap.xml", sitemapContent],
  ["data/pages_index.json", pagesIndexContent],
  ["data/en_pages_index.json", enPagesIndexContent],
];
if (VERIFIER) {
  /* Le <lastmod> du sitemap ne vient PAS du gabarit : il vient de `git log`, donc de
     l'historique disponible là où on tourne. En CI, le job des invariants cloue un
     clone SUPERFICIEL (seul pages-objets.yml demande fetch-depth: 0) et compare un
     COMMIT DE FUSION — deux raisons pour lesquelles la date sort différente de celle
     qui a été committée, sans qu'une seule ligne de gabarit ait bougé. Passer le job
     en fetch-depth: 0 ne suffirait pas : la fusion daterait quand même les fichiers
     du jour de la fusion.
     On compare donc le sitemap sur ce que le gabarit produit VRAIMENT — quelles URLs,
     dans quel ordre, avec quelles fréquences et priorités — et on ignore la seule
     partie qui dépend de l'environnement. Tout le reste est comparé à l'octet. */
  const stable = (rel, txt) => rel === "sitemap.xml" ? txt.replace(/<lastmod>[^<]*<\/lastmod>/g, "") : txt;
  const ecarts = [];
  for (const [rel, content] of plannedFiles) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) { ecarts.push(rel + " (absent du disque)"); continue; }
    if (stable(rel, fs.readFileSync(abs, "utf8")) !== stable(rel, content)) ecarts.push(rel);
  }
  if (ecarts.length) {
    console.error(`💥 ${ecarts.length} fichier(s) générés ne correspondent plus à ce que ce script produit :`);
    console.error(ecarts.slice(0, 40).map(f => "   " + f).join("\n"));
    if (ecarts.length > 40) console.error(`   … et ${ecarts.length - 40} autre(s).`);
    console.error("   → Répercute le changement dans le gabarit, puis régénère (node scripts/generer_pages_objets.mjs --force).");
    process.exit(1);
  }
  rapportFrancisation("pages objets + guides FR");
  console.log(`✅ ${plannedFiles.length} fichiers générés sont conformes au gabarit.`);
  process.exit(0);
}
assertNoDrift(loadManifest(), plannedFiles);

fs.mkdirSync(OUT, { recursive: true });
const objetsBefore = snapshot(OUT);
writeDir(OUT, objetsFiles);

const OUT_EN = path.join(ROOT, OBJETS_EN_REL);
const objetsEnBefore = snapshot(OUT_EN);
if (objetsEnFiles.size) writeDir(OUT_EN, objetsEnFiles);

const CAT_DIR = path.join(OUT, "c");
const catBefore = snapshot(CAT_DIR);
writeDir(CAT_DIR, catFiles);

const GDIR = path.join(ROOT, "guides");
const guidesBefore = snapshot(GDIR);
writeDir(GDIR, guideFiles);

const GDIR_EN = path.join(ROOT, "en", "guides");
const guidesEnBefore = snapshot(GDIR_EN);
writeDir(GDIR_EN, guideEnFiles);

fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemapContent);
fs.writeFileSync(path.join(ROOT, "data", "pages_index.json"), pagesIndexContent);
fs.writeFileSync(path.join(ROOT, "data", "en_pages_index.json"), enPagesIndexContent);

assertNoneMissing(OUT, objetsBefore, "objet (o/)");
assertNoneMissing(OUT_EN, objetsEnBefore, "objet EN (en/o/)");
assertNoneMissing(CAT_DIR, catBefore, "catégorie (o/c/)");
assertNoneMissing(GDIR, guidesBefore, "guide FR (guides/)");
assertNoneMissing(GDIR_EN, guidesEnBefore, "guide EN (en/guides/)");

// Toutes les écritures ont réussi (sinon process.exit(1) plus haut) : l'empreinte reflète
// désormais fidèlement le disque — sert de référence au prochain run pour détecter une dérive.
saveManifest(plannedFiles);

rapportFrancisation("pages objets + guides FR");
console.log(`✅ ${n} pages objet + ${nc} catégories + ${GUIDES.length} guides + index + sitemap générés (+ ${enSelectedItems.length} pages objet EN)`);
