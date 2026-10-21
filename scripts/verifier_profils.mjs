/* Garde-fou des cinq classements de marché (js/profil-classement.js).

   Sans navigateur : les fonctions sont pures, on leur donne un marché fabriqué
   dont on connaît la réponse à la main. Ce qui est vérifié n'est pas « la page
   s'affiche » mais « le chiffre est le bon » — et surtout les quatre pièges qui
   rendraient les classements FAUX sans qu'aucune page ne casse :

     1. le nombre de pièces (Akbolto Prime : deux canons) ;
     2. les sets imbriqués (Aklex Prime : deux Lex Prime entières) ;
     3. une pièce sans prix écarte le set au lieu de le sous-évaluer ;
     4. l'ordre de vente fantôme, très en dessous du deuxième prix.

   node scripts/verifier_profils.mjs
*/
import { readFileSync } from "node:fs";

globalThis.window = globalThis;
new Function(readFileSync(new URL("../js/profil-classement.js", import.meta.url), "utf8"))();
const C = globalThis.VRClass;

let ok = 0, ko = 0;
const dit = (b, t, d) => { if (b) { ok++; console.log("  ✓ " + t + (d ? " — " + d : "")); }
                           else { ko++; console.log("  ✗ " + t + (d ? " — " + d : "")); } };

/* ------------------------------------------------------------------ marché */
const M = [
  // cher, peu de vendeurs, médiane bien au-dessus du plus bas
  { slug: "rare_set", minSellPlat: 100, median: 150, maxBuyPlat: 90, sellOrders: 6,
    low5SellPlat: [100, 104, 105], high5BuyPlat: [90, 88, 85], ducats: 200 },
  // ordre fantôme côté VENTE : 10 alors que le deuxième est à 40
  { slug: "fantome_set", minSellPlat: 10, median: 45, maxBuyPlat: 38, sellOrders: 30,
    low5SellPlat: [10, 40, 41, 42, 43], high5BuyPlat: [38, 37, 36], ducats: 100 },
  // ordre isolé côté ACHAT : Arcane Steadfast au rang 5, relevé du 03/09/2026
  { slug: "steadfast_arcane", minSellPlat: 180, median: 185, maxBuyPlat: 840, sellOrders: 13,
    low5SellPlat: [180, 180, 185], high5BuyPlat: [840, 150, 150, 145], rang: 5, ducats: 0 },
  // Relevé réel du 04/09/2026 : TROIS demandes absurdes d'affilée avant le vrai
  // marché. C'est le cas que « prendre le deuxième » ne couvre pas.
  { slug: "grappe_arcane", minSellPlat: 170, median: 180, maxBuyPlat: 900, sellOrders: 12,
    low5SellPlat: [170, 175, 180], high5BuyPlat: [900, 840, 600, 150, 150], rang: 5, ducats: 0 },
  // banal
  { slug: "banal_set", minSellPlat: 20, median: 22, maxBuyPlat: 21, sellOrders: 40,
    low5SellPlat: [20, 20, 21], high5BuyPlat: [21, 20, 20], ducats: 45 },
  // aucun acheteur
  { slug: "sansachat_set", minSellPlat: 30, median: 30, maxBuyPlat: null, sellOrders: 9,
    low5SellPlat: [30, 31], high5BuyPlat: [], ducats: 300 },
  // les pièces (prix pris dans market_pieces)
  { slug: "lex_prime_set", minSellPlat: 12, median: 14, maxBuyPlat: 11, sellOrders: 50,
    low5SellPlat: [12, 12, 13], high5BuyPlat: [11, 11, 10] },
];
const PIECES = {
  akbolto_prime_barrel:   { minSellPlat: 15, sellOrders: 20, maxBuyPlat: 12 },
  akbolto_prime_blueprint:{ minSellPlat: 10, sellOrders: 20, maxBuyPlat: 8 },
  akbolto_prime_link:     { minSellPlat: 20, sellOrders: 20, maxBuyPlat: 18 },
  akbolto_prime_receiver: { minSellPlat: 25, sellOrders: 20, maxBuyPlat: 22 },
  aklex_prime_blueprint:  { minSellPlat: 5,  sellOrders: 20, maxBuyPlat: 4 },
  aklex_prime_link:       { minSellPlat: 7,  sellOrders: 20, maxBuyPlat: 6 },
  incomplet_piece_a:      { minSellPlat: 9,  sellOrders: 3,  maxBuyPlat: 8 },
  incomplet_piece_b:      { minSellPlat: null, sellOrders: 0, maxBuyPlat: null },
};
const RECETTE = {
  akbolto_prime_set: { nom: "Akbolto Prime", pieces: [
    { slug: "akbolto_prime_barrel", nom: "Barrel", n: 2 },
    { slug: "akbolto_prime_blueprint", nom: "Blueprint", n: 1 },
    { slug: "akbolto_prime_link", nom: "Link", n: 1 },
    { slug: "akbolto_prime_receiver", nom: "Receiver", n: 2 }] },
  aklex_prime_set: { nom: "Aklex Prime", pieces: [
    { slug: "aklex_prime_blueprint", nom: "Blueprint", n: 1 },
    { slug: "aklex_prime_link", nom: "Link", n: 1 },
    { slug: "lex_prime_set", nom: "Lex Prime", n: 2, imbrique: true }] },
  incomplet_set: { nom: "Incomplet", pieces: [
    { slug: "incomplet_piece_a", nom: "A", n: 1 },
    { slug: "incomplet_piece_b", nom: "B", n: 1 }] },
};
// Les deux sets montables doivent exister côté marché pour avoir un prix de revente.
M.push({ slug: "akbolto_prime_set", minSellPlat: 130, median: 140, maxBuyPlat: 118,
         sellOrders: 15, low5SellPlat: [130, 132], high5BuyPlat: [118, 117], ducats: 350 });
