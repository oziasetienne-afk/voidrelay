/* Garde-fou du résumé de prix CÔTÉ NAVIGATEUR (summarizeStats, js/api.js).

   Le pipeline Python a son propre garde-fou (verifier_prix_rangs.py) et sa
   propre règle : le rang qui porte le plus d'ORDRES DE VENTE, parce qu'il
   répond à « à quel prix puis-je acheter maintenant ». Celui-ci travaille sur
   les STATISTIQUES d'échanges, une autre question — et c'est justement pour ça
   qu'il faut le vérifier à part : deux règles qui vivent dans deux langages ne
   restent cohérentes que si chacune est tenue.

   Ce qui est en jeu : sur un objet à rangs, un seul prix est un mensonge. Le
   04/09/2026, Arcane Energize valait 136,6 p au rang 5 et 8,1 p au rang 0 —
   un facteur dix-sept, et le rang 0 était le PLUS échangé.

   node scripts/verifier_prix_rangs_client.mjs
*/
import { readFileSync } from "node:fs";

// js/api.js est un script de navigateur : on lui donne le minimum pour être
// évalué (il ne touche à rien au chargement, seulement dans ses fonctions).
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {} };
const src = readFileSync(new URL("../js/api.js", import.meta.url), "utf8");
new Function(src + "\n;globalThis.summarizeStats=summarizeStats;")();
const summarizeStats = globalThis.summarizeStats;

let ok = 0, ko = 0;
const dit = (b, t, d) => { if (b) { ok++; console.log("  ✓ " + t + (d ? " — " + d : "")); }
                           else { ko++; console.log("  ✗ " + t + (d ? " — " + d : "")); } };

const paquet = (buckets48, buckets90 = []) => ({
  payload: { statistics_closed: { "48hours": buckets48, "90days": buckets90 } }
});
const b = (median, volume, mod_rank) =>
  mod_rank === undefined ? { median, volume } : { median, volume, mod_rank };

console.log("objets à rangs");
{
  // Arcane Energize, relevé réel du 04/09/2026.
  const s = summarizeStats(paquet([
    b(8.1, 280, 0), b(136.6, 196, 5),
  ]));
  dit(s.rang === 5 && s.price === 136.6,
      "le chiffre principal reste celui du rang MAX", "rang " + s.rang + " à " + s.price);
  dit(s.vol === 196, "et son volume est celui de CE rang, pas la somme des deux", "196, pas 476");
  dit(s.rangs.length === 2, "le détail par rang est rendu");
  dit(s.rangs[0].r === 0 && s.rangs[0].vol === 280,
      "trié du plus ÉCHANGÉ au moins échangé — ici le rang 0, pas le rang max",
      "premier : rang " + s.rangs[0].r + " (" + s.rangs[0].vol + " échangés)");
  dit(s.rangs[0].price === 8.1 && s.rangs[1].price === 136.6,
      "chaque rang porte SON prix", "8.1 et 136.6");
  dit(Math.round(s.rangs[1].price / s.rangs[0].price) === 17,
      "l'écart que le chiffre unique cachait est bien d'un facteur 17");
}
{
  // Primed Flow : le rang 0 domine le volume ET le prix diffère de 2,8x.
  const s = summarizeStats(paquet([b(32.3, 187, 0), b(89.1, 143, 10)]));
  dit(s.rang === 10 && s.rangs[0].r === 0,
      "rang max pour le prix cité, rang le plus échangé en tête du détail",
      "cité : rang " + s.rang + " · plus échangé : rang " + s.rangs[0].r);
}
{
  // Un rang sans prix médian ne doit pas entrer dans le détail : une ligne
  // « rang 3 : 0 p » ferait croire à un objet qui ne vaut rien.
  const s = summarizeStats(paquet([b(50, 10, 0), b(0, 4, 3), b(120, 8, 5)]));
  dit(s.rangs.length === 2 && !s.rangs.some(x => x.r === 3),
      "un rang sans prix médian est écarté du détail, pas affiché à zéro",
      s.rangs.map(x => "rang " + x.r).join(", "));
}

console.log("objets SANS rang");
{
  const s = summarizeStats(paquet([b(78, 40), b(80, 35)]));
  dit(s.rang === null && s.rangs.length === 0,
      "un set n'a pas de rang : aucun détail, aucun libellé à afficher");
  dit(s.vol === 75 && s.price === 80,
      "volume additionné et dernier médian, comme avant", "75 · 80");
}

console.log("replis");
{
  // Le médian du jour peut manquer : on retombe sur l'historique 90 jours.
  const s = summarizeStats(paquet([b(0, 5)], [b(64, 20)]));
  dit(s.price === 64, "sans médian sur 48 h, on retombe sur les 90 jours", "64");
  dit(summarizeStats({}) === null, "un paquet vide rend null, pas un objet creux");
  dit(summarizeStats(paquet([])).price === 0,
      "aucun échange : prix 0, et surtout pas NaN");
}

console.log("-".repeat(70));
if (ko) { console.log("❌ " + ko + " échec(s) sur " + (ok + ko)); process.exit(1); }
console.log("🛡️  GARDE-FOU : le résumé de prix par rang tient — " + ok + " vérifications OK.");
