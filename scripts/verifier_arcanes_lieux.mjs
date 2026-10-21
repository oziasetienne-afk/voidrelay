#!/usr/bin/env node
/* Garde-fou : data/arcanes.json ne perd jamais un lieu d'obtention (21/10/2026).
   Une régénération brute depuis WFCD vidait le champ d de 35 arcanes (lacune WFCD) et
   remplaçait « The Holdfasts (Cavalero) » par « Thrax Centurion » sur 15 arcanes du
   Zariman, alors que le wiki confirme les deux sources. Le plancher
   (scripts/arcanes_lieux_plancher.json) est l'état de main au 21/10/2026 : on peut
   l'enrichir, jamais l'amputer. Vérifie aussi que Arcane Precision porte « Point Faible »
   (Update 44.0). Utilisable en import pour les tests : verifie(arcanes, plancher). */
import { readFileSync } from "node:fs";

const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();

export function verifie(arcanes, plancher) {
  const erreurs = [];
  const par = new Map(arcanes.map((a) => [a.n, a]));
  for (const [nom, lieux] of Object.entries(plancher)) {
    const a = par.get(nom);
    if (!a) { erreurs.push(`${nom} : arcane disparu`); continue; }
    const ont = new Set(String(a.d || "").split(" · ").map(norm));
    const perdus = lieux.filter((l) => !ont.has(norm(l)));
    if (perdus.length) erreurs.push(`${nom} perd : ${perdus.join(" | ")}`);
  }
  const p = par.get("Arcane Precision");
  if (!p || !/Point Faible/.test(p.e)) erreurs.push("Arcane Precision ne contient pas « Point Faible »");
  return erreurs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arcanes = JSON.parse(readFileSync("data/arcanes.json", "utf8"));
  const plancher = JSON.parse(readFileSync("scripts/arcanes_lieux_plancher.json", "utf8"));
  const e = verifie(arcanes, plancher);
  if (e.length) { console.error("✗ arcanes : " + e.length + " défaut(s)\n  " + e.slice(0, 20).join("\n  ")); process.exit(1); }
  console.log(`✓ arcanes : ${Object.keys(plancher).length} arcanes gardent tous leurs lieux, Precision = Point Faible`);
}