M.push({ slug: "aklex_prime_set", minSellPlat: 60, median: 70, maxBuyPlat: 55,
         sellOrders: 15, low5SellPlat: [60, 62], high5BuyPlat: [55, 54], ducats: 250 });
M.push({ slug: "incomplet_set", minSellPlat: 40, median: 44, maxBuyPlat: 35,
         sellOrders: 5, low5SellPlat: [40, 41], high5BuyPlat: [35, 34], ducats: 90 });

/* ----------------------------------------------------------------- farmeur */
console.log("🎯 farmeur");
{
  const r = C.farmeur(M);
  dit(r[0].slug === "steadfast_arcane" && r[0].valeur === 180,
      "classé sur la vente la plus basse, pas sur la médiane", r[0].slug + " à " + r[0].valeur);
  const rare = r.find(x => x.slug === "rare_set");
  dit(rare.rare === true && rare.median === 150,
      "peu de vendeurs signalé, médiane gardée comme plafond", "6 ordres, médiane 150");
  dit(rare.ecrase === true, "médiane 1,35× au-dessus du plus bas : marché écrasé", "150 / 100");
  dit(r.find(x => x.slug === "banal_set").ecrase === false,
      "un écart normal n'est pas signalé comme écrasé", "22 / 20");
  dit(r.every(x => x.valeur !== null), "aucune ligne sans prix d'achat réel");
}

/* ----------------------------------------------------------------- monteur */
console.log("🧩 monteur de set");
{
  const { lignes, incomplets } = C.monteur(M, RECETTE, PIECES);
  const ak = lignes.find(x => x.slug === "akbolto_prime_set");
  // 2×15 + 10 + 20 + 2×25 = 110 — et surtout PAS 15+10+20+25 = 70.
  dit(ak.cout === 110, "le NOMBRE de pièces compte (2 canons, 2 récepteurs)", "coût " + ak.cout + ", pas 70");
  dit(ak.ecartPatient === 30 && ak.ecartRapide === 8 && ak.ecartAligne === 20,
      "trois écarts : patient (médiane), aligné (vente la plus basse), rapide (meilleur achat)",
      "140−110=30 · 130−110=20 · 118−110=8");
  dit(ak.trades === 7, "le nombre de rendez-vous en jeu est dit", "6 achats + 1 vente");
  const al = lignes.find(x => x.slug === "aklex_prime_set");
  // 5 + 7 + 2×12 = 36 : le prix des Lex Prime vient du MARCHÉ, pas des pièces.
  dit(al.cout === 36, "set imbriqué : 2 Lex Prime entières, prix pris au marché", "coût " + al.cout);
  dit(al.pieces.some(p => p.imbrique && p.n === 2), "la pièce imbriquée est marquée comme telle");
  dit(!lignes.some(x => x.slug === "incomplet_set"),
      "une pièce sans prix ÉCARTE le set au lieu de le sous-évaluer");
  dit(incomplets.length === 1 && incomplets[0].piece === "B",
      "et la pièce manquante est nommée", incomplets[0].piece);
  dit(lignes[0].ecartAligne >= lignes[lignes.length - 1].ecartAligne,
      "trié sur l'écart ALIGNÉ, pas sur l'optimiste — acheter au plus bas et revendre à la médiane serait tricher");
}

