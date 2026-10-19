#!/usr/bin/env node
/* Générateur de l'outil Arcanes (/arcanes/ + data/arcanes.json + images).
   Source : projet communautaire WFCD warframe-items (données du jeu + i18n FR).
   À relancer À LA MAIN après une mise à jour du jeu qui ajoute des arcanes
   (node scripts/generer_arcanes.mjs) — pas de cron : les arcanes bougent peu.
   Les notes Pandaahh (ARCANE_NOTES) sont durables : clé = nom anglais. */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const SRC_ARCANES = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Arcanes.json";
const SRC_I18N = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/i18n.json";
const CDN_IMG = "https://cdn.warframestat.us/img/";
const IMG_DIR = "assets/arcanes";
const OUT = "data/arcanes.json";

/* Notes tirées des vidéos Pandaahh déjà intégrées au site (clé = nom EN). */
const V = {
  toxo: "https://www.youtube.com/watch?v=FZimD1ef_8o",
  sos: "https://www.youtube.com/watch?v=L62i1HUAa7I",
  melee: "https://www.youtube.com/watch?v=lhBOA_XlgzY",
  mirage: "https://www.youtube.com/watch?v=8_Mb0aU1Ofo",
  arcanes43: "https://www.youtube.com/watch?v=TBW8PY3HHkA",
  harrow: "https://www.youtube.com/watch?v=3QZ6zbEmJR8",
  hildryn: "https://www.youtube.com/watch?v=QxR2fnI13g8",
  nidus: "https://www.youtube.com/watch?v=uwh7ZEDqrXI",
  archi: "https://www.youtube.com/watch?v=gOtusE3AWLk",
  styanax: "https://www.youtube.com/watch?v=_sxFT6MzngI",
};
const ARCANE_NOTES = {
  "Arcane Aegis": `Une seule proc et le bouclier se régénère <b>sans délai</b>, même sous le feu — le défensif du <a href="/builds/gauss">Gauss débutant</a> de Pandaahh (<a href="${V.sos}" target="_blank" rel="noopener">SOS Bambi</a>).`,
  "Arcane Battery": `Remplace Flux <b>si</b> tu as beaucoup d'armure (0,3 énergie max par point) — « Batterie ET Flux ensemble : aucun intérêt » (<a href="${V.sos}" target="_blank" rel="noopener">SOS Bambi</a>).`,
  "Arcane Avenger": `Le crit « par vagues » des builds tanky : proc sur dégâts reçus, adore l'<a href="/builds/acceltra">Acceltra</a> et le <a href="/builds/harrow">Harrow</a> crit rouge (<a href="${V.harrow}" target="_blank" rel="noopener">live Amprex</a>).`,
  "Arcane Expertise": `Convertit la puissance de pouvoir en bouclier — le liant du <a href="/builds/hildryn">level cap Hildryn</a> de Pandaahh (<a href="${V.hildryn}" target="_blank" rel="noopener">live 9999</a>).`,
  "Arcane Hot Shot": `Le « Tonnerre de Feu » des builds Pandaahh : +6 % de chance de crit d'arme par statut Feu posé via des pouvoirs (50 cumuls = +300 %) — <a href="/builds/dual-toxocyst">Dual Toxocyst</a> avec un Molosse qui proc le Feu, ou Sirius dont le 1 enflamme tout. Il la rachète chaque semaine aux récompenses d'Archimédée Temporelle (<a href="${V.archi}" target="_blank" rel="noopener">live hebdo</a>).`,
  "Primary Frostbite": `La reine du <a href="/builds/cedo">Cedo</a> : son tir secondaire pose du Froid, l'arcane rend multishot + dégâts crit (40 cumuls). Farm : survie Circulus (Lua) rot. C, ou Yonta contre du Plasma Thrax (<a href="${V.sos}" target="_blank" rel="noopener">SOS Bambi</a>).`,
  "Secondary Fortifier": `Le bonus anti-Surgarde des primers : gardée sur l'<a href="/builds/epitaph">Epitaph</a> et recommandée (Furis, <a href="/builds/dual-toxocyst">Dual Toxocyst</a>) contre les Thrax (<a href="${V.melee}" target="_blank" rel="noopener">vidéo mêlée</a>).`,
  "Primary Dexterity": `Sur l'arme à feu d'un build mêlée : +7,5 s de durée de combo — « l'entretien du combo sans y penser » (<a href="${V.melee}" target="_blank" rel="noopener">vidéo mêlée</a>).`,
  "Secondary Dexterity": `Sur l'arme à feu d'un build mêlée : +7,5 s de durée de combo — « l'entretien du combo sans y penser » (<a href="${V.melee}" target="_blank" rel="noopener">vidéo mêlée</a>).`,
  "Melee Exposure": `Le choix level cap de Pandaahh : +60 % de Corrosif par pouvoir lancé (cumulable ×4) — relance tes pouvoirs et frappe (<a href="${V.melee}" target="_blank" rel="noopener">vidéo mêlée</a>).`,
  "Melee Influence": `Seulement si une frame pose l'Électrique pour toi (<a href="/builds/gyre">Gyre</a>) pendant que ta mêlée reste Toxine — full électrique au level cap, « c'est prendre un risque » (<a href="${V.melee}" target="_blank" rel="noopener">vidéo mêlée</a>).`,
  "Secondary Outburst": `Monte le combo en mêlée (<a href="/builds/ceramic-dagger">Dague en Céramique</a> Incarnon), dégaine ta secondaire : ~+200 % de chance ET de dégâts critiques à ×9 (<a href="${V.mirage}" target="_blank" rel="noopener">live Mirage</a>).`,
  "Eternal Eradicate": `+60 % de dégâts d'amplificateur après un pouvoir d'Opérateur — « la meilleure arcane que tu puisses avoir » pour ~20 pl, ou chez Cavalero au Zariman (<a href="${V.sos}" target="_blank" rel="noopener">SOS Bambi</a>).`,
  "Arcane Sculptor": `Efficacité fixée à 175 % après création d'un objet par pouvoir — déclencheurs confirmés en live : cage de Khora, tourelles de Protea, pylônes de Qorvex (<a href="${V.arcanes43}" target="_blank" rel="noopener">découverte maj 43</a>).`,
  "Primary Compression": `L'effet ne joue <b>qu'en mode visé</b> (tir de hanche intact) : transforme une explosive en tueuse de boss mono-cible (<a href="${V.arcanes43}" target="_blank" rel="noopener">découverte maj 43</a>).`,
  "Secondary Cryogenic": `Statut Perforation → 3 charges de Froid dans 15 m sans ligne de vue ; le Froid augmente les dégâts crit subis — « un Furis peut grave faire le taf » (<a href="${V.arcanes43}" target="_blank" rel="noopener">découverte maj 43</a>).`,
  "Arcane Arachne": `Sur accroche à un mur : +150 % de dégâts d'arme pendant 30 s (non cumulable, à relancer). Le combo « pistolet-araignée » d'un level cap testé par Pandaahh — un simple wall-latch avant d'engager suffit (<a href="${V.styanax}" target="_blank" rel="noopener">vidéo Styanax</a>).`,
  "Arcane Persistence": `Le cœur du <a href="/builds/nidus">Nidus post-retouche</a> de Pandaahh : plus de boucliers, et au-delà de 700 d'armure (Fibre Umbra) les dégâts subis sont capés à 500/s (<a href="${V.nidus}" target="_blank" rel="noopener">vidéo Nidus</a>).`,
  "Arcane Bellicose": `+6 % de puissance par 250 PV max (plafond +72 %) : trivial à plafonner avec le lien de Nidus + Parasitic Vitality, ~26 000 PV (<a href="${V.nidus}" target="_blank" rel="noopener">vidéo Nidus</a>).`,
  "Shotgun Vendetta": `Kill au fusil à pompe à moins de 5 m : +180 % de tir multiple et +75 % de recharge — gomme le défaut de recharge du <a href="/builds/coda-bassocyst">Coda Bassocyst</a> (<a href="${V.nidus}" target="_blank" rel="noopener">vidéo Nidus</a>).`,
  "Melee Assimilation": `Le défensif qui manquait aux builds <a href="/builds/equinox">slam d'Equinox</a> : +150 % d'attaque lourde sur bouclier endommagé, 30 % de bouclier max par kill (<a href="${V.arcanes43}" target="_blank" rel="noopener">découverte maj 43</a>).`,
};

