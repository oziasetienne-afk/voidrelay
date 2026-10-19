#!/usr/bin/env node
/* Classe les objets de data/wm_catalog.json par volume d'échange réel sur
 * warframe.market (48h, achat+vente cumulés, statistics_live), pour choisir
 * un lot EN mesurable plutôt qu'arbitraire (cf. décision du 2026-07-10 :
 * ouvrir /en/o/ sur les ~250 objets les plus échangés avant d'étendre aux
 * 3834). Script ponctuel, pas un cron : à relancer manuellement si le lot
 * EN doit être recalculé plus tard.
 *
 * Usage : node scripts/rank_items_by_wm_volume.mjs [--top=250]
 * Écrit : data/en_objects_ranking.json (classement complet, transparence)
 *         data/en_objects_selection.json (slugs retenus, lus par le générateur)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOP_N = Number((process.argv.find(a => a.startsWith("--top=")) || "--top=250").split("=")[1]) || 250;
// Sériel, pas concurrent : l'API warframe.market renvoie 429 dès ~8 requêtes
// simultanées (vérifié empiriquement le 10/07/2026 — 270/300 échecs à concurrence
// 8, silencieusement comptés comme "volume 0" par un premier essai bugué). 1
// requête / 200 ms tient la charge sans aucun 429 sur des échantillons testés.
const DELAY_MS = 200;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data/wm_catalog.json"), "utf8"));
console.log(`Classement de ${catalog.length} objets par volume warframe.market 48h (sériel, ${DELAY_MS}ms entre requêtes, ~${Math.round(catalog.length * DELAY_MS / 60000)} min estimées)...`);

async function fetchVolume(slug, retriesLeft = 3) {
  try {
    const r = await fetch(`https://api.warframe.market/v1/items/${encodeURIComponent(slug)}/statistics`);
    if (r.status === 429) {
      if (retriesLeft <= 0) return { volume: 0, failed: true };
      await sleep(1000);
      return fetchVolume(slug, retriesLeft - 1);
    }
    if (!r.ok) return { volume: 0, failed: true };
    const d = await r.json();
    const h48 = d?.payload?.statistics_live?.["48hours"] || [];
    return { volume: h48.reduce((sum, e) => sum + (e.volume || 0), 0), failed: false };
  } catch {
    if (retriesLeft > 0) { await sleep(1000); return fetchVolume(slug, retriesLeft - 1); }
    return { volume: 0, failed: true };
  }
}

const results = [];
let failedCount = 0;
for (let i = 0; i < catalog.length; i++) {
  const it = catalog[i];
  const { volume, failed } = await fetchVolume(it.slug);
  if (failed) failedCount++;
  results.push({ slug: it.slug, name: it.name, tags: it.tags, volume48h: volume, dataFailed: failed });
  if ((i + 1) % 250 === 0) console.log(`  ${i + 1}/${catalog.length}... (${failedCount} échecs jusqu'ici)`);
  await sleep(DELAY_MS);
}
console.log(`Terminé. ${failedCount}/${catalog.length} requêtes en échec définitif après retries.`);

const ranked = results.slice().sort((a, b) => b.volume48h - a.volume48h);
fs.writeFileSync(path.join(ROOT, "data/en_objects_ranking.json"), JSON.stringify(ranked, null, 2));

// Un échec réseau persistant n'est PAS un volume nul : on l'exclut de la
// sélection plutôt que de le classer artificiellement en bas de liste.
const selection = ranked.filter(x => !x.dataFailed).slice(0, TOP_N).map(x => x.slug);
fs.writeFileSync(path.join(ROOT, "data/en_objects_selection.json"), JSON.stringify(selection, null, 2));

const zeroVolume = ranked.filter(x => x.volume48h === 0 && !x.dataFailed).length;
console.log(`✅ Classement écrit : data/en_objects_ranking.json (${ranked.length} objets)`);
console.log(`✅ Sélection EN écrite : data/en_objects_selection.json (${selection.length} objets, top ${TOP_N} hors échecs)`);
console.log(`   (info : ${zeroVolume} objets à volume 48h réellement nul, ${failedCount} en échec exclus de la sélection)`);