/* ----------------------------------------------------------------- flipper */
console.log("⚡ flipper");
{
  const r = C.flipper(M);
  const f = r.find(x => x.slug === "fantome_set");
  dit(f.fantome === true, "vente la plus basse très loin de la deuxième : signalée fantôme", "10 vs 40");
  dit(f.margeImmediate === 28,
      "la marge AFFICHÉE est celle des carnets bruts — gardée, mais pas crue", "38−10=28");
  dit(f.margeInstant === -3,
      "l'aller-retour écarte les deux extrêmes et retourne le signe", "37−40=−3, pas +28");
  dit(f.margePatiente === 5,
      "la marge patiente achète la 2ᵉ offre et revend à la médiane", "45−40=5");
  const st = r.find(x => x.slug === "steadfast_arcane");
  dit(st.achatDouteux === true, "demande d'achat isolée : signalée", "840 alors que la suivante est à 150");
  dit(st.margeImmediate === 660 && st.margeInstant === -30,
      "les 660 platine imaginaires ne trient plus rien", "aller-retour réel : 150−180=−30");
  dit(r.indexOf(st) > 0 && r[0].margePatiente > st.margePatiente,
      "et les 660 platine ne la mettent plus en tête : elle passe derrière de vraies marges",
      "rang " + (r.indexOf(st) + 1) + " sur " + r.length + ", patiente +" + st.margePatiente);
  dit(r.find(x => x.slug === "banal_set").fantome === false,
      "un premier prix normal n'est pas signalé", "20 vs 20");
  dit(r.find(x => x.slug === "sansachat_set").margeImmediate === null,
      "sans ordre d'achat, pas de marge immédiate inventée");
  dit(r[0].margePatiente >= (r[r.length - 1].margePatiente ?? -1e9),
      "trié sur la marge patiente — mesurée positive sur 94 objets réels quand l'aller-retour l'était sur zéro");

  const v = C.verdictFlip(r);
  dit(v.total === r.length && v.patient >= 1,
      "le verdict compte les deux familles de marges", v.instant + " aller-retour · " + v.patient + " patientes");
  dit(v.meilleurPatient === r[0].margePatiente,
      "et rappelle la meilleure marge patiente", "+" + v.meilleurPatient);
  const aucun = C.verdictFlip(C.flipper([
    { slug: "x_set", minSellPlat: 20, median: 20, maxBuyPlat: 18, sellOrders: 5,
      low5SellPlat: [20, 21], high5BuyPlat: [18, 17] }]));
  dit(aucun.instant === 0 && aucun.patient === 0,
      "quand rien ne paie, le verdict le dit au lieu de classer des pertes");
}

/* ---------------------------------------------------------------- ducatier */
console.log("💎 ducatier");
{
  const r = C.ducatier(M);
  dit(r[0].slug === "sansachat_set" && r[0].ratio === 10,
      "ratio ducats / platine au prix médian des cinq offres les plus basses", "300 ducats / 30 p = 10");
  // Piège 4 : l'offre fantôme à 10 p (la deuxième à 40) faisait de fantome_set le
  // « meilleur farm de ducats » (100 / 10 = 10) ; à la médiane il vaut 2,22.
  dit(r.find(x => x.slug === "fantome_set").ratio === 2.22 && r.find(x => x.slug === "fantome_set").faible,
      "l'ordre fantôme ne fabrique plus le meilleur ducatier", "100 / 45 = 2,22, pas 100 / 10");
  dit(r.find(x => x.slug === "sansachat_set").bon === true,
      "au-dessus de 10 ducats/platine : bonne affaire", "300 / 30 = 10");
  dit(r.find(x => x.slug === "banal_set").faible === true,
      "en dessous de 5 : autant vendre la pièce", "45 / 20 = 2,25");
  dit(!r.some(x => x.slug === "lex_prime_set"), "sans valeur en ducats, la ligne sort");
}