const GROUPES = {
  "Warframe Arcane": "Warframe", "Arcane": "Warframe",
  "Primary Arcane": "Principale", "Bow Arcane": "Principale", "Shotgun Arcane": "Principale",
  "Secondary Arcane": "Secondaire",
  "Melee Arcane": "Mêlée",
  "Operator Arcane": "Opérateur", "Amp Arcane": "Amp",
  "Zaw Arcane": "Zaw", "Kitgun Arcane": "Kitgun",
};
const TYPES_FR = {
  "Warframe Arcane": "Arcane de Warframe", "Arcane": "Arcane de Warframe",
  "Primary Arcane": "Arcane d'arme principale", "Bow Arcane": "Arcane d'arc", "Shotgun Arcane": "Arcane de fusil à pompe",
  "Secondary Arcane": "Arcane d'arme secondaire", "Melee Arcane": "Arcane de mêlée",
  "Operator Arcane": "Arcane d'Opérateur", "Amp Arcane": "Arcane d'Amp",
  "Zaw Arcane": "Arcane de Zaw", "Kitgun Arcane": "Arcane de Kitgun",
};
const RARETES = { Common: "Commune", Uncommon: "Peu commune", Rare: "Rare", Legendary: "Légendaire" };

const nettoie = (s) => String(s || "").replace(/\r/g, "").replace(/<[^>]+>/g, "").trim();
const wmSlug = (name) => name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

