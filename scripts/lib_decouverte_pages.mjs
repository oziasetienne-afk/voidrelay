/* ============================================================================
   VoidRelay — découverte de pages PARTAGÉE par tous les garde-fous de rendu
   (contraste, débordement, cibles tactiles, CLS).

   Extrait le 10/07/2026 : verifier_contraste.mjs et verifier_overflow.mjs
   dupliquaient chacun un STYLE_CSS_SAMPLE codé en dur (6 chemins /o/*.html
   exacts, choisis à la main par "type d'objet" — mod, set, relique...).
   Ça ne verrait JAMAIS une nouvelle arborescence (ex. /en/o/, 3800+ pages
   prévues) sans édition manuelle du tableau à chaque fois.

   Remplacé par une détection générique + un échantillonnage justifié :

   1) discoverPagesLinking(needle) : inchangé, marche déjà pour pandaahh.css
      et hub.css (une poignée de pages, grep plein texte suffit).

   2) discoverObjectTrees() : détecte GÉNÉRIQUEMENT toute arborescence de
      pages objet (n'importe quel dossier avec des .html à plat + un
      sous-dossier c/ + une référence à style.css) — sans coder "o" ou "en"
      en dur. Le jour où /en/o/ existe, il est détecté automatiquement.

   3) sampleObjectTree(tree) : échantillonnage par TAILLE DE FICHIER, pas par
      type d'objet. Vérifié le 10/07/2026 (diff des class="…"/id="…" entre
      une page Riven et une page mod normale : AUCUNE différence structurelle,
      seul le texte change). Le type d'objet n'a donc AUCUN impact sur le
      risque contraste/débordement/cible tactile — c'est la LONGUEUR du texte
      (nom, description) qui fait varier le rendu et peut casser une mise en
      page. La taille de fichier sur disque est un proxy bon marché (pas de
      lecture de contenu, juste fs.statSync) : on prend le plus petit, le plus
      grand et le médian. Cette logique ne connaît RIEN du catalogue (pas de
      tags, pas de slugs) → elle s'applique à n'importe quelle arborescence
      détectée, dans n'importe quelle langue, sans code spécifique par arbre.
      + toujours : index.html de l'arbre (gabarit catalogue, structurellement
      distinct) et une page de scripts/o/c/ (gabarit catégorie, idem).

   Coût : classer 3800+ fichiers par taille est un fs.statSync (millisecondes,
   pas un chargement de page) — seul l'échantillon retenu (5-6 pages/arbre)
   est ensuite chargé dans le navigateur, donc le coût du garde-fou ne grandit
   PAS avec la taille du catalogue, seulement avec le nombre d'ARBRES.
   ========================================================================== */
import fs from 'fs';
import path from 'path';

export function discoverPagesLinking(root, needle) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '_design_audit' || entry.name === '_site') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes(needle)) out.push('/' + path.relative(root, full).split(path.sep).join('/'));
    }
  }
  walk(root);
  return out.sort();
}

// Détecte toute arborescence "pages objet" : dossier avec >= 5 .html à plat
// référençant style.css sur un fichier témoin. Profondeur bornée (3) pour ne
// pas dériver dans tout le repo.
//
// 10/07/2026, testé "grandeur nature" sur feat/session-7-en-objets (250 pages
// /en/o/, phase 1) : le sous-dossier c/ (catégories) était à tort une
// condition DURE — cette arborescence n'a pas encore de pages catégorie
// (pas construites en phase 1) et n'était donc PAS détectée, alors que le
// vrai risque contraste/débordement/cible tactile qu'on veut couvrir existe
// dès la 1re page. Un dossier sans style.css référencé sur >= 5 pages en dur
// est très improbable ailleurs dans le repo (vérifié : seuls o/, en/o/,
// widget/ et une page isolée warframe.html référencent style.css — aucun
// risque de faux positif en retirant cette condition). c/ reste vérifié et
// exploité dans sampleObjectTree() SI présent, juste plus comme condition
// bloquante de détection.
export function discoverObjectTrees(root, needle = 'style.css') {
  const trees = [];
  function scan(dir, depth) {
    if (depth > 3) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    const htmlFiles = entries.filter(e => e.isFile() && e.name.endsWith('.html'));
    if (htmlFiles.length >= 5) {
      const witness = htmlFiles.find(e => e.name !== 'index.html') || htmlFiles[0];
      const content = fs.readFileSync(path.join(dir, witness.name), 'utf8');
      if (content.includes(needle)) {
        trees.push({ dir, htmlFiles: htmlFiles.map(e => e.name) });
      }
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === 'c') continue;
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '_design_audit' || e.name === '_site') continue;
      scan(path.join(dir, e.name), depth + 1);
    }
  }
  scan(root, 0);
  return trees;
}

