#!/usr/bin/env node
/* Notifie les moteurs IndexNow (Bing, Yandex, Seznam, Naver…) des URLs du site.
 * Aucun compte requis : un fichier-clé <key>.txt à la racine suffit (verif auto).
 * Lit les sitemaps, dédoublonne, envoie par lots de 10 000. Usage : node scripts/indexnow.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "voidrelay.fr";
const KEY = (process.env.INDEXNOW_KEY || fs.readFileSync(path.join(ROOT, ".indexnow_key"), "utf8")).trim();
// 09/07/2026 : sitemaps des anciens jeux retirés (osrs/poe/d2/jeux — supprimés du site
// en 2026, leurs URLs sont des 301 vers l'accueil ; les référencer ici était mort de toute
// façon, les fichiers n'existant plus sur le disque).
const SITEMAPS = ["sitemap.xml"];

const urls = new Set();
for (const sm of SITEMAPS) {
  const p = path.join(ROOT, sm);
  if (!fs.existsSync(p)) continue;
  const xml = fs.readFileSync(p, "utf8");
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(m[1].trim());
}
const list = [...urls];
console.log(`IndexNow : ${list.length} URLs à soumettre (clé ${KEY.slice(0, 6)}…)`);

let ok = 0, fail = 0;
for (let i = 0; i < list.length; i += 10000) {
  const batch = list.slice(i, i + 10000);
  const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: batch };
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
    console.log(`  lot ${i / 10000 + 1} (${batch.length} URLs) -> HTTP ${r.status}`);
    if (r.ok || r.status === 202) ok += batch.length; else fail += batch.length;
  } catch (e) { console.warn("  échec lot:", e.message); fail += batch.length; }
}
console.log(`✅ IndexNow : ${ok} soumises, ${fail} en échec`);
