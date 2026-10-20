#!/usr/bin/env node
/* Garde-fou : aucun lien interne ne doit mener à une page qui n'existe pas.

   Mesuré le 04/09/2026 sur les 4185 pages du site : quatre liens morts, tous
   invisibles tant qu'on ne clique pas.

     /rss.xml                     le pied de page annonçait un flux RSS… à la
                                  mauvaise adresse. Le vrai flux existe et vit
                                  depuis toujours à /data/feed.xml.
     /en/o/styanax_prime_set      trois objets cités par le guide « Jade Shadows »
     /en/o/athodai_prime_set      anglais, absents du lot EN restreint : trois
     /en/o/afentis_prime_set      404 dans un guide publié.

   Un lien mort ne casse aucune page, ne rougit aucun test, et ne se voit que du
   côté du visiteur — d'où ce garde-fou plutôt qu'une relecture.

   Les href construits en JavaScript (`/o/${slug}`, `/builds/'+esc(x)+'`) ne sont
   pas des adresses : ils sont écartés sur les caractères qu'une URL statique de
   ce site ne contient jamais. */
import fs from "fs";
import path from "path";

const DEPOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
/* VR_RACINE = le dossier PUBLIÉ (_site/, 21/10/2026) : les mêmes contrôles y disent
   si la liste blanche de scripts/construire_site.sh a oublié un fichier du site. */
const ROOT = process.env.VR_RACINE ? path.resolve(process.env.VR_RACINE) : DEPOT;
const SITE = "https://voidrelay.fr";
let ok = 0, ko = 0;
const dit = (c, quoi, det) => { c ? ok++ : ko++; console.log(`  ${c ? "✓" : "✗"} ${quoi}${det ? " — " + det : ""}`); };

const DOSSIERS = ["", "en", "guides", "en/guides", "o", "en/o", "o/c", "builds", "en/builds"];
function pages() {
  const out = [];
  for (const d of DOSSIERS) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) if (f.endsWith(".html")) out.push(d ? `${d}/${f}` : f);
  }
  return out;
}

/* Une URL de ce site : que des caractères d'adresse. Tout le reste est du code. */
const estAdresse = u => /^\/[A-Za-z0-9/_.()~-]*$/.test(u);

const cache = new Map();
function existe(u) {
  if (cache.has(u)) return cache.get(u);
  const p = u.replace(/^\//, "");
  const cibles = u.endsWith("/") ? [p + "index.html"] : [p, p + ".html", path.join(p, "index.html")];
  const r = u === "/" ? true : cibles.some(c => fs.existsSync(path.join(ROOT, c)));
  cache.set(u, r);
  return r;
}

console.log("🔗 liens internes");
const liste = pages();
const morts = new Map();      // url morte -> première page qui la porte
let vus = 0;

for (const rel of liste) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    let u = m[1];
    if (u.startsWith(SITE)) u = u.slice(SITE.length) || "/";   // hreflang & canoniques
    else if (!u.startsWith("/") || u.startsWith("//")) continue;
    u = u.split("#")[0].split("?")[0];
    if (!u || !estAdresse(u)) continue;
    vus++;
    if (!existe(u) && !morts.has(u)) morts.set(u, rel);
  }
}

const detail = [...morts].slice(0, 12).map(([u, f]) => `${u} (dans ${f})`).join(" · ");
dit(morts.size === 0, "chaque lien interne mène à une page qui existe",
    morts.size ? `${morts.size} mort(s) : ${detail}` : `${vus} liens vérifiés sur ${liste.length} pages`);

/* Les mêmes deux familles, mesurées SAINES le 04/09/2026 (0 défaut sur 5688 pages et
   2078 hreflang). Elles sont gardées quand même : ce sont les deux endroits où le
   générateur décide au CAS PAR CAS — `hasEn` n'écrit un hreflang que si l'objet fait
   partie du lot EN, et la moindre régression de cette condition fabrique en masse soit
   des liens vers des pages absentes, soit des paires que Google refuse d'apparier.
   Un garde-fou posé sur du vert coûte 0,3 s et attrape le jour où ça cesse de l'être. */
const srcMorts = new Map();
let srcVus = 0;
for (const rel of liste) {
  for (const m of fs.readFileSync(path.join(ROOT, rel), "utf8").matchAll(/\bsrc="([^"]+)"/g)) {
    const u = m[1].split("?")[0];
    if (!estAdresse(u)) continue;
    srcVus++;
    if (!fs.existsSync(path.join(ROOT, u.slice(1))) && !srcMorts.has(u)) srcMorts.set(u, rel);
  }
}
dit(srcMorts.size === 0, "chaque image, script et feuille de style référencés existent",
    srcMorts.size ? [...srcMorts].slice(0, 8).map(([u, f]) => `${u} (dans ${f})`).join(" · ")
                  : `${srcVus} fichiers référencés`);