/* ---------------------------------------------------------------- débutant */
console.log("🌱 débutant");
{
  const r = C.debutant(M);
  const banal = r.find(x => x.slug === "banal_set");
  dit(banal.part === 91 && banal.achat === 20,
      "la part est celle de la médiane qu'un acheteur donne DÉJÀ", "2ᵉ demande 20 / médiane 22 = 91 %");
  dit(!r.some(x => x.slug === "sansachat_set"),
      "sans acheteur en attente, la ligne sort — il n'y a rien à vendre tout de suite");
  const gr = r.find(x => x.slug === "grappe_arcane");
  dit(gr.part === 100 && gr.achat === 180 && gr.plafonne === true,
      "TROIS demandes gonflées d'affilée ne passent pas : la demande est plafonnée à la médiane",
      "900/840/600 ignorées → " + gr.achat + " (" + gr.part + " %)");
  dit(r.every(x => x.part <= 100),
      "aucune part ne peut dépasser 100 % — le plafond ne dépend pas du NOMBRE d'ordres douteux",
      "part max " + Math.max(...r.map(x => x.part)) + " %");
  const st = r.find(x => x.slug === "steadfast_arcane");
  dit(st.achat === 150 && st.part === 81,
      "la DEUXIÈME demande fait foi : c'est le profil le moins armé pour flairer un ordre isolé",
      "150 (pas 840) sur une médiane de 185");
  const rare = r.find(x => x.slug === "rare_set");
  dit(rare.perte === 62, "ce que la vente immédiate coûte est chiffré", "150 − 88 = 62");
  dit(r.every((x, i) => i === 0 || r[i - 1].part >= x.part),
      "trié par part décroissante", r.map(x => x.part).join(" ≥ "));
}

/* ------------------------------------------------- /outils : « tes outils »
   La correspondance outil → profils vit SUR LA CARTE (`data-pf`), pas dans une
   liste tenue à part : une carte ajoutée demain porte ses profils avec elle. Ce
   qui doit être gardé, c'est justement qu'on ne l'oublie pas — un outil sans
   `data-pf` disparaît silencieusement de tous les profils, et un profil sans
   aucun outil renvoie un visiteur sur une page qui l'ignore. */
console.log("🧰 /outils");
{
  const IDS = new Set(C ? [] : []);
  for (const p of ["farmeur", "monteur", "flipper", "ducatier", "debutant"]) IDS.add(p);
  for (const [f, attendu] of [["outils.html", null], ["en/tools.html", null]]) {
    const html = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    const cartes = html.match(/<a class="tool-card"[^>]*>/g) || [];
    const avec = cartes.filter(c => /\sdata-pf="/.test(c));
    dit(cartes.length > 0 && avec.length === cartes.length,
        f + " : chaque carte d'outil porte data-pf",
        avec.length + " / " + cartes.length + " cartes");
    const inconnus = new Set();
    const couverts = new Set();
    for (const c of avec) {
      const v = (c.match(/data-pf="([^"]*)"/) || [, ""])[1].trim();
      for (const id of v ? v.split(/\s+/) : []) (IDS.has(id) ? couverts : inconnus).add(id);
    }
    dit(inconnus.size === 0, f + " : aucun profil inventé dans data-pf",
        inconnus.size ? [...inconnus].join(", ") : "les cinq ids connus, rien d'autre");
    const orphelins = [...IDS].filter(id => !couverts.has(id));
    dit(orphelins.length === 0, f + " : chaque profil a au moins un outil",
        orphelins.length ? "sans outil : " + orphelins.join(", ") : couverts.size + " profils servis");
    const tous = avec.filter(c => {
      const v = (c.match(/data-pf="([^"]*)"/) || [, ""])[1].trim();
      return v && v.split(/\s+/).length === IDS.size;
    });
    dit(tous.length < cartes.length,
        f + " : aucun profil ne reçoit TOUTES les cartes — sinon il ne trie rien",
        tous.length + " carte(s) commune(s) aux cinq profils sur " + cartes.length);
  }
  /* Le nombre d'outils annoncé en toutes lettres avait vieilli une fois déjà
     (« Quinze » pour 17). Il est maintenant en chiffres, donc vérifiable. */
  const html = readFileSync(new URL("../outils.html", import.meta.url), "utf8");
  const n = (html.match(/<a class="tool-card"/g) || []).length;
  const annonce = (html.match(/(\d+) outils Warframe gratuits/) || [])[1];
  dit(annonce !== undefined && Number(annonce) === n,
      "/outils : le nombre annoncé est celui des cartes présentes",
      "annoncé " + annonce + " · compté " + n);
}

console.log("-".repeat(70));
if (ko) { console.log("❌ " + ko + " échec(s) sur " + (ok + ko)); process.exit(1); }
console.log("🛡️  GARDE-FOU : les cinq classements tiennent — " + ok + " vérifications OK.");