export function sampleObjectTree(root, tree) {
  const relDir = path.relative(root, tree.dir).split(path.sep).join('/');
  const items = tree.htmlFiles.filter(n => n !== 'index.html');
  const bySize = items
    .map(name => ({ name, size: fs.statSync(path.join(tree.dir, name)).size }))
    .sort((a, b) => a.size - b.size);

  const picks = new Set();
  if (bySize.length) {
    picks.add(bySize[0].name);                          // texte le plus court
    picks.add(bySize[bySize.length - 1].name);           // texte le plus long (risque débordement)
    picks.add(bySize[Math.floor(bySize.length / 2)].name); // médian (cas courant)
  }
  const pages = [...picks].map(n => `/${relDir}/${n}`);

  if (tree.htmlFiles.includes('index.html')) pages.push(`/${relDir}/index.html`);

  const catDir = path.join(tree.dir, 'c');
  if (fs.existsSync(catDir)) {
    const catFiles = fs.readdirSync(catDir).filter(f => f.endsWith('.html')).sort();
    if (catFiles.length) pages.push(`/${relDir}/c/${catFiles[0]}`);
  }
  return [...new Set(pages)];
}

// Échantillon complet toutes arborescences détectées confondues.
export function sampleAllObjectTrees(root) {
  const trees = discoverObjectTrees(root);
  return trees.flatMap(t => sampleObjectTree(root, t));
}

/* Pages liées à une feuille de style, avec les GROS arbres générés réduits à
   leur échantillon (03/09/2026).

   Motif : le groupe css/pandaahh.css chargeait ses 1586 pages, dont 750 dans
   builds/ et 750 dans en/builds/ — deux arbres produits par un seul gabarit.
   Le garde-fou « rendu » dépassait 38 minutes et se faisait couper par son
   propre timeout-minutes: 20 ; il n'avait pas rendu de verdict depuis le
   17/07/2026. On chargeait 1500 fois la même mise en page pour vérifier les
   mêmes couleurs.

   Le seuil compte. discoverObjectTrees() se déclenche dès 5 fichiers, ce qui
   convient à son usage d'origine (/o/, 3800 pages) mais attrape ici la RACINE
   du site et en/ — qui ne sont pas des arbres générés mais des collections de
   pages écrites à la main, chacune avec son propre CSS. Les échantillonner
   ferait perdre de la vraie couverture. D'où MIN_ECHANTILLON : on ne réduit
   qu'au-delà de 100 pages, taille qu'aucune collection manuelle n'atteint et
   que seuls les gabarits produisent. Tout le reste est scanné intégralement. */
const MIN_ECHANTILLON = 100;

export function samplePagesLinking(root, needle, minParArbre = MIN_ECHANTILLON) {
  const toutes = discoverPagesLinking(root, needle);
  const arbres = discoverObjectTrees(root, needle)
    .filter(t => t.htmlFiles.length >= minParArbre)
    .filter(t => path.resolve(t.dir) !== path.resolve(root)); // jamais la racine

  if (!arbres.length) return toutes;
  const garde = new Set(arbres.flatMap(t => sampleObjectTree(root, t)));
  const prefixes = arbres.map(t => '/' + path.relative(root, t.dir).split(path.sep).join('/') + '/');
  return toutes.filter(p => !prefixes.some(d => p.startsWith(d)) || garde.has(p));
}
