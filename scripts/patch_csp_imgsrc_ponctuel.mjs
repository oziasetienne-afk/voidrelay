// Patch ponctuel (09/07/2026) : ajoute https://warframe.market à img-src dans le CSP déjà
// généré sur les pages existantes, pour corriger les 39 erreurs CSP dues aux vignettes de
// secours "unknown.thumb.png" chargées depuis warframe.market sur ~19 pages objet sans image
// locale. Ne touche PAS hub.html (réservé au chantier design en cours sur une autre branche).
import { readFileSync, writeFileSync } from "node:fs";

const OLD = `img-src 'self' data: https://*.googlesyndication.com https://*.g.doubleclick.net https://*.google.com;`;
const NEW = `img-src 'self' data: https://warframe.market https://*.googlesyndication.com https://*.g.doubleclick.net https://*.google.com;`;

const files = readFileSync("/tmp/csp_to_patch.txt", "utf8").trim().split("\n").filter(Boolean);
let changed = 0;
for (const f of files) {
  if (f === "hub.html") continue;
  const html = readFileSync(f, "utf8");
  if (!html.includes(OLD)) { console.warn("SKIP (pattern absent) :", f); continue; }
  writeFileSync(f, html.split(OLD).join(NEW));
  changed++;
}
console.log(`OK : ${changed}/${files.length} fichiers patchés.`);
