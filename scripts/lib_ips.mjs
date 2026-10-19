/* v99 — Garde-fou Impact / Perforation / Tranchant (IPS) contre le wiki.
   Le 27/09/2026, 430 armes du simulateur avaient Perforation et Tranchant
   INVERSÉS (Boltor Prime : 41,4 de Tranchant au lieu de Perforation) : WFCD s'était
   trompé, puis s'est corrigé, et rien ne l'avait vu. Tout ce qui dépend du
   Tranchant (saignement, Munitions du Chasseur, part de chaque type) était faux.
   On compare la première attaque de chaque arme à celle des modules de données du
   wiki officiel et on compte les INVERSIONS P/T (le motif exact de ce défaut) —
   pas les simples écarts : les arcs n'ont pas la même « première attaque » (tir
   chargé) des deux côtés, 24 désaccords légitimes mesurés le 27/09/2026. */
import { tableLuaRetournee } from "./lib_lua.mjs";

const proche = (a, b) => Math.abs(a - b) <= Math.max(0.15, b * 0.02);

export function inversionsIPS(armes, luaTextes) {
  const wiki = new Map();
  for (const lua of luaTextes) {
    for (const e of Object.values(tableLuaRetournee(lua))) {
      if (!e || !e.InternalName) continue;
      const d = ((e.Attacks || [])[0] || {}).Damage || {};
      wiki.set(e.InternalName, { p: d.Puncture || 0, s: d.Slash || 0 });
    }
  }
  const inversees = [];
  let comparees = 0;
  for (const cat of ["Primary", "Secondary", "Melee"]) {
    for (const w of armes[cat] || []) {
      const k = wiki.get(w.un);
      if (!k || k.p === k.s) continue;          // P = T : une inversion ne se verrait pas
      comparees++;
      const p = (w.dmg || {}).puncture || 0, s = (w.dmg || {}).slash || 0;
      if (proche(p, k.s) && proche(s, k.p) && !(proche(p, k.p) && proche(s, k.s))) inversees.push(w.n);
    }
  }
  return { comparees, inversees };
}
