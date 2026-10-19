#!/usr/bin/env node
/* VoidRelay — rafraîchit data/wm_catalog.json depuis warframe.market (v2/items).
   Catalogue slim : {slug, name, tags, img}. Lancé par pages-objets.yml avant le
   générateur. Node 18+ (fetch natif). Échoue proprement sans écraser si l'API KO. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "wm_catalog.json");
const IMG = "https://warframe.market/static/assets/";

async function main() {
  const r = await fetch("https://api.warframe.market/v2/items", { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("warframe.market v2/items HTTP " + r.status);
  const d = await r.json();
  const items = d.data || [];
  if (!items.length) throw new Error("catalogue vide — abandon (on garde l'ancien)");
  const cat = [];
  for (const i of items) {
    if (!i.slug) continue;
    const loc = (i.i18n && (i.i18n.fr || i.i18n.en)) || {};
    const en = (i.i18n && i.i18n.en) || {};
    const thumb = loc.thumb || en.thumb || "";
    cat.push({ slug: i.slug, name: loc.name || i.slug.replace(/_/g, " "), tags: i.tags || [], img: thumb ? IMG + thumb : "" });
  }
  cat.sort((a, b) => a.slug.localeCompare(b.slug));
  fs.writeFileSync(OUT, JSON.stringify(cat));
  console.log(`✅ catalogue rafraîchi : ${cat.length} objets`);
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
