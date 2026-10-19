#!/usr/bin/env node
/* ============================================================================
 *  VoidRelay — générateur de post social FACELESS.
 *  Lit data/summary.json, choisit l'évènement le plus "postable" du moment
 *  (Baro > Prime Resurgence > plus gros mouvement marché > meilleur ducat/plat),
 *  et écrit dans social/ :
 *    • latest.svg  : visuel de marque 1080×1080 (vectoriel)
 *    • latest.png  : même visuel rasterisé (si 'sharp' est dispo — CI)
 *    • latest.txt  : légende FR prête à coller + hashtags + lien
 *    • latest.json : métadonnées (type d'évènement, date)
 *  La PUBLICATION reste manuelle (comptes du Chef). Zéro dépendance obligatoire.
 *  Usage : node scripts/social_post.mjs
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "social");
const SITE = "voidrelay.fr";
const xml = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const titleCase = s => String(s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const s = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "summary.json"), "utf8"));
const items = (s.market && s.market.items) || [];
const movers = s.marketMovers || [];

/* --- choix de l'évènement --- */
function pickEvent() {
  const baro = s.baro || {};
  if (baro.active) return { type: "baro", tag: "BARO KI'TEER EST LÀ", title: baro.location || "Relais", sub: "Inventaire exclusif + prix du marché", cta: "/hub" };
  const resu = s.resurgence || {};
  if (resu.active && (resu.featured || []).length) return { type: "resurgence", tag: "PRIME RESURGENCE", title: (resu.featured || []).slice(0, 2).join(" · "), sub: "Primes obtenables chez Varzia (Aya régalien)", cta: "/bons-plans" };
  // plus gros mouvement de prix
  const pool = items.filter(i => typeof i.change24h === "number");
  pool.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
  const top = pool[0] || movers[0];
  if (top && Math.abs(top.change24h || 0) >= 3) {
    const upd = (top.change24h || 0) >= 0;
    return { type: "mover", tag: upd ? "EN HAUSSE AUJOURD'HUI" : "EN BAISSE — À ACHETER", title: titleCase(top.slug), sub: `${upd ? "+" : ""}${top.change24h}% en 24 h · ${top.minSellPlat || top.median || "?"} platine`, cta: "/o/" + top.slug };
  }
  // meilleur rendement ducats
  const duc = items.filter(i => i.ducatsPerPlat).sort((a, b) => b.ducatsPerPlat - a.ducatsPerPlat)[0];
  if (duc) return { type: "ducat", tag: "MEILLEUR RENDEMENT DUCATS", title: titleCase(duc.slug), sub: `${duc.ducatsPerPlat.toFixed(2)} ducats/platine · ${duc.ducats} ducats`, cta: "/o/" + duc.slug };
  return { type: "daily", tag: "MARCHÉ WARFRAME", title: "Prix du platine en direct", sub: "Hausses, ducats & bons plans du jour", cta: "/bons-plans" };
}

/* --- visuel SVG 1080×1080, sans visage, aux couleurs VoidRelay --- */
function svg(ev) {
  const wrapTitle = t => {
    const words = String(t).split(" "); const lines = []; let cur = "";
    for (const w of words) { if ((cur + " " + w).trim().length > 18) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
    if (cur.trim()) lines.push(cur.trim());
    return lines.slice(0, 3);
  };
  const tl = wrapTitle(ev.title);
  const titleSvg = tl.map((l, i) => `<text x="90" y="${560 + i * 96}" font-family="Inter, Arial, sans-serif" font-size="84" font-weight="800" fill="#ffffff">${xml(l)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b0f14"/><stop offset="1" stop-color="#0e1a22"/></linearGradient></defs>
<rect width="1080" height="1080" fill="url(#bg)"/>
<rect x="0" y="0" width="1080" height="10" fill="#39d0d8"/>
<g transform="translate(90,110)"><path d="M0 6 L26 50 L52 6" fill="none" stroke="#39d0d8" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><text x="74" y="44" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="800" fill="#ffffff">VoidRelay</text></g>
<rect x="90" y="370" width="${Math.min(900, 60 + ev.tag.length * 26)}" height="64" rx="14" fill="rgba(57,208,216,.14)" stroke="#39d0d8" stroke-width="2"/>
<text x="116" y="412" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#39d0d8" letter-spacing="2">${xml(ev.tag)}</text>
${titleSvg}
<text x="90" y="${590 + tl.length * 96}" font-family="Inter, Arial, sans-serif" font-size="40" fill="#c7d2dd">${xml(ev.sub)}</text>
<rect x="0" y="930" width="1080" height="150" fill="rgba(57,208,216,.08)"/>
<text x="90" y="1010" font-family="Inter, Arial, sans-serif" font-size="46" font-weight="700" fill="#39d0d8">${SITE}${xml(ev.cta)}</text>
<text x="90" y="1052" font-family="Inter, Arial, sans-serif" font-size="28" fill="#8b97a4">Tableau de bord Warframe · prix en direct · gratuit</text>
</svg>`;
}

/* --- légende prête à poster --- */
function caption(ev) {
  const url = `https://${SITE}${ev.cta}`;
  const head = {
    baro: `🛒 Baro Ki'Teer est là — ${ev.title} !`,
    resurgence: `🔄 Prime Resurgence : ${ev.title} de retour chez Varzia.`,
    mover: `📊 ${ev.title} : ${ev.sub}.`,
    ducat: `💎 ${ev.title} — ${ev.sub}.`,
    daily: `📊 Le marché Warframe du jour.`,
  }[ev.type];
  const tags = "#Warframe #Warframefr #WarframeMarket #Tenno #PrimeTime #Platinum #WarframeTrading";
  return `${head}\n\nPrix en direct, ducats, reliques & bons plans — gratuit, sans compte :\n👉 ${url}\n\n${tags}\n`;
}

/* --- écriture --- */
fs.mkdirSync(OUT, { recursive: true });
const ev = pickEvent();
const svgStr = svg(ev);
fs.writeFileSync(path.join(OUT, "latest.svg"), svgStr);
fs.writeFileSync(path.join(OUT, "latest.txt"), caption(ev));
fs.writeFileSync(path.join(OUT, "latest.json"), JSON.stringify({ ...ev, generatedAtNote: "stamp côté CI" }, null, 2));

let png = false;
try {
  const sharp = (await import("sharp")).default;
  await sharp(Buffer.from(svgStr)).png().toFile(path.join(OUT, "latest.png"));
  png = true;
} catch (e) { /* sharp absent en local : SVG seul, rasterisé ailleurs */ }

console.log(`✅ post social généré (${ev.type}) : social/latest.svg${png ? " + latest.png" : " (PNG via sharp en CI)"} + latest.txt`);
console.log("--- légende ---\n" + caption(ev));
