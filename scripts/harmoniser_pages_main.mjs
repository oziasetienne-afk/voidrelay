/* Harmonise les cartes de mods des 22 builds FR faits main (sans marqueur vr-builds-gen), 21/10/2026.

   Ces pages n'ont pas profité des PR #9 (noms FR) et #12 (rangs, cartes Primed) : générées
   à la main, elles ne passent pas par generer_builds.mjs. On applique ici le MÊME rendu que
   modCard() du générateur, mais UNIQUEMENT sur les <div class="modc…"> : nom (lib_noms_fr),
   rang (data/mods_cards.json), image (carte texte → carte image quand l'image existe).
   Aucun autre octet de la page ne change. Sans traduction, le nom reste anglais.

   node scripts/harmoniser_pages_main.mjs            # écrit
   node scripts/harmoniser_pages_main.mjs --verifier # n'écrit rien, exit 1 si une carte diverge */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nomFr, nomBilingue } from "./lib_noms_fr.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARTES = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "mods_cards.json"), "utf8"));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dec = s => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/* Même règle que vignette() du générateur. */
function vignette(img) {
  const v = img.replace(/^\/assets\/([a-z]+)\/([^/]+)\.(png|jpe?g)$/, "/assets/$1/v/$2.webp");
  return v !== img && fs.existsSync(path.join(ROOT, v.slice(1))) ? v : img;
}

export function pagesMain() {
  return fs.readdirSync(path.join(ROOT, "builds")).filter(f => f.endsWith(".html") && f !== "index.html")
    .filter(f => !fs.readFileSync(path.join(ROOT, "builds", f), "utf8").includes("vr-builds-gen"))
    .map(f => path.join("builds", f));
}

const CARTE = /<div class="modc( modc-txt)?" title="([^"]*)">((?:(?!<\/div>).)*)<\/div>/gs;

export function harmoniser(html) {
  return html.replace(CARTE, (tout, txt, titre, corps) => {
    /* Polarité recopiée telle quelle, enveloppe .pol ou svg nu (variante de certaines pages). */
    /* Polarité : 12 pages la collaient en <svg> nu, sans l'enveloppe .pol qui la place en haut à gauche
       (pandaahh.css) — elle n'apparaissait pas. On la ré-enveloppe toujours, une seule fois. */
    const svg = (corps.match(/<svg.*?<\/svg>/s) || [""])[0];
    const pol = svg && `<span class="pol">${svg}</span>`;
    const nm = corps.match(/<span class="nm">(.*?)<\/span>(?=<span class="fx">|$)/s);
    const fx = (corps.match(/<span class="fx">.*?<\/span>/s) || [""])[0];
    if (!pol || !nm) return tout;
    const enDansNm = nm[1].match(/<span class="en" lang="en">(.*?)<\/span>/);
    const en = dec(enDansNm ? enDansNm[1] : (titre.match(/ \((.*)\)$/) && nomFr(dec(titre.match(/ \((.*)\)$/)[1]), false) ? titre.match(/ \((.*)\)$/)[1] : titre));
    const m = CARTES[en];
    const fr = nomFr(en, false);
    const libelle = fr ? `${fr} (${en})` : en;
    const img = corps.match(/<img [^>]*src="([^"]+)"/);
    const src = m ? vignette(`/assets/wfimg/${m.img}`) : (img ? img[1] : null);
    if (src) {
      const rk = m ? m.rk : (corps.match(/<span class="rk">(.*?)<\/span>/) || [0, ""])[1];
      return `<div class="modc" title="${esc(libelle)}"><img loading="lazy" src="${src}" alt="${esc(libelle)}" width="120" height="120">${pol}<span class="rk">${rk}</span><span class="nm">${nomBilingue(en, { suivre: false })}</span>${fx}</div>`;
    }
    return `<div class="modc modc-txt" title="${esc(libelle)}">${pol}<span class="nm">${nomBilingue(en, { suivre: false })}</span>${fx}</div>`;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const verifier = process.argv.includes("--verifier");
  let diverge = 0, modifs = 0;
  for (const rel of pagesMain()) {
    const fp = path.join(ROOT, rel), a = fs.readFileSync(fp, "utf8"), b = harmoniser(a);
    if (a !== b) { diverge++; if (!verifier) fs.writeFileSync(fp, b); }
    if (harmoniser(b) !== b) { console.error("non idempotent : " + rel); process.exit(2); }
  }
  console.log(`${verifier ? "à harmoniser" : "harmonisé"} : ${diverge} page(s)`);
  if (verifier && diverge) { console.error("✗ des cartes de builds faits main divergent (node scripts/harmoniser_pages_main.mjs)"); process.exit(1); }
}