async function main() {
  console.log("Téléchargement des données WFCD…");
  const [arcanes, i18n] = await Promise.all([
    fetch(SRC_ARCANES).then((r) => r.json()),
    fetch(SRC_I18N).then((r) => r.json()),
  ]);
  mkdirSync(IMG_DIR, { recursive: true });

  const out = [];
  let dl = 0;
  for (const a of arcanes) {
    if (a.excludeFromCodex) continue;
    const fr = i18n[a.uniqueName]?.fr || {};
    const stats = (fr.levelStats?.length ? fr.levelStats : a.levelStats) || [];
    let dernier;
    if (stats.length) {
      const brut = stats[stats.length - 1].stats.map((s) => String(s).trim());
      // retire les lignes déjà contenues dans une autre (ex. « +1 Réanimation » dupliqué)
      const uniques = brut.filter((s, i) => !brut.some((o, j) => j !== i && o.includes(s) && (o.length > s.length || j < i)));
      dernier = uniques.join(" · ");
    } else {
      dernier = nettoie(fr.description || a.description);
    }
    // Lieux d'obtention : les 3 meilleurs taux, lieux distincts
    const lieux = [];
    for (const d of (a.drops || []).slice().sort((x, y) => (y.chance || 0) - (x.chance || 0))) {
      const loc = String(d.location || "").replace(/\s*\(.*?\)\s*$/, "");
      if (loc && !lieux.includes(loc)) lieux.push(loc);
      if (lieux.length >= 3) break;
    }
    const rec = {
      n: a.name,
      f: nettoie(fr.name || a.name),
      g: GROUPES[a.type] || "Autre",
      t: TYPES_FR[a.type] || a.type || "Arcane",
      r: RARETES[a.rarity] || a.rarity || "—",
      mx: Math.max(0, stats.length - 1),
      e: nettoie(dernier).replace(/:\s*(?:\\n|\n)+\s*/g, " : ").replace(/\\n|\n+/g, " — "),
      d: lieux.join(" · "),
      i: a.imageName || "",
      w: a.tradable ? wmSlug(a.name) : null,
    };
    if (ARCANE_NOTES[a.name]) rec.p = ARCANE_NOTES[a.name];
    out.push(rec);

    if (a.imageName) {
      const dest = `${IMG_DIR}/${a.imageName}`;
      if (!existsSync(dest)) {
        try {
          const buf = await fetch(CDN_IMG + a.imageName, { redirect: "follow" }).then((r) => {
            if (!r.ok) throw new Error(r.status);
            return r.arrayBuffer();
          });
          writeFileSync(dest, Buffer.from(buf));
          dl++;
        } catch (e) {
          console.warn(`image manquante: ${a.imageName} (${e.message})`);
        }
      }
    }
  }
  out.sort((x, y) => x.f.localeCompare(y.f, "fr"));
  writeFileSync(OUT, JSON.stringify(out, null, 0));
  const notes = out.filter((x) => x.p).length;
  console.log(`✅ ${out.length} arcanes → ${OUT} (${notes} notes Pandaahh, ${dl} images téléchargées)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