const RE_ALT = /<link rel="alternate" hreflang="([a-zA-Z-]+)" href="([^"]+)"/g;
/* /guides/index.html s'annonce « /guides/ », slash FINAL compris : le retirer ferait
   échouer l'appariement sur toutes les pages d'annuaire — et donnerait un faux positif,
   pas un vrai défaut. Mesuré : ces 7 pages sont bel et bien réciproques. */
const urlDe = rel => {
  const u = "/" + rel;
  if (u.endsWith("/index.html")) return u.slice(0, -10);
  return u.endsWith(".html") ? u.slice(0, -5) : u;
};
const fichierDe = u => {
  if (!u.startsWith(SITE)) return null;
  const p = u.slice(SITE.length).replace(/^\//, "") || "index";
  for (const c of [p + ".html", path.join(p, "index.html"), p]) {
    const abs = path.join(ROOT, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return c;
  }
  return null;
};
const altCache = new Map();
const alts = rel => {
  if (!altCache.has(rel)) {
    const out = new Set();
    /* x-default EXCLU : il désigne la version par défaut, pas un appariement de langue.
       Le compter masquerait exactement le défaut cherché — une page EN qui perd son
       hreflang="fr" garde son x-default vers la même URL française et passerait pour
       réciproque. Vérifié en cassant la paire pour de vrai : sans cette exclusion, le
       garde-fou restait vert. */
    for (const m of fs.readFileSync(path.join(ROOT, rel), "utf8").matchAll(RE_ALT)) {
      if (m[1].toLowerCase() !== "x-default") out.add(m[2]);
    }
    altCache.set(rel, out);
  }
  return altCache.get(rel);
};
const hlMorts = [], hlSeuls = [];
let hlPages = 0;
for (const rel of liste) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const paires = [...html.matchAll(RE_ALT)].filter(m => m[1].toLowerCase() !== "x-default");
  if (paires.length) hlPages++;
  for (const m of paires) {
    const cible = fichierDe(m[2]);
    if (!cible) { hlMorts.push(`${rel} → ${m[2]}`); continue; }
    if (cible === rel) continue;
    if (!alts(cible).has(SITE + urlDe(rel))) hlSeuls.push(`${rel} → ${cible}`);
  }
}
dit(hlMorts.length === 0, "chaque hreflang désigne une page qui existe",
    hlMorts.length ? hlMorts.slice(0, 8).join(" · ") : `${hlPages} pages appariées`);
dit(hlSeuls.length === 0, "chaque hreflang est RÉCIPROQUE — sinon Google ignore la paire",
    hlSeuls.length ? hlSeuls.slice(0, 8).join(" · ") : `${hlPages} paires vérifiées dans les deux sens`);

/* Le service worker pré-cache sa coque avec cache.addAll(), qui est ATOMIQUE : une
   seule URL absente et la promesse entière est rejetée, donc l'installation échoue,
   donc il n'y a PLUS DE PWA — ni hors-ligne, ni mise à jour, ni arsenal embarqué.
   Rien ne le signale : le site continue de s'afficher normalement en ligne. C'est le
   défaut le plus cher du répertoire pour le moins de symptômes, et il suffit de
   renommer un fichier de js/ pour le provoquer. */
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const swAbsents = [];
let swVus = 0;
for (const nom of ["SHELL", "ARSENAL"]) {
  const m = sw.match(new RegExp("const " + nom + "\\s*=\\s*\\[([\\s\\S]*?)\\]"));
  if (!m) { swAbsents.push(`liste ${nom} introuvable dans sw.js`); continue; }
  for (const u of m[1].matchAll(/"([^"]+)"/g)) {
    const chemin = u[1].replace(/^\.?\//, "") || "index.html";
    swVus++;
    if (!fs.existsSync(path.join(ROOT, chemin)) && !fs.existsSync(path.join(ROOT, chemin + ".html"))) {
      swAbsents.push(`${nom} → ${u[1]}`);
    }
  }
}
dit(swAbsents.length === 0, "chaque fichier pré-caché par le service worker existe (addAll est atomique)",
    swAbsents.length ? swAbsents.slice(0, 8).join(" · ") : `${swVus} entrées SHELL + ARSENAL`);

/* Les données que le JS va CHERCHER sont des adresses, elles aussi — et
   personne ne les vérifiait. Trouvé le 05/09/2026 par le garde-fou d'exceptions
   JS : js/views.js demandait « data/items.json » en RELATIF. Depuis
   /reliques-ce-soir ça résout vers /data/items.json et marche ; depuis
   /en/relics-tonight, vers /en/data/items.json — 404. Le fetch est dans un
   try/catch qui rend une liste vide : l'autocomplétion anglaise ne proposait
   plus rien, sans message, sans erreur, sans que rien ne rougisse.

   Un scan de pages ne suffit PAS à couvrir cette famille : il ne voit que les
   fetch déclenchés au chargement. Les deux autres appels du même fichier
   (market.json, market_history.json) partent sur d'autres vues et étaient
   cassés à l'identique, invisibles. D'où ce contrôle statique, qui les voit
   tous les trois d'un coup.

   Même exclusion que pour les href : seules les chaînes littérales sont
   jugées. Une URL construite (`${WS}/pc/news`) n'est pas une adresse statique. */
const RE_FETCH = /(?:getJSON|fetch)\(\s*"([^"$`]+)"/g;
const fetchFautifs = [];
let fetchVus = 0;
for (const f of fs.readdirSync(path.join(ROOT, "js")).filter((x) => x.endsWith(".js"))) {
  const code = fs.readFileSync(path.join(ROOT, "js", f), "utf8");
  for (const m of code.matchAll(RE_FETCH)) {
    const u = m[1];
    if (/^(?:https?:)?\/\//.test(u) || u.startsWith("data:") || u.startsWith("blob:")) continue;
    fetchVus++;
    if (!u.startsWith("/")) { fetchFautifs.push(`js/${f} → "${u}" (relatif : 404 dès qu'une page vit dans un sous-dossier)`); continue; }
    /* /api/* n'est pas un fichier : c'est une fonction Cloudflare Pages, servie
       depuis functions/api/<nom>.js. On la vérifie là où elle vit réellement,
       plutôt que de l'inscrire sur une liste d'exceptions qui rouillerait. */
    const cible = u.startsWith("/api/") ? path.join(DEPOT, "functions", u.slice(1) + ".js") : path.join(ROOT, u.slice(1));
    if (!fs.existsSync(cible)) fetchFautifs.push(`js/${f} → ${u} (absent : ${path.relative(ROOT, cible)})`);
  }
}
dit(fetchFautifs.length === 0, "les données chargées par le JS ont une adresse absolue, et le fichier existe",
    fetchFautifs.length ? fetchFautifs.slice(0, 8).join(" · ") : `${fetchVus} chemins de données`);

/* Les REDIRECTIONS sont des adresses, elles aussi. Vérifié en production le
   05/09/2026 : les 24 règles de _redirects fonctionnent et leurs 7 destinations
   répondent 200. Rien à corriger — mais rien ne les gardait non plus, et le
   mode de panne est net : quelqu'un renomme une page, la règle qui y menait
   continue de rediriger, vers une 404. Le visiteur venu d'un ancien lien
   indexé par Google atterrit dans le vide, et personne ne le voit jamais —
   une redirection ne casse aucune page et ne rougit aucun test.

   Seule la DESTINATION est jugée : la source est par définition une URL qui
   n'existe plus (c'est tout l'intérêt de la règle), et les jokers d'une
   destination (rares) ne désignent pas un fichier. */
const REDIRECTIONS = path.join(ROOT, "_redirects");
if (fs.existsSync(REDIRECTIONS)) {
  const cassees = [];
  let regles = 0;
  for (const ligne of fs.readFileSync(REDIRECTIONS, "utf8").split("\n")) {
    const l = ligne.trim();
    if (!l || l.startsWith("#")) continue;
    const [, dest] = l.split(/\s+/);
    if (!dest || !dest.startsWith("/") || dest.includes(":") || dest.includes("*")) continue;
    regles++;
    const nu = dest.replace(/^\//, "").replace(/\/$/, "");
    const candidats = nu
      ? [nu, nu + ".html", nu + "/index.html"]
      : ["index.html"];
    if (!candidats.some((c) => fs.existsSync(path.join(ROOT, c)))) cassees.push(`${l}  →  ${dest} n'existe pas`);
  }
  dit(cassees.length === 0, "chaque redirection de _redirects mène à une page qui existe",
      cassees.length ? cassees.slice(0, 8).join(" · ") : `${regles} destinations`);
}

console.log("-".repeat(70));
if (ko) { console.log(`❌ ${ko} échec(s) sur ${ok + ko}`); process.exit(1); }
console.log(`🛡️  GARDE-FOU : aucun lien mort — ${vus} liens, ${srcVus} fichiers, ${hlPages} paires hreflang sur ${liste.length} pages.`);
