/* VoidRelay — Simulateur d'Arsenal (16/07/2026)
   Reproduit le système d'équipement du jeu : Warframe + primaire + secondaire +
   mêlée + compagnon + arme de compagnon (+ armes exaltées de la frame), avec le
   VRAI système de mods : capacité 30/60 (réacteur), aura qui AJOUTE de la
   capacité, polarités (concordante = drain ÷2 arrondi sup ; discordante = +25%
   arrondi), exilus, forma (clic sur la polarité d'un emplacement), arcanes.
   Données : data/arsenal/*.json cuites par scripts/generer_arsenal_data.mjs
   (base communautaire WFCD warframe-items = données extraites du jeu).
   Règles vérifiées sur le wiki officiel (16/07/2026) — voir meta.json.
   Honnêteté : un mod dont l'effet n'est pas machine-lisible est équipable
   (drain/polarité vrais) mais marqué « effet non simulé » ; postures de mêlée
   non simulées (équipables, drain vrai).
   v46 (03/09/2026) : deux corrections de lecture des mods.
     • Les mods de crit mêlée « +220% Critical Chance (x2 for Heavy Attacks) »
       (Acier Véritable / Véritable Prime / Sacrificiel / Galvanisé Prime)
       n'étaient PAS lus — la chance critique restait à sa valeur de base sur
       tous les builds mêlée. Corrigé côté cuisson (generer_arsenal_data.mjs).
     • Les 43 mods de FACTION (Fléau / Châtie- / Expulse- / Purifie-) sont
       désormais chiffrés : clef f_<faction>, additive entre mods d'une même
       faction, appliquée uniquement contre la faction visée.
   v47 (03/09/2026) : la simulation d'ennemi (préréglage, armure, santé,
     niveau, croissance officielle, temps pour tuer) est REMPLACÉE par le
     tableau « Efficacité par faction » — les six factions d'un coup, avec
     pour chacune vulnérabilité × mods de faction = multiplicateur total et
     les dégâts par coup correspondants. Les deux colonnes se MULTIPLIENT :
     le jeu range la vulnérabilité de type et les mods de faction dans deux
     boîtes séparées (corrosif ×1,5 puis Fléau ×1,55 = ×2,33). */
(function () {
  "use strict";
  var root = document.getElementById("arsenal");
  if (!root) return;
  // Bilingue (17/07/2026) : /en/arsenal partage CE moteur — <html lang> décide.
  // T(fr, en) pour l'interface ; les mods s'affichent via leur nom EN (champ en,
  // cuit depuis la source brute) ; frames/armes portent le même nom dans les
  // deux langues (noms propres). Descriptions d'objets : base FR (noté sur la page EN).
  var EST_EN = document.documentElement.lang === "en";
  function T(fr, en) { return EST_EN ? en : fr; }
  function nomMod(m) { return (EST_EN && m.en) ? m.en : m.n; }

  /* ------------------------------ Données ------------------------------ */
  var D = { frames: null, armes: null, comp: null, mods: null, arcanes: null, meta: null, postures: null };
  var cache = {};
  function charge(f) {
    if (cache[f]) return cache[f];
    cache[f] = fetch("/data/arsenal/" + f + ".json").then(function (r) {
      if (!r.ok) throw new Error(f);
      return r.json();
    });
    return cache[f];
  }
  function chargeTout() {
    return Promise.all([charge("warframes"), charge("armes"), charge("compagnons"),
                        charge("mods"), charge("arcanes"), charge("meta"), charge("arcanes_armes"),
                        charge("postures")])
      .then(function (all) {
        D.frames = all[0]; D.armes = all[1]; D.comp = all[2];
        D.mods = all[3]; D.arcanes = all[4]; D.meta = all[5]; D.arcArmes = all[6];
        D.postures = all[7];
      });
  }

  /* ------------------------------- État -------------------------------- */
  // Un « équipé » = { un: uniqueName, mods: {aura, exilus, slots:[8]}, formas:{i:pol}, arcanes:[2] }
  var SLOTS = [
    { id: "frame", nom: "Warframe", cat: "frame" },
    { id: "primaire", nom: T("Principale", "Primary"), cat: "Primary" },
    { id: "secondaire", nom: T("Secondaire", "Secondary"), cat: "Secondary" },
    { id: "melee", nom: T("Mêlée", "Melee"), cat: "Melee" },
    { id: "compagnon", nom: T("Compagnon", "Companion"), cat: "comp" },
    { id: "armecomp", nom: T("Arme compagnon", "Companion weapon"), cat: "Robotic" },
  ];
  var etat = { reacteur: true, sel: "frame", equip: {} };
  var KEY = "vr-arsenal-v1";

  function sauve() {
    try { localStorage.setItem(KEY, JSON.stringify(etat)); } catch (e) {}
    // v34 : lien COMPRESSÉ #z= (lz-string, ~3x plus court) ; repli #b= (base64)
    // si la lib n'est pas chargée. Les anciens liens #b= restent lus à vie.
    try {
      var json = JSON.stringify(etat);
      var hash = window.LZString
        ? "#z=" + LZString.compressToEncodedURIComponent(json)
        : "#b=" + btoa(unescape(encodeURIComponent(json)));
      history.replaceState(null, "", hash);
    } catch (e) {}
  }
  /* ---- v59 — FICHE DU BUILD (titre, auteur, notes) -----------------------
     Elle voyage dans le lien avec le reste de l'état : un build partagé arrive
     nommé et expliqué, sans compte ni serveur.

     ATTENTION, ces trois champs viennent d'une URL que N'IMPORTE QUI peut
     fabriquer. restaure() avale le hash sans validation — c'est déjà ce qui
     avait laissé passer deux Adaptation le 03/09/2026. Deux protections, et
     les deux sont nécessaires :
       • ici, on borne la longueur et on retire les caractères de contrôle ;
       • à l'affichage, TOUT passe par esc() — jamais de HTML brut.
     Sans la seconde, un titre contenant une balise serait exécuté dans la
     page de la personne qui ouvre le lien. */
  var FICHE_MAX = { t: 80, a: 40, d: 600 };
  function assainisFiche(f) {
    if (!f || typeof f !== "object") return null;
    var out = {}, vide = true;
    Object.keys(FICHE_MAX).forEach(function (k) {
      var v = f[k];
      if (typeof v !== "string") return;
      // eslint-disable-next-line no-control-regex
      v = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, FICHE_MAX[k]).trim();
      if (v) { out[k] = v; vide = false; }
    });
    return vide ? null : out;
  }
  function restaure() {
    restaureBrut();
    if (!etat || typeof etat !== "object") etat = { reacteur: true, sel: "frame", equip: {} };
    etat.equip = etat.equip || {};
    /* Assaini APRÈS restaureBrut(), et surtout PAS à l'intérieur : cette
       fonction sort par un `return` dès qu'un lien est reconnu. Placée là-bas,
       la protection aurait sauté sur le seul chemin qui en a besoin — celui
       d'un lien fabriqué par un tiers. Défaut introduit puis corrigé le
       03/09/2026, repéré en essayant vraiment un lien malveillant. */
    etat.fiche = assainisFiche(etat.fiche);
  }
  function restaureBrut() {
    try {
      var z = /#z=([A-Za-z0-9+\-$]+)/.exec(location.hash);
      if (z && window.LZString) { etat = JSON.parse(LZString.decompressFromEncodedURIComponent(z[1])); return; }
      var h = /#b=(.+)/.exec(location.hash);
      if (h) { etat = JSON.parse(decodeURIComponent(escape(atob(h[1])))); return; }
    } catch (e) {}
    try {
      var s = localStorage.getItem(KEY);
      if (s) etat = JSON.parse(s);
    } catch (e) {}
  }

  /* ------------------------------ Recherche d'objets ------------------------------ */
  function trouveItem(slotId) {
    // L'exaltée n'est PAS choisie : elle découle de la Warframe équipée (avant le
    // test equip[slotId], qui n'existe jamais pour elle).
    var exm = /^exalte(\d+)$/.exec(slotId);
    if (exm) { var fr = trouveItem("frame"); return (fr && fr.exalted && fr.exalted[Number(exm[1])]) || null; }
    var eq = etat.equip[slotId];
    if (!eq || !eq.un) return null;
    if (slotId === "frame") return D.frames.find(function (w) { return w.un === eq.un; }) || null;
    if (slotId === "compagnon") return D.comp.compagnons.find(function (c) { return c.un === eq.un; }) || null;
    if (slotId === "armecomp") return D.comp.armes.find(function (c) { return c.un === eq.un; }) || null;
    var s = SLOTS.find(function (x) { return x.id === slotId; });
    var liste = D.armes[s.cat] || [];
    var it = liste.find(function (w) { return w.un === eq.un; });
    if (it) return it;
    // arme exaltée sélectionnée comme primaire/mêlée ? non — les exaltées vivent avec la frame
    return null;
  }
  function modParUn(un) { return D.mods.find(function (m) { return m.un === un; }); }
  // Référence de mod équipé : {un, rk} — rk null = rang max. Les états sauvés avant
  // les rangs réglables (17/07/2026) stockaient la chaîne un seule : normalisée ici.
  function refDe(x) { return !x ? null : (typeof x === "string" ? { un: x, rk: null } : x); }
  function rangMax(m) { return m.fl || 0; }
  function rangDe(ref, m) { var r = ref && ref.rk; return (r == null || !m.lvs) ? rangMax(m) : Math.max(0, Math.min(r, rangMax(m))); }
  function fxAt(m, rk) {
    if (!m.lvs || rk >= rangMax(m)) return m.fx;
    return m.lvs[rk] || m.fx;
  }
  var FX_FR = EST_EN
    ? { dmg: "Damage", ms: "Multishot", cc: "Critical chance", cm: "Critical damage",
      sc: "Status chance", fr: "Fire rate", mag: "Magazine", rel: "Reload",
      e_heat: "Heat", e_cold: "Cold", e_electricity: "Electricity", e_toxin: "Toxin",
      ec_blast: "Blast", ec_radiation: "Radiation", ec_gas: "Gas", ec_magnetic: "Magnetic",
      ec_viral: "Viral", ec_corrosive: "Corrosive", p_impact: "Impact", p_puncture: "Puncture",
      p_slash: "Slash", str: "Strength", dur: "Duration", eff: "Efficiency", rng: "Range",
      hp: "Health", sh: "Shield", ar: "Armor", en: "Max energy", spr: "Sprint",
      // v82 : mods de lien — la valeur se prend sur la WARFRAME, pas sur le
      // compagnon. Le libellé doit le dire, sinon « +125 % Santé » se lirait
      // comme +125 % des PV du compagnon.
      lnkhp: "Health (of Warframe's)", lnksh: "Shield (of Warframe's)", lnkar: "Armor (of Warframe's)",
      f_grineer: "vs Grineer", f_corpus: "vs Corpus", f_infeste: "vs Infested",
      f_corrompu: "vs Corrupted", f_murmure: "vs Murmur",
      a_melee: "Melee damage (squad)", a_rifle: "Rifle damage (squad)",
      a_shotgun: "Shotgun damage (squad)", a_pistol: "Pistol damage (squad)",
      a_sniper: "Sniper damage (squad)",
      pt: "Punch through", ammo: "Max ammo", rge: "Range",
      cdurp: "Combo duration (% of base)", accc: "Additional combo count chance", fin: "Finisher damage",
      acc: "Accuracy", amut: "Ammo mutation (of pickup)", ar_rifle: "Primary ammo per pickup (squad)",
      ar_shotgun: "Shotgun ammo per pickup (squad)", ar_sniper: "Sniper ammo per pickup (squad)", ar_pistol: "Pistol ammo per pickup (squad)",
      br: "Crit / combo tier", ww: "Status / combo tier", co: "Damage / status type",
      cdur: "Combo duration", icombo: "Initial combo",
      mrng: "Melee range", wup: "Wind-up", hvy: "Heavy attack damage", heff: "Heavy attack efficiency",
      adapt: "Adaptation (resistance cap)", og: "Max overguard",
      aurstr: "Aura strength (your aura)", aureff: "Aura effectiveness (auras on you)",
      r_tox: "Toxin resistance", r_heat: "Heat resistance", r_cold: "Cold resistance",
      r_elec: "Electricity resistance", r_rad: "Radiation resistance", r_phys: "Physical resistance",
      sdur: "Status duration",
      /* v64 — ces deux clefs n'avaient PAS de libellé : la carte du mod
         affichait « +30 % hm », le nom interne. Un mod dont on ne peut pas
         lire l'effet est aussi opaque qu'un mod non simulé. */
      hm: "Slash proc on critical", hrec: "Warframe healed (companion damage)", hem: "Slash proc on Impact status",
      rage: "Health damage converted to Energy", equi_en: "Energy from Health orbs",
      equi_hp: "Health from Energy orbs", gstr: "Ability Strength on status (Growing Power)",
      gdur: "Growing Power duration",
      c_cc: "Critical chance while aiming", c_cm: "Critical damage while aiming",
      c_sc: "Status chance while aiming", c_fr: "Fire rate while aiming",
      c_cc_s: "Critical chance per stack", cstk: "Max stacks", cvdur: "Window duration" }
    : { dmg: "Dégâts", ms: "Multishot", cc: "Chance critique", cm: "Dégâts critiques",
      sc: "Chance de statut", fr: "Cadence", mag: "Chargeur", rel: "Rechargement",
      e_heat: "Chaleur", e_cold: "Froid", e_electricity: "Électricité", e_toxin: "Toxine",
      ec_blast: "Explosion", ec_radiation: "Radiation", ec_gas: "Gaz", ec_magnetic: "Magnétique",
      ec_viral: "Viral", ec_corrosive: "Corrosif", p_impact: "Impact", p_puncture: "Perforation",
      p_slash: "Tranchant", str: "Puissance", dur: "Durée", eff: "Efficacité", rng: "Portée",
      hp: "Santé", sh: "Bouclier", ar: "Armure", en: "Énergie max", spr: "Sprint",
      // v82 : voir le commentaire côté anglais — la valeur vient de la frame.
      lnkhp: "Santé (de la Warframe)", lnksh: "Bouclier (de la Warframe)", lnkar: "Armure (de la Warframe)",
      f_grineer: "vs Grineer", f_corpus: "vs Corpus", f_infeste: "vs Infestés",
      f_corrompu: "vs Corrompus", f_murmure: "vs Murmure",
      a_melee: "Dégâts mêlée (escouade)", a_rifle: "Dégâts fusil (escouade)",
      a_shotgun: "Dégâts fusil à pompe (escouade)", a_pistol: "Dégâts pistolet (escouade)",
      a_sniper: "Dégâts sniper (escouade)",
      pt: "Pénétration", ammo: "Munitions max", rge: "Portée",
      cdurp: "Durée du combo (% de la base)", accc: "Chance de combo supplémentaire", fin: "Dégâts de finisher",
      acc: "Précision", amut: "Mutation de munitions (du ramassage)", ar_rifle: "Munitions principales par ramassage (escouade)",
      ar_shotgun: "Munitions de fusil à pompe par ramassage (escouade)", ar_sniper: "Munitions de sniper par ramassage (escouade)", ar_pistol: "Munitions de pistolet par ramassage (escouade)",
      br: "Crit / palier de combo", ww: "Statut / palier de combo", co: "Dégâts / type de statut",
      cdur: "Durée du combo", icombo: "Combo initial",
      mrng: "Allonge", wup: "Temps de charge", hvy: "Dégâts d'attaque lourde", heff: "Efficacité d'attaque lourde",
      adapt: "Adaptation (plafond de résistance)", og: "Surgarde max",
      aurstr: "Puissance d'aura (ton aura)", aureff: "Efficacité d'aura (les auras sur toi)",
      r_tox: "Résistance toxique", r_heat: "Résistance à la chaleur", r_cold: "Résistance au froid",
      r_elec: "Résistance électrique", r_rad: "Résistance aux radiations", r_phys: "Résistance physique",
      sdur: "Durée de statut",
      hm: "Tranchant sur critique", hrec: "Soin de la Warframe (dégâts du compagnon)", hem: "Tranchant sur statut d'Impact",
      rage: "Dégâts sur la santé convertis en énergie", equi_en: "Énergie rendue par les orbes de santé",
      equi_hp: "Santé rendue par les orbes d'énergie", gstr: "Puissance sur statut (Pouvoir Grandissant)",
      gdur: "Durée de Pouvoir Grandissant",
      c_cc: "Chance critique en visée", c_cm: "Dégâts critiques en visée",
      c_sc: "Chance de statut en visée", c_fr: "Cadence en visée",
      c_cc_s: "Chance critique par palier", cstk: "Paliers maximum", cvdur: "Durée de la fenêtre" };
  function texteFx(fx) {
    return Object.keys(fx).map(function (k) {
      var v = Math.round(fx[k] * 1000) / 10;
      return (v >= 0 ? "+" : "") + v + " % " + (FX_FR[k] || k); // négatif : son signe suffit (rivens)
    }).join(" · ");
  }

  /* ------------------------------- Maths ------------------------------- */
  function drainMod(m, rk) { return (m.d0 || 0) + (rk == null ? (m.fl || 0) : rk); }
  /* Une polarité « universal » (le créneau exilus de quelques armes) accepte
     N'IMPORTE quelle polarité : elle concorde toujours. Sans ce cas, elle
     serait traitée comme un nom de polarité inconnu, donc DISCORDANTE — et
     coûterait 25 % de plus au lieu de deux fois moins. */
  function polConcorde(polSlot, polMod) {
    return polSlot === "universal" || polSlot === polMod;
  }
  function drainDansSlot(m, polSlot, rk) {
    var d = drainMod(m, rk);
    if (!polSlot || polSlot === "none") return d;
    if (polConcorde(polSlot, m.pol)) return Math.ceil(d / 2);
    return d + Math.round(d * 0.25); // arrondi mathématique (wiki)
  }
  function bonusAura(m, polSlot, rk) {
    var d = drainMod(m, rk);
    if (!polSlot || polSlot === "none") return d;
    if (polConcorde(polSlot, m.pol)) return d * 2;
    return d - Math.round(d * 0.25);
  }
  function rang30(w) {
    var r = w.r30 || {};
    return {
      hp: r.hp != null ? r.hp : (w.hp > 0 ? w.hp + 100 : w.hp),
      sh: r.sh != null ? r.sh : (w.sh > 0 ? w.sh + 100 : w.sh),
      ar: w.ar, en: r.en != null ? r.en : Math.round(w.en * 1.5), spr: w.spr,
    };
  }
  /* v42 : mods GALVANISÉS aux stacks « On Kill » MAX (opt-in etat.galvmax,
     valeurs wiki vérifiées 17/07/2026). Seuls les bonus BORNÉS sont chiffrés ;
     les bonus « par statut sur la cible » (Aptitude/Savvy/Shot) restent non
     additionnés — jamais de chiffre inventé. Table remplie par nom EN. */
  var GALV_MAX = {
    "Galvanized Chamber": { ms: 1.5 },
    "Galvanized Hell": { ms: 1.2 },
    "Galvanized Diffusion": { ms: 1.2 },
  };
  /* v51 : autres mods à cumuls « On Kill » bornés, indexés par uniqueName.
     v100 : la « Furie du Berserker Prime » (2 × 64,2 %) était un mod fantôme des
     fichiers du jeu — aucune page wiki, écartée du cuiseur ; son entrée est retirée. */
  var STACK_MAX = {
    "/Lotus/Upgrades/Mods/Melee/WeaponCritFireRateBonusMod": { fr: 0.7 },
  };
  function fxGalvMax(m) {
    if (!etat.galvmax || !m) return null;
    return (m.un && STACK_MAX[m.un]) || (m.en && GALV_MAX[m.en]) || null;
  }
  function aStacksMax(m) { return !!(m && ((m.un && STACK_MAX[m.un]) || (m.en && GALV_MAX[m.en]))); }
  /* ---- COMPTEUR DE COMBO (v51, 03/09/2026) ---------------------------------
     Wiki officiel : ×2 à 20 coups consécutifs, +1 tous les 20 coups, plafond
     ×12 à 220 coups (×13 réservé à la Venka Prime). Le multiplicateur NE
     multiplie PAS les attaques normales — il sert aux attaques lourdes et aux
     mods qui s'y adossent. On l'expose donc comme un RÉGLAGE assumé (comme
     « stacks max »), jamais supposé : par défaut ×1, aucun bonus. */
  var COMBO_PALIERS = 20; // coups par palier
  function comboActuel() { return Math.max(1, Math.min(12, etat.combo || 1)); }
  // ×2 à 20 coups, ×3 à 40, … ×12 à 220 : le palier n demande (n − 1) × 20
  // coups (table du wiki), PAS n × 20.
  function coupsPourCombo(mult) { return mult <= 1 ? 0 : (mult - 1) * COMBO_PALIERS; }
  function nbStatuts() { return Math.max(0, Math.min(10, etat.statuts || 0)); }
  /* v43 : DIAGNOSTIC DE BUILD (linter) — repère les manques classiques d'une
     arme d'après le guide « Bien modder » (règles bornées, aucun chiffre
     inventé). Renvoie une liste {t:"ok|warn", m:"message"}. */
  // Noms EN des mods équipés d'un équipement (toutes cases + aura/posture).
  function modsEnDe(eq) {
    var out = [];
    (eq.mods.slots || []).concat([eq.mods.exilus, eq.mods.aura, eq.mods.aura2, eq.mods.st]).forEach(function (x) {
      var r = refDe(x), m = r && modParUn(r.un);
      if (m && m.en) out.push(m.en.toLowerCase());
    });
    return out;
  }
  function aUnParmi(noms, liste) {
    return liste.some(function (n) { return noms.indexOf(n.toLowerCase()) >= 0; });
  }
  function diagnostiqueArme(eq, it, s1) {
    var f = sommeFx(eq), out = [], noms = modsEnDe(eq);
    var aBase = (f.dmg || 0) > 0;
    var aMs = (f.ms || 0) > 0;
    var aCm = (f.cm || 0) > 0;
    var aElem = Object.keys(f).some(function (k) { return k.indexOf("e_") === 0 && f[k] > 0; });
    var melee = it.cat === "Melee";
    if (!aBase) out.push({ t: "warn", m: T("Aucun mod de dégâts de base (Dentelure, Point de Pression…) — la fondation du build.", "No base damage mod (Serration, Pressure Point…) — the build's foundation.") });
    if (!aMs && !melee) out.push({ t: "warn", m: T("Pas de multitir (Chambre Divisée) — l'un des plus gros gains de DPS.", "No multishot (Split Chamber) — one of the biggest DPS gains.") });
    if (s1.cc >= 25 && !aCm) out.push({ t: "warn", m: T("Crit élevé mais pas de dégâts de crit : la paire crit est incomplète.", "High crit chance but no crit damage: the crit pair is incomplete.") });
    if (!aElem) out.push({ t: "warn", m: T("Aucun élément posé — ajoute un combiné adapté à la faction visée.", "No element equipped — add a combined element suited to the target faction.") });
    // v45 : règles MÊLÉE dédiées (Coup de Sang, Blessure Suintante, portée)
    if (melee) {
      var aBloodRush = aUnParmi(["Blood Rush"], noms);
      if (s1.cc >= 20 && !aBloodRush) out.push({ t: "warn", m: T("Mêlée à crit : Coup de Sang fait grimper le critique avec le combo.", "Crit melee: Blood Rush scales crit with the combo counter.") });
      if (s1.sc >= 20 && !aUnParmi(["Weeping Wounds", "Condition Overload"], noms)) out.push({ t: "warn", m: T("Mêlée à statut : Blessure Suintante (statut ↑ combo) ou Débordement d'Effets (dégâts par statut).", "Status melee: Weeping Wounds (status ↑ combo) or Condition Overload (damage per status type).") });
      if (!aUnParmi(["Reach", "Primed Reach"], noms)) out.push({ t: "warn", m: T("Sans Atteinte, ton allonge de mêlée reste courte.", "Without Reach, your melee range stays short.") });
      // v48 : une posture est du gain PUR — elle AJOUTE de la capacité au lieu
      // d'en coûter, et sans elle il n'y a aucun enchaînement.
      if (!refDe(eq.mods.st)) out.push({ t: "warn", m: T("Aucune posture : elle AJOUTE de la capacité (elle n'en coûte pas) et débloque les enchaînements.", "No stance: it ADDS capacity (it does not cost any) and unlocks the combos.") });
    }
    if (!out.length) out.push({ t: "ok", m: T("Base solide : dégâts, multitir/portée, crit et éléments couverts.", "Solid base: damage, multishot/range, crit and elements are covered.") });
    return out;
  }
  /* v45 : DIAGNOSTIC WARFRAME — survie, énergie, pouvoirs (règles bornées,
     détection par nom de mod ; aucun chiffre inventé). */
  function diagnostiqueFrame(eq, it) {
    var noms = modsEnDe(eq), out = [];
    var survie = aUnParmi(["Vitality", "Umbral Vitality", "Redirection", "Vigor", "Primed Vigor", "Steel Fiber", "Adaptation"], noms);
    var antiKD = aUnParmi(["Rolling Guard", "Handspring", "Sure Footed", "Primed Sure Footed"], noms);
    var energie = aUnParmi(["Flow", "Primed Flow", "Streamline", "Fleeting Expertise", "Rage", "Hunter Adrenaline"], noms);
    var pouvoir = aUnParmi(["Intensify", "Umbral Intensify", "Blind Rage", "Transient Fortitude", "Stretch", "Streamline", "Fleeting Expertise", "Augur Reach", "Overextended", "Constitution", "Narrow Minded", "Continuity", "Primed Continuity"], noms);
    if (!survie) out.push({ t: "warn", m: T("Aucun mod de survie (Vitalité, Redirection, Chair d'Acier, Adaptation) — fragile en Steel Path.", "No survivability mod (Vitality, Redirection, Steel Fiber, Adaptation) — fragile on Steel Path.") });
    if (!antiKD) out.push({ t: "warn", m: T("Pense à Roulade Parade : ~3 s d'invincibilité qui retire les statuts (base du shield-gating).", "Consider Rolling Guard: ~3s invulnerability that clears status (the basis of shield-gating).") });
    if (!energie) out.push({ t: "warn", m: T("Économie d'énergie faible (Flux, Rationalisation, Rage) — tes pouvoirs vont s'essouffler.", "Weak energy economy (Flow, Streamline, Rage) — your abilities will run dry.") });
    if (!pouvoir) out.push({ t: "warn", m: T("Aucun mod de pouvoir (Puissance, Portée, Durée, Efficacité) — la frame joue à nu.", "No ability mod (Strength, Range, Duration, Efficiency) — the frame plays bare.") });
    if (!out.length) out.push({ t: "ok", m: T("Frame équilibrée : survie, énergie et pouvoirs couverts.", "Balanced frame: survivability, energy and abilities covered.") });
    return out;
  }
  function blocDiag(titre, liste) {
    return '<details class="ars-det ars-diag"><summary>' + titre + "</summary><ul>" +
      liste.map(function (d) { return '<li class="ars-diag-' + d.t + '">' + (d.t === "ok" ? "✓ " : "⚠ ") + esc(d.m) + "</li>"; }).join("") +
      '</ul><p class="muted" style="margin:.3em 0 0">' + T('Repères tirés du guide ', "Tips from the guide ") + '<a href="' + (EST_EN ? "/en/guides/modding-guide" : "/guides/bien-modder") + '">' + T("Bien modder ses armes", "weapon modding") + "</a>.</p></details>";
  }
  /* Clefs qui sont des PLAFONDS et non des bonus : elles ne s'additionnent
     pas, on retient la plus haute. Adaptation en est une — « stacks up to
     90% ». Le jeu interdit d'en équiper deux (même famille de mod), mais un
     build restauré depuis un lien partagé n'est pas validé : sans cette
     règle, 0,9 + 0,9 = 1,8 et la résistance dépassait le réel. */
  var FX_MAX = { adapt: 1 };
  /* v57 — RÉSISTANCES : elles ne s'additionnent pas. Wiki (Flame Repellent) :
     « Damage resistance bonus is MULTIPLICATIVE with other sources of damage
       resistance such as Adaptation. »
     Deux sources de 15 % et 45 % donnent donc 1 − 0,85 × 0,55 = 53,25 %, et
     non 60 %. Troisième sémantique de cumul du moteur, après la somme (le cas
     courant) et le maximum (les PLAFONDS, table FX_MAX). */
  var FX_RES = { r_tox: 1, r_heat: 1, r_cold: 1, r_elec: 1, r_rad: 1, r_phys: 1 };
  function cumule(t, k, v) {
    if (FX_MAX[k]) t[k] = Math.max(t[k] || 0, v);
    else if (FX_RES[k]) t[k] = 1 - (1 - (t[k] || 0)) * (1 - v);
    else t[k] = (t[k] || 0) + v;
  }
  /* ---- COACTION DRIFT : le multiplicateur d'auras (v55, 03/09/2026) -------
     Le mod porte DEUX moitiés qui ne disent pas la même chose (wiki) :
     « Aura Strength » augmente l'effet de TON aura sur tout le monde,
     « Aura Effectiveness » augmente l'effet des auras des AUTRES sur toi.
     Pour le porteur — le seul que ce simulateur modélise — elles se
     MULTIPLIENT : (1 + 15 %)² = ×1,3225. L'addition donnerait ×1,30, faux.
     Le mod n'est PAS une aura : il vit dans l'emplacement exilus, d'où la
     passe préalable sur tous les autres emplacements. */
  function multAura(eq) {
    if (!eq || !eq.mods) return 1;
    var str = 0, eff = 0;
    (eq.mods.slots || []).concat([eq.mods.exilus]).forEach(function (x) {
      var ref = refDe(x);
      if (!ref) return;
      var m = modParUn(ref.un);
      if (!m || !m.fx) return;
      var fx = fxAt(m, rangDe(ref, m)) || {};
      str += fx.aurstr || 0;
      eff += fx.aureff || 0;
    });
    return (1 + str) * (1 + eff);
  }
  function sommeFx(eq) {
    var t = {};
    if (!eq) return t;
    var mAura = multAura(eq);
    var auraSlots = [eq.mods && eq.mods.aura, eq.mods && eq.mods.aura2];
    var tous = (eq.mods && eq.mods.slots || []).concat([eq.mods && eq.mods.exilus]).concat(auraSlots);
    tous.forEach(function (x, i) {
      var ref = refDe(x);
      if (!ref) return;
      var m = modParUn(ref.un);
      if (!m || !m.fx) return;
      var fx = fxAt(m, rangDe(ref, m)) || {};
      // Les deux derniers emplacements sont les auras : seules elles sont
      // mises à l'échelle par Coaction Drift.
      if (mAura !== 1 && i >= tous.length - auraSlots.length) {
        var ech = {};
        Object.keys(fx).forEach(function (k) { ech[k] = fx[k] * mAura; });
        fx = ech;
      }
      Object.keys(fx).forEach(function (k) { cumule(t, k, fx[k]); });
      var gm = fxGalvMax(m);
      if (gm) Object.keys(gm).forEach(function (k) { cumule(t, k, gm[k]); });
    });
    return t;
  }
  function statsFrame(w, eq) {
    var b = rang30(w), f = sommeFx(eq), fg = sommeFrags(eq);
    /* Efficacité bornée à [25 %, 175 %] (wiki Ability_Efficiency : « abilities cannot
       consume more than 175% or less than 25% of their base costs »). Le plancher
       n'avait jamais servi : aucun malus n'était lu avant v95 (Blind Rage −55 %). */
    var eff = Math.max(0.25, Math.min(1.75, 1 + (f.eff || 0)));
    return {
      base: b,
      hp: Math.round(b.hp * (1 + (f.hp || 0)) + fg.hpFlat),
      sh: Math.round(b.sh * (1 + (f.sh || 0)) + fg.shFlat),
      ar: Math.round(b.ar * (1 + (f.ar || 0)) + fg.arFlat),
      en: Math.round(b.en * (1 + (f.en || 0)) + fg.enFlat),
      spr: Math.round(b.spr * (1 + (f.spr || 0)) * 100) / 100,
      str: Math.round((1 + (f.str || 0)) * 100 + fg.strPct),
      dur: Math.round((1 + (f.dur || 0)) * 100 + fg.durPct),
      rng: Math.round((1 + (f.rng || 0)) * 100),
      eff: Math.round(eff * 100),
      effCap: 1 + (f.eff || 0) > 1.75,
      dr: Math.round((b.ar * (1 + (f.ar || 0)) + fg.arFlat) / (b.ar * (1 + (f.ar || 0)) + fg.arFlat + 300) * 1000) / 10,
      /* v53 : plafond de résistance d'Adaptation (0,9 = 90 %). 0 si le mod
         n'est pas équipé — rien n'est supposé.
         Borné sous 1 : restaure() avale un build depuis le hash d'URL ou le
         localStorage SANS validation, donc un lien bricolé peut poser les deux
         Adaptation du jeu (0,9 + 0,9 = 1,8) et rendre 1 − adapt négatif — donc
         des PV effectifs négatifs. En jeu la valeur ne dépasse jamais 0,9. */
      adapt: Math.max(0, Math.min(0.99, f.adapt || 0)),
      /* v65 — ÉCONOMIE D'ÉNERGIE et POUVOIR GRANDISSANT.
         `rage` : part des dégâts REÇUS SUR LA SANTÉ rendue en énergie (Rage,
           Rage Prime, Adrénaline du Chasseur). Ce n'est pas une stat de
           survie : c'est un taux de change, et le seul chiffre honnête qu'on
           puisse en tirer sans supposer les dégâts entrants est ce que rend
           une barre de santé entière.
         `gstr` : bonus de puissance de Pouvoir Grandissant. Volontairement
           SÉPARÉ de `str` — l'ajouter là reviendrait à le donner en
           permanence alors qu'il faut d'abord infliger un statut. Même parti
           pris qu'Adaptation en v53 : réglage explicite, décoché par défaut. */
      rage: Math.max(0, f.rage || 0),
      equiEn: Math.max(0, f.equi_en || 0),
      equiHp: Math.max(0, f.equi_hp || 0),
      gstr: Math.max(0, f.gstr || 0),
      gdur: Math.max(0, f.gdur || 0),
      // v57 — résistances par type, déjà composées multiplicativement par
      // sommeFx (table FX_RES). Bornées sous 1 : aucune ne rend invulnérable.
      res: Object.keys(FX_RES).reduce(function (o, k) {
        // Pas de bornage sous 1 ici : Répulsion des Flammes Prime donne
        // vraiment 100 %, et le jeu appelle ça une immunité. L'affichage le
        // dit avec un mot plutôt qu'avec un très grand nombre.
        if (f[k]) o[k] = Math.max(0, Math.min(1, f[k]));
        return o;
      }, {}),
    };
  }
  var PRIMAIRES = ["heat", "cold", "electricity", "toxin"];
  var COMBOS = {
    "cold+heat": "blast", "electricity+heat": "radiation", "heat+toxin": "gas",
    "cold+electricity": "magnetic", "cold+toxin": "viral", "electricity+toxin": "corrosive",
  };
  function combine(a, b) { return COMBOS[[a, b].sort().join("+")] || null; }
  // Arcane d'ARME équipée (eq.arcanes[0]) résolue dans D.arcArmes — null sinon.
  function arcArmeDe(eq) {
    if (!eq || !eq.arcanes || !eq.arcanes[0] || !D.arcArmes) return null;
    return D.arcArmes.find(function (x) { return x.un === eq.arcanes[0]; }) || null;
  }
  /* ---- AURAS qui touchent les ARMES (v49, 03/09/2026) ---------------------
     Charge d'Acier (+60 % dégâts de mêlée), Ampli Fusil (+27 %), Ampli Fusil à
     Pompe (+18 %), Ampli Pistolet (+27 %), Œil de Lynx (+52,5 % sniper) : les
     36 auras du jeu ne valaient RIEN dans le moteur (leur texte est rédigé
     côté escouade, aucun motif ne le lisait). L'aura est posée sur la FRAME,
     mais son bonus s'applique à l'ARME de la bonne catégorie — additif avec
     les mods de dégâts de base, comme dans le jeu (Charge d'Acier + Point de
     Pression = +180 %, pas ×2,2).
     Les auras de statistiques de Warframe (Physique, Unis, Élan) n'ont besoin
     de rien ici : elles vivent déjà sur la frame et sommeFx les additionne. */
  function clesAuraPour(w) {
    if (!w) return [];
    if (w.cat === "Melee") return ["a_melee"];
    if (w.cat === "Secondary") return ["a_pistol"];
    if (w.cat === "Primary") {
      if (w.type === "Shotgun") return ["a_shotgun"];
      // les snipers utilisent AUSSI les mods « Fusil » : les deux auras comptent
      if (w.type === "Sniper") return ["a_rifle", "a_sniper"];
      return ["a_rifle"];
    }
    if (w.cat === "Exalted") {
      if (!w.mag) return ["a_melee"];                       // lame exaltée
      return /Pistol/i.test(w.un || "") ? ["a_pistol"] : ["a_rifle"];
    }
    return [];
  }
  function auraArmeDe(w, eq) {
    if (!eq) return 0; // colonne « base » : l'aura est un apport de build
    if (!etat.equip || !etat.equip.frame || !etat.equip.frame.un) return 0;
    var cles = clesAuraPour(w);
    if (!cles.length) return 0;
    var frEq = eqDe("frame"), total = 0;
    [frEq.mods.aura, frEq.mods.aura2].forEach(function (x) {
      var ref = refDe(x);
      if (!ref) return;
      var m = modParUn(ref.un);
      if (!m || !m.fx) return;
      var fx = fxAt(m, rangDe(ref, m)) || {};
      cles.forEach(function (k) { total += fx[k] || 0; });
    });
    return total * multAura(frEq); // Coaction Drift agit aussi sur l'aura d'arme
  }
  /* PONT D'AURA (v49 dégâts, v55 combo initial, v56 charge / durée de combo /
     compagnon). Une aura est posée sur la FRAME mais plusieurs de ses clefs
     vivent ailleurs — sur l'arme ou sur le compagnon. Sans ce pont, le
     parseur lit le mod et celui-ci reste malgré tout sans effet : l'échec le
     plus silencieux qui soit. Assez de cas maintenant pour une seule
     fonction, déjà mise à l'échelle par Coaction Drift. */
  /* Stats MODDÉES de la Warframe équipée, pour les mods de LIEN du compagnon.
     Renvoie null s'il n'y a pas de frame : un compagnon seul ne reçoit rien. */
  function lienStatsFrame() {
    var w = trouveItem("frame");
    return w ? statsFrame(w, eqDe("frame")) : null;
  }
  function auraFrameCle(cle) {
    if (!etat.equip || !etat.equip.frame || !etat.equip.frame.un) return 0;
    var frEq = eqDe("frame"), total = 0;
    [frEq.mods.aura, frEq.mods.aura2].forEach(function (x) {
      var ref = refDe(x);
      if (!ref) return;
      var m = modParUn(ref.un);
      if (!m || !m.fx) return;
      var fx = fxAt(m, rangDe(ref, m)) || {};
      total += fx[cle] || 0;
    });
    return total * multAura(frEq);
  }
  // Le combo et la charge lourde ne concernent que la mêlée (lames exaltées
  // comprises : elles n'ont pas de chargeur).
  function estMeleeOuExaltee(w) {
    return !!w && (w.cat === "Melee" || (w.cat === "Exalted" && !w.mag));
  }
  function auraComboDe(w, eq) {
    if (!eq || !estMeleeOuExaltee(w)) return 0;
    return Math.round(auraFrameCle("icombo"));
  }
  // v56 — Élan Rapide (AURA « Swift Momentum ») : vitesse de charge et durée de
  // combo. Attention : une mêlée porte DÉJÀ ce nom français (« Quickening »).
  // Les deux mods sont distincts, d'où la sélection par uniqueName partout.
  function auraWupDe(w, eq) {
    if (!eq || !estMeleeOuExaltee(w)) return 0;
    return auraFrameCle("wup");
  }
  function auraCdurDe(w, eq) {
    if (!eq || !estMeleeOuExaltee(w)) return 0;
    return auraFrameCle("cdur");
  }
  // Auras de la frame qui touchent CETTE arme, pour l'affichage honnête.
  function aurasArmeNoms(w) {
    if (!etat.equip || !etat.equip.frame || !etat.equip.frame.un) return [];
    var cles = clesAuraPour(w), out = [];
    var frEq = eqDe("frame"), mA = multAura(frEq);
    [frEq.mods.aura, frEq.mods.aura2].forEach(function (x) {
      var ref = refDe(x);
      if (!ref) return;
      var m = modParUn(ref.un);
      if (!m || !m.fx) return;
      var fx = fxAt(m, rangDe(ref, m)) || {}, v = 0;
      cles.forEach(function (k) { v += fx[k] || 0; });
      // La note doit annoncer ce que le moteur applique VRAIMENT : Coaction
      // Drift met l'aura à l'échelle, donc la valeur affichée l'est aussi.
      if (v) out.push({ n: nomMod(m), v: Math.round(v * mA * 1000) / 10 });
    });
    return out;
  }
  // Nom du mod qui met les auras à l'échelle, pour l'afficher avec elles.
  function coactionNom(eq) {
    var trouve = "";
    if (!eq || !eq.mods) return trouve;
    (eq.mods.slots || []).concat([eq.mods.exilus]).forEach(function (x) {
      var ref = refDe(x);
      if (!ref) return;
      var m = modParUn(ref.un);
      if (!m || !m.fx) return;
      var fx = fxAt(m, rangDe(ref, m)) || {};
      if (fx.aurstr || fx.aureff) trouve = nomMod(m);
    });
    return trouve;
  }
  /* v94 — PRÉCISION. Wiki (Accuracy, relevé le 26/09/2026) :
       Précision = 100 / [ (min + max) / 2 × (1 + % de dispersion) + dispersion plate ]
     • « +40 % Accuracy » RETIRE 40 % de dispersion (Tainted Shell) ; « −60 % »
       en ajoute 60 % (Vicious Spread) : % de dispersion = − bonus de précision.
     • Heavy Caliber et Magnum Force ajoutent une dispersion PLATE (degrés) « despite
       being labeled as a percentage in-game » : leur valeur par rang (m.spp) et le
       supplément propre à certaines armes (w.spx, au rang max, proportionnel au rang)
       sont lus dans leurs pages. Leur « −55 % » n'est donc PAS appliqué en plus.
     • Sans dispersion définie, ou nulle, la moyenne vaut 1 pour les mods (wiki) —
       d'où la précision 100 des Dera, Ogris… */
  function precisionArme(w, eq) {
    if (!w || w.cat === "Melee") return null;
    var hasSp = w.smin != null && w.smax != null;
    if (!hasSp && !w.acc) return null;
    var moy = hasSp ? (w.smin + w.smax) / 2 : 0;
    if (!(moy > 0)) moy = 1;
    var pct = 0, plat = 0;
    (eq && eq.mods && eq.mods.slots || []).concat([eq && eq.mods && eq.mods.exilus]).forEach(function (x) {
      var ref = refDe(x);
      if (!ref) return;
      var m = modParUn(ref.un);
      if (!m) return;
      var rg = rangDe(ref, m), fl = m.fl || 0;
      var fx = (m.fx && fxAt(m, rg)) || {};
      if (m.spk && w.spx && w.spx[m.spk]) plat += w.spx[m.spk] * (rg + 1) / (fl + 1);
      if (m.spp) { plat += m.spp[Math.min(rg, m.spp.length - 1)] || 0; return; }
      if (fx.acc) pct -= fx.acc;
    });
    var moyM = Math.max(0.01, moy * (1 + pct) + plat);
    return { base: Math.round(100 / moy * 10) / 10, moddee: Math.round(100 / moyM * 10) / 10,
             disp: Math.round(moyM * 100) / 100 };
  }
  /* v94 — MUNITIONS PAR RAMASSAGE (AmmoPickup du wiki). Les récupérateurs
     (auras) les augmentent : Rifle Scavenger vaut pour TOUTES les principales
     (wiki : « Applies to all primary weapons »), Shotgun / Sniper Scavenger pour
     leur classe, Pistol Scavenger pour les secondaires. */
  function recupAuraPour(w) {
    if (!w || !w.pick) return 0;
    if (w.cat === "Secondary") return auraFrameCle("ar_pistol");
    if (w.cat !== "Primary") return 0;
    return auraFrameCle("ar_rifle") + (w.type === "Shotgun" ? auraFrameCle("ar_shotgun") : 0) +
      (w.type === "Sniper" ? auraFrameCle("ar_sniper") : 0);
  }
  function statsArme(w, eq) {
    var f = sommeFx(eq);
    /* v66 — LES CONDITIONNELS « EN VISÉE ». Treize mods (Viseur à Argon,
       Réticule Hydraulique, les Galvanisés, Lien Catalyseur…) donnent du
       critique, du statut ou de la cadence à condition de VISER et d'avoir
       rempli un déclencheur (tir à la tête, kill, lancer de pouvoir…).

       Ils sont repliés dans les clefs normales SEULEMENT quand le joueur coche
       la case : tout le panneau en dépend (DPS, saignement, procs), et
       recalculer l'ensemble est la seule façon de montrer ce que la condition
       achète vraiment. Décoché par défaut — même règle qu'Adaptation (v53),
       le compteur de combo (v51) et Pouvoir Grandissant (v65) : le simulateur
       ne suppose jamais une condition à la place du joueur.

       Le critique compose ses paliers : Viseur Galvanisé donne +120 % puis
       +40 % par palier jusqu'à 5, soit +320 %. */
    var condCC = (f.c_cc || 0) + (f.c_cc_s || 0) * (f.cstk || 0);
    var cond = { cc: condCC, cm: f.c_cm || 0, sc: f.c_sc || 0, fr: f.c_fr || 0 };
    var condActif = etat.cvise && (cond.cc || cond.cm || cond.sc || cond.fr);
    if (condActif) {
      f = Object.keys(f).reduce(function (o, k) { o[k] = f[k]; return o; }, {});
      ["cc", "cm", "sc", "fr"].forEach(function (k) {
        if (cond[k]) f[k] = (f[k] || 0) + cond[k];
      });
    }
    var auraArme = auraArmeDe(w, eq);
    var baseTot = 0, k;
    // Arcane d'arme « aux stacks max » (opt-in, etat.arcmax) : bonus de dégâts
    // multiplicatif avec les mods, additif entre ses propres stacks (wiki) ;
    // vitesse de recharge additive avec les mods de recharge.
    var aw = arcArmeDe(eq);
    var awFx = (aw && aw.fx && etat.arcmax) ? aw.fx : null;
    for (k in w.dmg) baseTot += w.dmg[k];
    // Surcharge d'État : ADDITIF avec les mods de dégâts de base (wiki),
    // × le nombre de TYPES de statut présents sur la cible (réglage explicite).
    var mult = 1 + (f.dmg || 0) + auraArme + (f.co || 0) * nbStatuts();
    // 1) physiques (impact/perfo/tranchant) : ×dégâts ×bonus physique dédié
    var out = {};
    ["impact", "puncture", "slash"].forEach(function (p) {
      if (w.dmg[p]) out[p] = w.dmg[p] * mult * (1 + (f["p_" + p] || 0));
    });
    // 2) éléments des MODS, dans l'ordre des emplacements, puis éléments innés :
    //    les primaires se combinent par paires dans l'ordre (règle du jeu).
    var ordre = [];
    (eq && eq.mods && eq.mods.slots || []).concat([eq && eq.mods && eq.mods.exilus]).forEach(function (x) {
      var ref = refDe(x);
      if (!ref) return;
      var m = modParUn(ref.un);
      if (!m || !m.fx) return;
      var fx = fxAt(m, rangDe(ref, m)) || {};
      PRIMAIRES.forEach(function (el) {
        if (fx["e_" + el]) ordre.push({ el: el, val: baseTot * mult * fx["e_" + el] });
      });
    });
    PRIMAIRES.forEach(function (el) {
      if (w.dmg[el]) ordre.push({ el: el, val: w.dmg[el] * mult });
    });
    // fusion des doublons consécutifs du même élément
    var prim = [];
    ordre.forEach(function (e) {
      var ex = prim.find(function (p) { return p.el === e.el; });
      if (ex) ex.val += e.val; else prim.push({ el: e.el, val: e.val });
    });
    for (var i = 0; i < prim.length - 1; i++) {
      var c = combine(prim[i].el, prim[i + 1].el);
      if (c) {
        prim.splice(i, 2, { el: c, val: prim[i].val + prim[i + 1].val });
      }
    }
    prim.forEach(function (p) { out[p.el] = (out[p.el] || 0) + p.val; });
    // éléments composés innés (blast, radiation…) : inchangés, ×dégâts
    ["blast", "radiation", "gas", "magnetic", "viral", "corrosive", "void", "true"].forEach(function (el) {
      if (w.dmg[el]) out[el] = (out[el] || 0) + w.dmg[el] * mult;
    });
    var tot = 0;
    if (awFx && awFx.dmg) for (k in out) out[k] *= 1 + awFx.dmg;
    for (k in out) { out[k] = Math.round(out[k] * 10) / 10; tot += out[k]; }
    /* Coup de Sang / Blessures Suintantes : le bonus s'AJOUTE dans le même
       crochet que les mods, multiplié par (combo − 1). Formules du wiki :
         CC = CC base × [1 + mods CC + BR × (combo − 1)]
         SC = SC base × [1 + mods SC + WW × (combo − 1)]  */
    var combo = comboActuel();
    var cc = w.cc * (1 + (f.cc || 0) + (f.br || 0) * (combo - 1));
    var cm = w.cm * (1 + (f.cm || 0));
    var sc = w.sc * (1 + (f.sc || 0) + (f.ww || 0) * (combo - 1));
    var fr = w.fr * (1 + (f.fr || 0));
    var ms = (w.ms || 1) * (1 + (f.ms || 0));
    var mag = Math.round((w.mag || 0) * (1 + (f.mag || 0)));
    /* v50 : pénétration et portée de rayon sont des MÈTRES PLATS (le mod
       ajoute +2,2 m, il ne multiplie pas) ; les munitions max sont un % de la
       base. Bases lues dans les modules du wiki — absentes de WFCD. */
    var pt = Math.round(((w.pt || 0) + (f.pt || 0)) * 100) / 100;
    var ammo = w.ammo ? Math.round(w.ammo * (1 + (f.ammo || 0))) : 0;
    var rge = w.rge ? Math.round((w.rge + (f.rge || 0)) * 10) / 10 : 0;
    // Même piège que l'attaque lourde : un riven à −100 % de rechargement met
    // ce diviseur à zéro. Plancher à 0,01 → un temps de recharge énorme mais
    // fini, au lieu d'un Infinity qui contaminerait le DPS soutenu.
    var relDiv = Math.max(0.01, 1 + (f.rel || 0) + ((awFx && awFx.rel) || 0));
    var rel = w.rel ? w.rel / relDiv : 0;
    /* ---- v58 — MUNITIONS DU CHASSEUR : le saignement ----------------------
       Wiki (Damage/Slash_Damage et Hunter_Munitions, relevés le 03/09/2026) :

         tick = 0,35 × dégâts de base MODDÉS × (1 + faction)
                     × (1 + dégâts de statut) × multiplicateurs additionnels
         dégâts de base moddés = base × (1 + mods de dégâts) × (1 + faction)

       Trois points décident de tout, et deux sont contre-intuitifs :

       • « their damage only depends on the weapons modded base Damage and is
         therefore NOT affected by elemental and physical damage mods » — un
         Sérration compte, une Chaleur Brûlante ou un Buzz Kill NON. C'est
         pourquoi on repart de baseTot × mult, et surtout pas de `tot`, qui
         contient déjà les éléments.
       • « Additional Multipliers include modded critical multiplier on
         Critical Hit » — et le proc n'existe QUE sur un critique : le
         multiplicateur critique s'applique donc TOUJOURS.
       • Les ticks IGNORENT L'ARMURE. C'est tout l'intérêt du mod, et la
         raison pour laquelle ce DPS n'est pas fondu dans celui du dessus. */
    /* v63 — les mods de DURÉE DE STATUT allongent le saignement, donc son
       nombre de ticks. Wiki (Hunter_Munitions) : « Using Hunter Track in
       tandem with Hunter Munitions will increase the base 6-second duration to
       11.4 seconds, allowing for 11 ticks of damage rather than the normal 6. »
       D'où le plancher : 6 x 1,9 = 11,4 s donne 11 ticks, pas 12 — un tick
       part chaque seconde, les 0,4 s restantes n'en portent aucun. */
    var DUREE_SAIGN = 6 * (1 + (f.sdur || 0));
    var TICKS_SAIGN = Math.max(1, Math.floor(DUREE_SAIGN));
    var PART_TICK = 0.35;              // 35 % des dégâts de base moddés
    // Probabilité qu'un projectile fasse un critique. Au-delà de 100 % de
    // chance critique, chaque tir est critique — d'où le bornage à 1.
    var pCrit = Math.max(0, Math.min(1, cc));
    /* Multiplicateur critique MOYEN sachant qu'il y a eu critique. Sous 100 %
       de chance, seul le palier 1 existe. Au-delà, le jeu tire entre les
       paliers n et n+1 (n = partie entière), et le palier n vaut
       (cm − 1) × n + 1 — c'est ce qui donne les critiques « orange » et
       « rouges » que le wiki dit augmenter fortement le saignement. */
    var cmProc = cc <= 0 ? 1 : (cc < 1 ? cm : (function () {
      var n = Math.floor(cc), pr = cc - n;
      return (1 - pr) * ((cm - 1) * n + 1) + pr * ((cm - 1) * (n + 1) + 1);
    })());
    var baseMod = baseTot * mult * (1 + ((awFx && awFx.dmg) || 0));
    var tickSaign = PART_TICK * baseMod * cmProc;
    var parProc = tickSaign * TICKS_SAIGN;
    var avg = tot * (1 + cc * (cm - 1)) * ms;
    var burst = avg * fr;
    var sout = (mag && rel) ? (avg * mag) / (mag / fr + rel) : burst;
    // Cadence RÉELLE de tir, rechargements compris : c'est elle qui donne le
    // rythme des procs, comme elle donne celui du DPS soutenu.
    var tirsParSec = (mag && rel) ? mag / (mag / fr + rel) : fr;
    // Chaque projectile tire son critique séparément, donc le multishot
    // multiplie bien le nombre d'occasions de proc.
    var procsParSec = tirsParSec * ms * pCrit * (f.hm || 0);

    /* ---- v64 — HÉMORRAGIE / HÉMORRAGIE INTERNE --------------------------
       « Impact Status Effects have 35% chance to apply a Slash Status Effect
       (x2 when Fire Rate is below 2.5) ». Même saignement qu'en v58, mais la
       chaîne qui y mène n'a RIEN à voir, et trois différences décident du
       chiffre :

       1. LE DÉCLENCHEUR EST UN STATUT D'IMPACT, PAS UN CRITIQUE. Il faut donc
          qu'un statut parte (chance de statut), et qu'il tombe sur Impact.
          Le jeu tire le type de statut au prorata de la part de chaque type
          dans les dégâts du coup — éléments COMPRIS. D'où `out.impact / tot`,
          et non la part physique de base.
       2. CONSÉQUENCE CONTRE-INTUITIVE, ET L'INVERSE DE v58 : un mod
          élémentaire DILUE la part d'Impact, donc RÉDUIT ce saignement —
          alors qu'il laissait Munitions du Chasseur parfaitement indifférent.
          Deux vérifications gardent les deux sens ouverts.
       3. LE CRITIQUE N'EST PAS REQUIS. Le proc naît d'un coup ordinaire aussi.
          Le multiplicateur critique ne s'applique donc qu'à la PROPORTION de
          coups critiques : 1 + cc × (cm − 1) en moyenne, et non le cmProc de
          v58 (qui vaut « sachant qu'il y a eu critique »).

       La clause « x2 » se lit sur la cadence MODDÉE : un mod de cadence peut
       faire franchir le seuil de 2,5 dans un sens comme dans l'autre, et c'est
       la cadence réellement tirée qui compte. */
    var hemChance = (f.hem || 0) * (fr < 2.5 ? 2 : 1);
    var partImpact = tot > 0 ? ((out.impact || 0) / tot) : 0;
    // Chance qu'un projectile applique AU MOINS un statut. Au-delà de 100 %,
    // le statut est garanti : on borne, comme pour la chance critique.
    var pStatut = Math.max(0, Math.min(1, sc));
    // Multiplicateur critique MOYEN sur l'ensemble des coups — pas seulement
    // sur les critiques, puisque ce proc-ci n'en demande pas.
    var cmMoyen = 1 + Math.max(0, cc) * (cm - 1);
    var tickHem = PART_TICK * baseMod * cmMoyen;
    var procsHemParSec = tirsParSec * ms * pStatut * partImpact * hemChance;
    var dpsHem = procsHemParSec * tickHem * TICKS_SAIGN;

    var dpsSaign = procsParSec * parProc;
    return {
      dmg: out, tot: Math.round(tot * 10) / 10,
      cc: Math.round(cc * 1000) / 10, cm: Math.round(cm * 100) / 100,
      sc: Math.round(sc * 1000) / 10, fr: Math.round(fr * 100) / 100,
      ms: Math.round(ms * 100) / 100, mag: mag, rel: Math.round(rel * 100) / 100,
      burst: Math.round(burst), sout: Math.round(sout),
      hm: f.hm || 0,
      sdur: f.sdur || 0,
      saignTicks: TICKS_SAIGN,
      saignDuree: Math.round(DUREE_SAIGN * 10) / 10,
      saign: Math.round(dpsSaign),
      saignTick: Math.round(tickSaign * 10) / 10,
      saignProcs: Math.round(procsParSec * 100) / 100,
      cond: cond, condActif: !!condActif, cvdur: f.cvdur || 0,
      hem: f.hem || 0,
      hemX2: !!(f.hem && fr < 2.5),
      hemPart: Math.round(partImpact * 1000) / 10,
      hemDps: Math.round(dpsHem),
      hemTick: Math.round(tickHem * 10) / 10,
      hemProcs: Math.round(procsHemParSec * 100) / 100,
      pt: pt, ammo: ammo, rge: rge,
      prec: precisionArme(w, eq),
      // Ramassage moddé ; la mutation convertit une part du ramassage de l'AUTRE
      // munition, récupérateur compris (wiki Rifle Scavenger : « applies to […] ammo
      // converted to primary ammo »).
      pick: w.pick ? Math.round(w.pick * (1 + (eq ? recupAuraPour(w) : 0))) : 0,
      amut: f.amut || 0,
      /* v96 : durée de combo = base × (1 + %) + secondes, plancher 0,1 s (wiki Melee_Combo).
         Le % (Corrupt Charge, True Punishment : −50 %) porte sur la BASE de l'arme —
         « always subtracts exactly 2.5 seconds » sur une base de 5 s ; les secondes
         (Body Count, et l'aura Melee Guidance qui en RETIRE 6 à ta mêlée) s'ajoutent. */
      cdur: w.cdur ? Math.max(0.1, Math.round((w.cdur * (1 + (f.cdurp || 0)) + (f.cdur || 0) + auraCdurDe(w, eq)) * 10) / 10) : 0,
      // v96 : chance de combo supplémentaire (multiplie la montée du combo) et bonus de finisher.
      accc: f.accc || 0,
      fin: f.fin || 0,
      icombo: (f.icombo || 0) + auraComboDe(w, eq),
      /* v52 — ATTAQUE LOURDE. Wiki :
           dégâts lourds = dégâts normaux MODDÉS × multiplicateur fixe de la
           classe d'arme × multiplicateur de combo.
         Le multiplicateur de classe se déduit de l'arme (Nikana Prime : 990
         de lourde pour 198 de base = ×5) — inutile de recopier la table.
         Coup Mortel s'ajoute dans le MÊME seau que Point de Pression (wiki :
         « additive to mods such as Pressure Point »), mais pour la lourde
         seule : d'où le rapport multHvy / mult appliqué au total moddé. */
      mrng: w.mrng ? Math.round((w.mrng + (f.mrng || 0)) * 100) / 100 : 0,
      wup: w.wup ? Math.round(w.wup / (1 + (f.wup || 0) + auraWupDe(w, eq)) * 100) / 100 : 0,
      heff: Math.round((f.heff || 0) * 100),
      hvyMult: w.hvy && baseTot ? Math.round(w.hvy / baseTot * 100) / 100 : 0,
      /* mult peut tomber à 0, voire passer sous zéro : un riven accepte −200 %
         de dégâts, et mult = 1 + f.dmg + aura + … Sans ce garde, le rapport
         (mult + Coup Mortel) / mult donnait NaN ou Infinity dans la ligne
         d'attaque lourde. À mult ≤ 0, l'arme ne fait de toute façon plus aucun
         dégât (tot vaut 0) : 0 est la bonne réponse, pas un symbole. */
      hvy: (w.hvy && baseTot && mult > 0)
        ? Math.round(tot * ((mult + (f.hvy || 0)) / mult) * (w.hvy / baseTot) * combo)
        : 0,
    };
  }

  /* ---- Fragments d'Archon (17/07/2026) : 5 emplacements par frame, valeurs
     officielles (wiki) ; Tauforgé = ×1,5. Seuls les bonus CHIFFRABLES sont
     additionnés aux stats (plats post-mods : santé/bouclier/armure/énergie ;
     % additifs : puissance/durée) — le reste est équipable et affiché en texte. */
  var FRAGS = [
    { c: T("Azur", "Azure"), coul: "#3b82f6", buffs: [
      { t: T("+{v} Santé max", "+{v} max Health"), v: 150, fx: "hpFlat" },
      { t: T("+{v} Bouclier", "+{v} Shield"), v: 150, fx: "shFlat" },
      { t: T("+{v} Armure", "+{v} Armor"), v: 150, fx: "arFlat" },
      { t: T("+{v} Énergie max", "+{v} max Energy"), v: 50, fx: "enFlat" },
      { t: T("+{v} Santé/s régénérée", "+{v} Health regen/s"), v: 5, fx: null }] },
    { c: T("Cramoisi", "Crimson"), coul: "#ef4444", buffs: [
      { t: T("+{v} % Puissance", "+{v}% Ability Strength"), v: 10, fx: "strPct" },
      { t: T("+{v} % Durée", "+{v}% Ability Duration"), v: 10, fx: "durPct" },
      { t: T("+{v} % Dégâts critiques (mêlée)", "+{v}% Melee Critical Damage"), v: 25, fx: null },
      { t: T("+{v} % Chance de statut (principale)", "+{v}% Primary Status Chance"), v: 25, fx: null },
      { t: T("+{v} % Chance critique (secondaire)", "+{v}% Secondary Critical Chance"), v: 25, fx: null }] },
    { c: T("Ambre", "Amber"), coul: "#f59e0b", buffs: [
      { t: T("+{v} % Vitesse d'incantation", "+{v}% Casting Speed"), v: 25, fx: null },
      { t: T("+{v} % Énergie max au réapparition", "+{v}% max Energy on spawn"), v: 30, fx: null },
      { t: T("+{v} % Efficacité des orbes de santé", "+{v}% Health Orb effectiveness"), v: 100, fx: null },
      { t: T("+{v} % Efficacité des orbes d'énergie", "+{v}% Energy Orb effectiveness"), v: 50, fx: null },
      { t: T("+{v} % Vélocité de parkour", "+{v}% Parkour Velocity"), v: 15, fx: null }] },
    { c: T("Émeraude", "Emerald"), coul: "#10b981", buffs: [
      { t: T("+{v} % Dégâts du statut Toxine", "+{v}% Toxin status damage"), v: 30, fx: null },
      { t: T("+{v} % Dégâts de pouvoir sur ennemis corrodés", "+{v}% Ability damage on corroded enemies"), v: 10, fx: null },
      { t: T("+{v} piles de Corrosion max", "+{v} max Corrosion stacks"), v: 2, fx: null },
      { t: T("+{v} Santé par application de Toxine", "+{v} Health per Toxin proc"), v: 2, fx: null }] },
    { c: "Violet", coul: "#a855f7", buffs: [
      { t: T("+{v} % Dégâts de pouvoir sur ennemis électrisés", "+{v}% Ability damage on electrified enemies"), v: 10, fx: null },
      { t: T("+{v} % Électricité (principale)", "+{v}% Primary Electricity"), v: 30, fx: null },
      { t: T("+{v} % Dégâts critiques mêlée (x2 si énergie > 500)", "+{v}% Melee Critical Damage (x2 if energy > 500)"), v: 25, fx: null },
      { t: T("Ramassages santé↔énergie +{v} %", "Health↔energy pickups +{v}%"), v: 20, fx: null }] },
    { c: T("Topaze", "Topaz"), coul: "#fb923c", buffs: [
      { t: T("+{v} % Dégâts de pouvoir sur ennemis irradiés", "+{v}% Ability damage on irradiated enemies"), v: 10, fx: null },
      { t: T("+{v} Bouclier par application d'Explosion", "+{v} Shield per Blast proc"), v: 5, fx: null },
      { t: T("+{v} Santé max par ennemi tué (Explosion), plafonné", "+{v} max Health per enemy killed (Blast), capped"), v: 1, fx: null },
      { t: T("+{v} % Crit secondaire par ennemi brûlé, plafonné", "+{v}% Secondary crit per burning enemy, capped"), v: 1, fx: null }] },
  ];
  function fragTexte(ref) { // ref = {c, b, tau}
    var col = FRAGS[ref.c], bf = col && col.buffs[ref.b];
    if (!bf) return "";
    var v = ref.tau ? Math.round(bf.v * 1.5 * 10) / 10 : bf.v;
    return col.c + (ref.tau ? T(" Tauforgé", " Tauforged") : "") + " — " + bf.t.replace("{v}", v);
  }
  function sommeFrags(eq) {
    var t = { hpFlat: 0, shFlat: 0, arFlat: 0, enFlat: 0, strPct: 0, durPct: 0 };
    (eq && eq.frags || []).forEach(function (ref) {
      if (!ref) return;
      var bf = FRAGS[ref.c] && FRAGS[ref.c].buffs[ref.b];
      if (bf && bf.fx) t[bf.fx] += bf.v * (ref.tau ? 1.5 : 1);
    });
    return t;
  }

  /* ---- Factions (v47, 03/09/2026) ------------------------------------------
     La simulation d'ennemi (préréglage + armure + santé + niveau, croissance
     officielle et temps pour tuer) a été RETIRÉE le 03/09/2026 : trop de
     réglages pour une question qui n'en a qu'une — « contre qui ce build
     frappe-t-il le plus fort ? ». Elle est remplacée par le tableau
     « Efficacité par faction », qui répond à cette question pour les SIX
     factions d'un coup, sans rien à régler.
     Il ne reste ici que les NOMS : la faction retenue (etat.cible.fac) sert
     encore de faction de référence au build auto (« adapter les éléments »). */
  var FACTIONS = {
    grineer:   { n: "Grineer / Scaldra" },
    corpus:    { n: "Corpus" },
    infeste:   { n: T("Infesté", "Infested") },
    corrompu:  { n: T("Corrompu", "Corrupted") },
    murmure:   { n: T("Murmure / Sentient", "Murmur / Sentient") },
    techrot:   { n: "Techrot" },
  };

  /* ------------------------------ Capacité ------------------------------ */
  function capacite(slotId, item, eq) {
    var base = etat.reacteur ? 60 : 30;
    var bonus = 0;
    // v38 : Jade a deux auras — les DEUX ajoutent de la capacité (règle du jeu)
    ["aura", "aura2"].forEach(function (ai) {
      var refA = eq && eq.mods && refDe(eq.mods[ai]);
      if (slotId === "frame" && refA) {
        var am = modParUn(refA.un);
        if (am) bonus += bonusAura(am, polDe(slotId, item, eq, ai), rangDe(refA, am));
      }
    });
    var refS = eq && eq.mods && refDe(eq.mods.st);
    if (refS) {
      var sm = modParUn(refS.un);
      if (sm) bonus += bonusAura(sm, polDe(slotId, item, eq, "st"), rangDe(refS, sm));
    }
    var used = 0;
    if (eq && eq.mods) {
      (eq.mods.slots || []).forEach(function (x, i) {
        var ref = refDe(x);
        if (!ref) return;
        var m = modParUn(ref.un);
        if (m) used += drainDansSlot(m, polDe(slotId, item, eq, i), rangDe(ref, m));
      });
      var refX = refDe(eq.mods.exilus);
      if (refX) {
        var xm = modParUn(refX.un);
        if (xm) used += drainDansSlot(xm, polDe(slotId, item, eq, "x"), rangDe(refX, xm));
      }
    }
    return { total: base + bonus, used: used, aura: bonus };
  }
  /* v38 (17/07/2026, demande de l'admin) : SPÉCIFICITÉS DES FRAMES.
     · Jade a DEUX emplacements d'aura (wiki : « two Aura Mod Slots », un
       universel + un Vazarin) — WFCD l'encode en aura:["aura","vazarin"],
       où "aura" signifie « toute polarité » (→ none chez nous).
     · Sirius & Orion : duo en un seul emplacement d'inventaire, chaque moitié
       a SON menu de mods (wiki) — bascule plus bas, builds conservés. */
  function estAura(i) { return i === "aura" || i === "aura2"; }
  function aurasDe(item) {
    var a = item && item.aura;
    if (Array.isArray(a)) return a.map(function (p) { return p === "aura" ? "none" : p; });
    return [a === "aura" ? "none" : (a || "none")];
  }
  // Polarité d'un emplacement : celle d'origine de l'objet, surchargée par forma.
  function polDe(slotId, item, eq, i) {
    if (eq && eq.formas && eq.formas[i] !== undefined) return eq.formas[i];
    if (estAura(i)) return aurasDe(item)[i === "aura" ? 0 : 1] || "none";
    if (i === "st") return (item && item.spol) || "none";
    /* v68 — LE CRÉNEAU EXILUS A UNE POLARITÉ, et elle était codée en dur à
       « aucune ». Le wiki la publie pour 328 armes sur 353 et 10 Warframes :
       le simulateur facturait donc l'exilus PLEIN TARIF là où le jeu divise le
       drain par deux. Sur 60 de capacité, quatre points décident si un build
       rentre — c'est la contrainte centrale, pas un détail d'affichage. */
    if (i === "x") return (item && item.expol) || "none";
    var pols = (item && item.pol) || [];
    return pols[i] || "none";
  }
  var POL_ICO = { madurai: "V", vazarin: "D", naramon: "—", zenurik: "Ⱶ", unairu: "U", umbra: "Ω", penjaga: "Y", none: "·" };
  // v24 (17/07/2026) : polarités en VRAIS pictogrammes SVG (tracés originaux,
  // mêmes gabarits que les cartes de mods des pages builds) — partout dans
  // l'interface ; POL_ICO reste pour les contextes texte (plan copié, canvas).
  var POL_SVG = {
    madurai: '<path d="M3 4.5 L8 11.5 L13 4.5"/>',
    vazarin: '<path d="M5.5 3 L5.5 13 M5.5 3 C12.5 3.5 12.5 12.5 5.5 13"/>',
    naramon: '<path d="M3 8 L13 8"/>',
    zenurik: '<path d="M5 3 L5 13 M5 8 L12 8"/>',
    unairu: '<path d="M4 3 L4 9 A4 4 0 0 0 12 9 L12 3"/>',
    umbra: '<path d="M3.5 13 H6.6 C4.9 11.6 3.8 10 3.8 8.1 A4.2 4.2 0 1 1 12.2 8.1 C12.2 10 11.1 11.6 9.4 13 H12.5"/>',
    penjaga: '<path d="M8 13 L8 8 M8 8 L4 3 M8 8 L12 3"/>',
  };
  function polSvg(p, cls) {
    if (!POL_SVG[p]) return '<svg class="ars-pol-ic' + (cls ? " " + cls : "") + '" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none"/></svg>';
    return '<svg class="ars-pol-ic' + (cls ? " " + cls : "") + '" viewBox="0 0 16 16" aria-hidden="true">' + POL_SVG[p] + "</svg>";
  }

  /* v36 (17/07/2026) : pictogrammes SVG des TYPES DE DÉGÂTS (tracés originaux,
     un par type comme l'écran du jeu) + couleur par type via la classe
     ars-dmg-<type> (CSS). Utilisés dans les stats et le panneau cible. */
  var DMG_SVG = {
    impact: '<circle cx="8" cy="8" r="3.2"/><path d="M8 1.5 V3.4 M8 12.6 V14.5 M1.5 8 H3.4 M12.6 8 H14.5"/>',
    puncture: '<path d="M8 2 L11 12 H5 Z M8 12 V14.5"/>',
    slash: '<path d="M3 13 L13 3 M6.5 13.2 L8.6 11.1 M10.9 3 L13 3 L13 5.1"/>',
    heat: '<path d="M8 2 C10.8 5 11.6 7 11.6 9.2 A3.6 3.6 0 0 1 4.4 9.2 C4.4 7.6 5 6.4 6.2 5 C6.2 6.6 6.8 7.4 8 8 C7.4 6 7.4 4 8 2 Z"/>',
    cold: '<path d="M8 1.5 V14.5 M2.4 4.8 L13.6 11.2 M13.6 4.8 L2.4 11.2 M8 1.5 L6.3 3.2 M8 1.5 L9.7 3.2 M8 14.5 L6.3 12.8 M8 14.5 L9.7 12.8"/>',
    electricity: '<path d="M9.5 1.5 L4 9 H7.5 L6.5 14.5 L12 7 H8.5 Z"/>',
    toxin: '<path d="M8 2.5 C10.5 5.5 11.5 7.5 11.5 9.5 A3.5 3.5 0 0 1 4.5 9.5 C4.5 7.5 5.5 5.5 8 2.5 Z" /><circle cx="6.4" cy="13.8" r=".9" fill="currentColor" stroke="none"/><circle cx="9.8" cy="14.2" r=".7" fill="currentColor" stroke="none"/>',
    blast: '<path d="M8 2 L9.3 6.7 L14 8 L9.3 9.3 L8 14 L6.7 9.3 L2 8 L6.7 6.7 Z"/>',
    radiation: '<circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/><path d="M8 6.2 L6 2.7 A6 6 0 0 1 10 2.7 Z M9.6 8.9 L13.6 9 A6 6 0 0 1 11.6 12.5 Z M6.4 8.9 L4.4 12.5 A6 6 0 0 1 2.4 9 Z"/>',
    gas: '<path d="M4.5 11.5 A2.5 2.5 0 0 1 4.5 6.5 A3.5 3.5 0 0 1 11.3 5.9 A2.8 2.8 0 0 1 11.5 11.5 Z"/><path d="M5.5 14 H10.5"/>',
    magnetic: '<path d="M4 13 V7 A4 4 0 0 1 12 7 V13 M4 10.6 H6.6 M9.4 10.6 H12"/>',
    viral: '<circle cx="8" cy="8" r="3.4"/><path d="M8 1.6 V4.6 M8 11.4 V14.4 M1.6 8 H4.6 M11.4 8 H14.4 M3.5 3.5 L5.6 5.6 M10.4 10.4 L12.5 12.5 M12.5 3.5 L10.4 5.6 M5.6 10.4 L3.5 12.5"/>',
    corrosive: '<path d="M8 2 C10.6 5 11.6 7 11.6 9.2 A3.6 3.6 0 0 1 4.4 9.2 C4.4 7 5.4 5 8 2 Z M5.8 12.8 L5 14.4 M8 13.4 V15 M10.2 12.8 L11 14.4"/>',
    void: '<path d="M8 2 L14 8 L8 14 L2 8 Z M8 5.4 L10.6 8 L8 10.6 L5.4 8 Z"/>',
    true: '<circle cx="8" cy="8" r="4.5"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/>',
  };
  function dmgSvg(k) {
    if (!DMG_SVG[k]) return "";
    return '<svg class="ars-dmg-ic ars-dmg-' + k + '" viewBox="0 0 16 16" aria-hidden="true">' + DMG_SVG[k] + "</svg>";
  }

  /* v36 : vulnérabilités simplifiées par faction (refonte 36.0, wiki officiel :
     vulnérable = ×1,5 ; résistant = ×0,5). v40 : Techrot complété depuis les
     pages wiki PAR ÉLÉMENT (Magnetic ×1,5, Gas ×1,5, Cold ×0,5 — vérifiées le
     17/07/2026, piste soufflée par le guide éléments 2026 de NoSympathyyCA).
     Groupe Grineer/Scaldra = table Grineer ; Murmure/Sentient = table Murmur,
     les Sentients purs diffèrent (Froid/Radiation, résistent au Corrosif). */
  var FAC_VULN = {
    grineer:  { vuln: ["impact", "corrosive"], res: [] },
    corpus:   { vuln: ["puncture", "magnetic"], res: [] },
    infeste:  { vuln: ["slash", "heat"], res: [] },
    corrompu: { vuln: ["puncture", "viral"], res: ["radiation"] },
    murmure:  { vuln: ["electricity", "radiation"], res: ["viral"] },
    techrot:  { vuln: ["magnetic", "gas"], res: ["cold"] },
  };
  // facteur global : moyenne des multiplicateurs par type pondérée par la
  // répartition des dégâts du build (Σ dmg×mult / Σ dmg)
  function multFaction(dmg, fac) {
    var fv = FAC_VULN[fac];
    if (!fv) return 1;
    var tot = 0, pond = 0, k;
    for (k in dmg) {
      var m = fv.vuln.indexOf(k) >= 0 ? 1.5 : fv.res.indexOf(k) >= 0 ? 0.5 : 1;
      tot += dmg[k]; pond += dmg[k] * m;
    }
    return tot > 0 ? pond / tot : 1;
  }

  /* ------------------------------ Postures ------------------------------
     v48 (03/09/2026). Une posture n'ajoute AUCUNE statistique : elle ajoute de
     la capacité (comme une aura, déjà simulé) et elle donne des COMBOS. Un
     combo = un enchaînement d'attaques dont chaque coup vaut un pourcentage
     des dégâts de base de l'arme, joué en une durée donnée. C'est ÇA le choix
     de posture, et c'est ce qui manquait : le sélecteur proposait les 57
     postures du jeu sans distinction, et aucun chiffre derrière.
     Données : data/arsenal/postures.json (module de données du wiki officiel). */
  function clsKey(x) {
    return String(x || "").toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");
  }
  // Classe de mêlée de l'équipement (null = composant de Zaw / classe inconnue :
  // on n'invente pas, le sélecteur montre alors TOUTES les postures).
  function classeArme(slotId) {
    var it = trouveItem(slotId);
    return (it && it.cat === "Melee" && it.stc) ? it.stc : null;
  }
  function postureVaAvec(m, cls) {
    if (!cls) return true;              // classe inconnue : on ne filtre pas
    var p = D.postures && D.postures[m.un];
    var wt = (p && p.wt) || m.wt || null;
    if (!wt) return true;               // posture sans classe connue : jamais cachée
    return clsKey(wt) === clsKey(cls);
  }
  function classePosture(m) {
    var p = D.postures && D.postures[m.un];
    return (p && p.wt) || m.wt || null;
  }
  /* Combos de la posture équipée, chiffrés avec les mods posés.
     — la durée d'un enchaînement suit la VITESSE D'ATTAQUE (règle du jeu :
       les mods de vitesse accélèrent l'animation) → durée × (base / moddée) ;
     — dégâts du combo = total en % × dégâts moddés par coup, coup moyen
       critique compris (même formule que le DPS affiché au-dessus) ;
     — un combo sans durée publiée garde coups et dégâts, mais pas de DPS. */
  function combosDe(slotId, s0, s1) {
    var refS = eqDe(slotId).mods.st, r = refDe(refS);
    if (!r) return null;
    var m = modParUn(r.un);
    var p = m && D.postures && D.postures[m.un];
    if (!p || !p.c || !p.c.length) return null;
    var vit = (s0.fr > 0 && s1.fr > 0) ? s0.fr / s1.fr : 1; // < 1 = plus rapide
    var coupMoyen = s1.tot * (1 + (s1.cc / 100) * (s1.cm - 1));
    return {
      mod: m, wt: p.wt,
      combos: p.c.map(function (c) {
        var d = c.d ? Math.round(c.d * vit * 100) / 100 : null;
        var deg = c.t / 100 * coupMoyen;
        /* v51 : points de COMBO gagnés par l'enchaînement. Règle du wiki :
           « 100 % de multiplicateur de posture = 1 point » — les dégâts en %
           du combo donnent donc directement ses points. */
        var pts = Math.round(c.t / 100 * 10) / 10;
        return {
          k: c.k, n: c.n, d: d, h: c.h, t: c.t, p: c.p || [],
          deg: Math.round(deg),
          dps: d ? Math.round(deg / d) : null,
          procs: d ? Math.round(c.h / d * (s1.sc / 100) * 10) / 10 : null,
          pts: pts,
          ptsSec: d ? Math.round(pts / d * 10) / 10 : null,
        };
      }),
    };
  }
  /* Meilleur combo d'UNE posture (équipée ou non) avec les mods posés : sert au
     panneau et au sélecteur, pour comparer les postures entre elles. */
  function meilleurCombo(m, s0, s1) {
    var p = D.postures && D.postures[m.un];
    if (!p || !p.c) return null;
    var vit = (s0.fr > 0 && s1.fr > 0) ? s0.fr / s1.fr : 1;
    var coupMoyen = s1.tot * (1 + (s1.cc / 100) * (s1.cm - 1));
    var best = null;
    p.c.forEach(function (c) {
      if (!c.d) return;
      var dps = Math.round(c.t / 100 * coupMoyen / (c.d * vit));
      if (!best || dps > best.dps) best = { n: c.n, k: c.k, dps: dps };
    });
    return best;
  }
  var COMBO_FR = {
    "Neutral": ["Neutre", "Neutral"],
    "Forward": ["Avant", "Forward"],
    "Block": ["Blocage", "Block"],
    "Forward Block": ["Avant + blocage", "Forward + block"],
    "Slide": ["Glissade", "Slide"],
    "Wall": ["Mur", "Wall"],
    "Aerial": ["Aérien", "Aerial"],
    "Heavy": ["Attaque lourde", "Heavy"],
    "Heavy Slam": ["Impact lourd", "Heavy slam"],
    "Slam": ["Impact", "Slam"],
    "Finisher": ["Achèvement", "Finisher"],
  };
  function nomCombo(k) { var v = COMBO_FR[k]; return v ? (EST_EN ? v[1] : v[0]) : k; }
  /* Étiquette « meilleur combo · N DPS » pour comparer les postures ENTRE ELLES
     directement dans le sélecteur et la collection, avec les mods déjà posés. */
  function etiquettePosture(m, slotId) {
    var it = trouveItem(slotId);
    if (!it || it.cat !== "Melee" || !D.postures) return "";
    var b = meilleurCombo(m, statsArme(it, null), statsArme(it, eqDe(slotId)));
    return b ? " · " + esc(b.n) + " " + b.dps + " DPS" : "";
  }

  /* -------------------------------- Vues -------------------------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var CDN = "https://cdn.warframestat.us/img/";
  // Vignette d'objet/mod : image officielle (CDN communautaire WFCD, autorisé par la
  // CSP de la page) ; en cas d'échec réseau, la vignette disparaît proprement (le nom
  // reste — jamais d'icône cassée).
  function imgHtml(it, cls) {
    if (!it || !it.img) return "";
    return '<img class="' + cls + '" loading="lazy" decoding="async" alt="" src="' + CDN + esc(it.img) + '" onerror="this.remove()">';
  }
  var RARETE = { Common: "com", Uncommon: "unc", Rare: "rare", Legendary: "leg", Riven: "riv" };
  function eqDe(slotId) {
    etat.equip[slotId] = etat.equip[slotId] || {};
    var e = etat.equip[slotId];
    e.mods = e.mods || { aura: null, aura2: null, exilus: null, slots: [null, null, null, null, null, null, null, null] };
    e.formas = e.formas || {};
    e.arcanes = e.arcanes || [null, null];
    return e;
  }
  function nbFormas(eq) { return Object.keys(eq.formas || {}).length; }

  /* ---- Configs A/B/C (17/07/2026) — comme dans le jeu : jusqu'à 3 jeux de mods
     par équipement (aura/posture/exilus compris), permutables d'un clic. Les
     FORMAS restent COMMUNS (ce sont les polarités physiques des emplacements),
     tout comme fragments et arcanes — fidèle aux règles du jeu. eq.mods reste
     LA config active (tout le moteur — capacité, stats, partage — la lit telle
     quelle) ; les configs inactives dorment dans eq.cfgs. États anciens : cfg
     absent = config A, rien à migrer. */
  function modsVierges() { return { aura: null, aura2: null, st: null, exilus: null, slots: [null, null, null, null, null, null, null, null] }; }
  function basculeCfg(slotId, n) {
    var eq = eqDe(slotId);
    var cur = eq.cfg || 0;
    if (n === cur) return;
    eq.cfgs = eq.cfgs || {};
    eq.cfgs[cur] = eq.mods;
    eq.mods = eq.cfgs[n] || modsVierges();
    delete eq.cfgs[n];
    eq.cfg = n;
    cible = null;
    sauve(); rendTout();
  }

  function slotsActifs() {
    var fr = trouveItem("frame");
    if (!fr || !fr.exalted || !fr.exalted.length) return SLOTS;
    return SLOTS.concat(fr.exalted.map(function (e, k) {
      return { id: "exalte" + k, nom: T("Exaltée", "Exalted") + (fr.exalted.length > 1 ? " " + (k + 1) : ""), cat: "ex" };
    }));
  }
  function rendLoadout() {
    var h = slotsActifs().map(function (s) {
      var it = trouveItem(s.id);
      var sel = etat.sel === s.id ? " sel" : "";
      var sub = "—";
      if (it) {
        if (/^exalte/.test(s.id)) sub = T("arme de ", "weapon of ") + (trouveItem("frame") || {}).n;
        else if (s.id === "frame") sub = it.exalted && it.exalted.length ? "⚔ " + it.exalted.map(function (e) { return e.n; }).join(", ") : (it.prime ? "Prime" : "");
        else if (s.id === "compagnon") sub = it.cat;
        else sub = it.type || "";
      }
      var delBtn = it && !/^exalte/.test(s.id)
        ? '<span class="ars-mod-x" role="button" tabindex="0" data-delslot="' + s.id + '" title="' + T("Retirer cet équipement", "Remove this equipment") + '" aria-label="' + T("Retirer", "Remove") + '">×</span>' : "";
      return '<button class="ars-slot' + sel + '" data-slot="' + s.id + '">' + delBtn +
        (it ? imgHtml(it, "ars-slot-img") : '<span class="ars-slot-img ars-slot-plus">+</span>') +
        '<span class="ars-slot-txt"><span class="ars-slot-cat">' + s.nom + "</span>" +
        '<span class="ars-slot-nom">' + (it ? esc(it.n) : T("Choisir", "Choose")) + "</span>" +
        '<span class="ars-slot-sub">' + esc(sub) + "</span></span></button>";
    }).join("");
    document.getElementById("ars-loadout").innerHTML = h;
  }

  function rendModScreen() {
    var slotId = etat.sel, s = slotsActifs().find(function (x) { return x.id === slotId; }) || { nom: slotId };
    var it = trouveItem(slotId), box = document.getElementById("ars-mods");
    if (!it) {
      var rien = !SLOTS.some(function (x) { return trouveItem(x.id); });
      if (rien) {
        box.innerHTML = '<div class="ars-intro"><b>' + T("Comment ça marche", "How it works") + "</b><ol>" +
          "<li>" + T("Clique une carte ci-dessus (commence par la <b>Warframe</b>) et choisis dans la liste.", "Click a card above (start with the <b>Warframe</b>) and pick from the list.") + "</li>" +
          "<li>" + T("Équipe des <b>mods</b> ici : la capacité, les polarités et le drain sont ceux du jeu.", "Equip <b>mods</b> here: capacity, polarities and drain match the game.") + "</li>" +
          "<li>" + T("Regarde les <b>statistiques</b> bouger à gauche — vert = mieux, rouge = moins bien.", "Watch the <b>stats</b> move on the left — green = better, red = worse.") + "</li>" +
          '</ol><p class="muted">' + T("Astuce : le bouton « Forma » sous chaque emplacement pose ou enlève la polarité de ton choix ; « Partager le build » copie un lien à envoyer.", "Tip: the “Forma” button under each slot applies or removes the polarity you want; “Share build” copies a link to send.") + "</p></div>" +
          '<div id="ars-vitrine"><p class="ars-coll-tt">' + T("Ou pars d'un build du site — <b>palier expert</b>, pré-équipé :", "Or start from a site build — <b>expert tier</b>, pre-equipped:") + "</p>" +
          '<div class="ars-vit-grid" id="ars-vit-grid"><p class="muted">' + T("Chargement…", "Loading…") + "</p></div></div>";
        rendVitrine();
      } else {
        box.innerHTML = '<p class="muted">' +
          (EST_EN
            ? "First pick " + (slotId === "frame" ? "a Warframe" : "a “" + esc(s.nom) + "” item") + " above, then equip its mods here."
            : "Choisis d'abord " + (slotId === "frame" ? "une Warframe" : "un équipement « " + esc(s.nom) + " »") + " ci-dessus, puis équipe ses mods ici.") +
          "</p>";
      }
      return;
    }
    var eq = eqDe(slotId);
    var cap = capacite(slotId, it, eq);
    var over = cap.used > cap.total;
    var cfgCour = eq.cfg || 0;
    function cfgOccupee(k) { // une config non active a-t-elle des mods ?
      if (k === cfgCour) return true;
      var m = eq.cfgs && eq.cfgs[k];
      return !!(m && ((m.slots || []).some(Boolean) || m.aura || m.aura2 || m.st || m.exilus));
    }
    // v28 : scène façon Orbiter — la frame en GRAND derrière l'interface,
    // lueur au sol, fusion par masque (CSS pur, image CDN habituelle).
    var h = (it.img ? '<div class="ars-scene-fond" aria-hidden="true"><img class="ars-scene-bg" alt="" loading="lazy" decoding="async" src="' + CDN + esc(it.img) + '" onerror="this.parentNode.remove()"><i class="ars-scene-sol"></i></div>' : "") +
      '<div class="ars-cfgs" role="tablist" aria-label="Configs">' + [0, 1, 2].map(function (k) {
        return '<button class="ars-cfg' + (k === cfgCour ? " on" : "") + '" data-cfg="' + k + '" role="tab" aria-selected="' + (k === cfgCour) + '" title="' +
          T("Config " + "ABC"[k] + " — mods indépendants, formas/polarités communes (règle du jeu)",
            "Config " + "ABC"[k] + " — independent mods, shared formas/polarities (game rule)") + '">' +
          "CONFIG " + "ABC"[k] + (cfgOccupee(k) && k !== cfgCour ? " •" : "") + "</button>";
      }).join("") + "</div>" +
      '<p class="ars-upghd">' + imgHtml(it, "ars-upghd-ico") + T("Améliorations", "Upgrades") + ' / ' + esc(it.n) + ' <small>[30]</small></p>' +
      '<div class="ars-cap"><div class="ars-cap-txt">' +
      '<span>' + T("Capacité", "Capacity") + ' <b class="' + (over ? "bad" : "ok") + '">' + cap.used + "</b> / " + cap.total +
      (slotId === "frame" && cap.aura ? " (" + T("dont aura", "incl. aura") + " +" + cap.aura + ")" : "") +
      " · Formas: " + nbFormas(eq) +
      ' · <label><input type="checkbox" id="ars-reacteur"' + (etat.reacteur ? " checked" : "") + "> " + T("Réacteur ×2", "Reactor ×2") + "</label></span></div>" +
      '<div class="ars-cap-bar"><i style="width:' + Math.min(100, cap.used / cap.total * 100) + '%" class="' + (over ? "bad" : "") + '"></i></div>' +
      (over ? '<p class="ars-over">⚠ ' + T("Capacité dépassée — dans le jeu, ce build est impossible : retire des mods ou ajoute des polarités (forma).", "Over capacity — impossible in game: remove mods or add polarities (forma).") + '</p>' : "") +
      "</div>";

    function caseMod(i, label, x) {
      var pol = polDe(slotId, it, eq, i);
      var ref = refDe(x);
      var m = ref && modParUn(ref.un);
      var rk = m ? rangDe(ref, m) : 0;
      var drain = m ? (estAura(i) || i === "st" ? "+" + bonusAura(m, pol, rk) : drainDansSlot(m, pol, rk)) : "";
      var mismatch = m && pol !== "none" && pol !== m.pol;
      var fxTxt = "";
      if (m) {
        var fx = fxAt(m, rk);
        fxTxt = m.fx
          ? (m.lvs && fx ? texteFx(fx) : esc(m.tx.join(" · ")))
          : T("effet non simulé — ", "effect not simulated — ") + esc(m.tx.join(" · ") || "wiki");
      }
      var pips = "";
      if (m && rangMax(m) > 0) {
        for (var pp = 0; pp < rangMax(m); pp++) pips += '<i class="' + (pp < rk ? "on" : "") + '"></i>';
        pips = '<span class="ars-pips" aria-hidden="true">' + pips + "</span>";
      }
      var rkCtl = m && m.lvs
        ? '<span class="ars-rk"><button class="ars-rk-btn" data-rk="-1" data-i="' + i + '" aria-label="' + T("Baisser le rang", "Lower rank") + '">−</button>' +
          '<b>' + rk + "/" + rangMax(m) + "</b>" +
          '<button class="ars-rk-btn" data-rk="1" data-i="' + i + '" aria-label="' + T("Monter le rang", "Raise rank") + '">+</button></span>'
        : (m && rangMax(m) > 0 ? '<span class="ars-rk muted" title="' + T("Effet détaillé par rang non disponible pour ce mod", "Per-rank details unavailable for this mod") + '">' + T("rang max", "max rank") + "</span>" : "");
      // v23 (captures de l'admin) : plus de pastille hexagonale latérale — la polarité
      // vit sur la carte (badge de drain) et DANS l'emplacement vide, comme dans
      // le jeu ; le forma se gère par un bouton explicite sous chaque emplacement.
      var aForma = eq.formas && eq.formas[i] != null;
      var chipForma = '<button class="ars-forma' + (aForma ? " on" : "") + '" data-fslot="' + i + '" title="' +
        T("Poser ou enlever un forma sur cet emplacement (polarité au choix)", "Apply or remove a forma on this slot (any polarity)") + '">' +
        polSvg(pol) + " " + (aForma ? "Forma ✓" : "Forma") + "</button>";
      return '<div class="ars-case' + (m ? " plein" : "") + '" data-i="' + i + '">' +
        (m
          ? '<div class="ars-mod v24 r-' + (RARETE[m.r] || "com") + '" data-drag="' + i + '" title="' +
            T("Glisser pour déplacer ou échanger (l'ordre des emplacements compte pour les éléments)", "Drag to move or swap (slot order matters for elements)") + '">' +
            '<button class="ars-mod-x" data-del="' + i + '" title="' + T("Retirer ce mod", "Remove this mod") + '" aria-label="' + T("Retirer", "Remove") + '">×</button>' +
            '<span class="ars-mod-d' + (mismatch ? " bad" : "") + '" title="Drain">' + drain + (mismatch ? " ⚠" : "") + " " + polSvg(m.pol) + "</span>" +
            '<button class="ars-mod-corps" data-i="' + i + '" title="' + T("Remplacer ce mod", "Replace this mod") + '">' +
            '<span class="ars-mod-art">' + imgHtml(m, "ars-mod-img") + "</span>" +
            '<span class="ars-mod-n">' + esc(nomMod(m)) + "</span>" +
            '<span class="ars-mod-fx">' + fxTxt + "</span></button>" +
            '<span class="ars-mod-pied">' + (rkCtl || "") + pips + "</span></div>"
          : '<button class="ars-vide" data-i="' + i + '"><span class="ars-vide-pol" aria-hidden="true">' + (POL_SVG[pol] ? polSvg(pol, "grand") : "") + "</span>" +
            '<span class="ars-vide-plus">+</span><span class="ars-vide-lbl">' + label + "</span></button>") +
        chipForma +
        "</div>";
    }
    // v24 : comme dans le jeu — aura/posture/exilus sur LEUR rangée du haut
    // (centrée), puis les 8 emplacements de mods en 2 rangées de 4.
    h += '<div class="ars-grille ars-g-haut">';
    if (slotId === "frame") {
      var nbAuras = trouveItem(slotId) ? aurasDe(trouveItem(slotId)).length : 1;
      h += caseMod("aura", nbAuras > 1 ? "Aura 1" : "Aura", eq.mods.aura);
      if (nbAuras > 1) h += caseMod("aura2", "Aura 2", eq.mods.aura2);
    }
    if (it.cat === "Melee" || (/^exalte/.test(slotId) && !it.mag)) h += caseMod("st", T("Posture", "Stance"), eq.mods.st);
    h += caseMod("x", "Exilus", eq.mods.exilus);
    h += '</div><div class="ars-grille">';
    for (var i = 0; i < 8; i++) h += caseMod(i, "Mod " + (i + 1), eq.mods.slots[i]);
    h += "</div>";
    if (slotId === "frame") {
      eq.frags = eq.frags || [null, null, null, null, null];
      h += '<div class="ars-arc">' + T("Fragments d'Archon : ", "Archon Shards: ") + [0, 1, 2, 3, 4].map(function (k) {
        var ref = eq.frags[k];
        var col = ref && FRAGS[ref.c];
        return '<button class="ars-arcbtn ars-fragbtn" data-frag="' + k + '"' +
          (col ? ' style="box-shadow:inset 0 0 0 1px ' + col.coul + '" title="' + esc(fragTexte(ref)) + '"' : "") + ">" +
          (col ? '<i class="ars-frag-dot" style="background:' + col.coul + '"></i>' + esc(col.c) + (ref.tau ? " ✦" : "") : "+ " + T("Fragment ", "Shard ") + (k + 1)) +
          "</button>";
      }).join(" ") + "</div>" +
      (eq.frags.some(Boolean)
        ? '<p class="muted" style="font-size:.78rem;margin:.3em 0 0">' +
          eq.frags.filter(Boolean).map(fragTexte).map(esc).join(" · ") +
          T(" — seuls santé/bouclier/armure/énergie/puissance/durée sont additionnés aux stats.", " — only health/shield/armor/energy/strength/duration are added to the stats.") + "</p>" : "");
      h += '<div class="ars-arc">' + T("Arcanes : ", "Arcanes: ") + [0, 1].map(function (k) {
        var a = eq.arcanes[k] && D.arcanes.find(function (x) { return x.un === eq.arcanes[k]; });
        return '<button class="ars-arcbtn" data-k="' + k + '">' + (a ? esc(a.n) : "+ Arcane " + (k + 1)) + "</button>" +
          (a ? '<span class="muted"> ' + esc(a.tx.join(" · ")) + "</span>" : "");
      }).join(" ") + "</div>";
    }
    // Arcane d'ARME (1 emplacement par arme classique, comme dans le jeu — les
    // exaltées et l'arme de compagnon n'en ont pas). Textes officiels anglais
    // (la source FR du jeu de données ne couvre pas ces arcanes).
    if (slotId === "primaire" || slotId === "secondaire" || slotId === "melee") {
      eq.arcanes = eq.arcanes || [null, null];
      var aw = arcArmeDe(eq);
      var rvBtn = eqDe(slotId).riven;
      h += '<div class="ars-arc">💜 Riven : <button class="ars-arcbtn" data-riven="1">' +
        (rvBtn ? esc(rvBtn.n) + " ✎" : T("+ créer le tien", "+ create yours")) + "</button></div>";
      var aGalv = (eq.mods.slots || []).concat([eq.mods.exilus]).some(function (x) {
        var r = refDe(x), m2 = r && modParUn(r.un);
        return m2 && m2.en && GALV_MAX[m2.en];
      });
      if (aGalv) h += '<div class="ars-arc"><label style="white-space:nowrap"><input type="checkbox" id="ars-galvmax"' + (etat.galvmax ? " checked" : "") + "> " +
        T("mods aux stacks max (On Kill)", "mods at max On-Kill stacks") + "</label></div>";
      h += '<div class="ars-arc">' + T("Arcane d'arme : ", "Weapon arcane: ") +
        '<button class="ars-arcbtn" data-arcarme="1">' + (aw ? esc(aw.n) : "+ Arcane") + "</button>" +
        (aw ? ' <span class="muted">' + esc(aw.tx.join(" · ")) + "</span>" : "") +
        (aw && aw.fx
          ? ' <label style="white-space:nowrap"><input type="checkbox" id="ars-arcmax"' + (etat.arcmax ? " checked" : "") + "> " +
            T("stacks max dans les stats", "max stacks in the stats") + "</label>"
          : (aw ? ' <span class="muted">' + T("(effet conditionnel — non additionné)", "(conditional effect — not added)") + "</span>" : "")) +
        "</div>";
    }
    /* v51 : compteur de combo — réglage EXPLICITE, jamais supposé. Il ne
       s'affiche que si un mod du build s'y adosse (Coup de Sang, Blessures
       Suintantes) ou si l'arme est une mêlée avec une durée de combo. */
    if (it && (it.cat === "Melee" || (/^exalte/.test(slotId) && !it.mag))) {
      var fCb = sommeFx(eqDe(slotId));
      h += '<div class="ars-arc ars-combo-ctl">' +
        T("Compteur de combo ", "Combo counter ") +
        '<select id="ars-combo" class="ars-tri" aria-label="' + T("Multiplicateur de combo", "Combo multiplier") + '">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) {
          return '<option value="' + n + '"' + (comboActuel() === n ? " selected" : "") + ">×" + n +
            (n > 1 ? " (" + coupsPourCombo(n) + T(" coups)", " hits)") : T(" (aucun)", " (none)")) + "</option>";
        }).join("") + "</select>" +
        ((fCb.co || 0) > 0
          ? " " + T("· types de statut sur la cible ", "· status types on target ") +
            '<input type="number" id="ars-statuts" min="0" max="10" value="' + nbStatuts() + '" style="width:4em">'
          : "") +
        '<span class="muted"> ' + T("— le combo ne multiplie pas les attaques normales ; il alimente les attaques lourdes et ces mods.",
          "— combo does not multiply normal attacks; it feeds heavy attacks and these mods.") + "</span></div>";
    }
    box.innerHTML = h;
  }

  // v24 : affichage façon jeu — UNE valeur (la moddée), delta coloré à côté,
  // base dans l'infobulle. Le jeu n'affiche jamais de colonne « Base ».
  // v29 : cle = clé(s) d'effet fx associée(s) à la stat — la ligne devient
  // CLIQUABLE et filtre la collection sur les mods qui touchent cette stat
  // (demande de l'admin : « Perforation » → tous les mods de perforation, etc.).
  function ligne(nom, base, mod, unite, cle) {
    var delta = (typeof mod === "number" && typeof base === "number") ? mod - base : 0;
    var cls = delta > 0 ? "ok" : delta < 0 ? "bad" : "";
    var attrs = cle ? ' class="ars-stat-clic" data-fx="' + esc(Array.isArray(cle) ? cle.join(",") : cle) + '" role="button" tabindex="0" title="' +
      T("Voir les mods qui influencent cette statistique", "See the mods that affect this stat") + '"' : "";
    return "<tr" + attrs + "><td>" + nom + "</td><td class='ars-val " + cls + "' title='" + T("base : ", "base: ") + base + (unite || "") + "'>" +
      mod + (unite || "") + (delta ? " <small>(" + (delta > 0 ? "+" : "") + Math.round(delta * 100) / 100 + ")</small>" : "") + "</td></tr>";
  }
  // clé(s) fx pour un TYPE de dégâts affiché (physique, élément pur ou combiné —
  // un combiné renvoie ses deux éléments primaires, ceux que portent les mods)
  var COMBO_SOURCES = { blast: ["e_cold", "e_heat"], radiation: ["e_electricity", "e_heat"], gas: ["e_heat", "e_toxin"],
    magnetic: ["e_cold", "e_electricity"], viral: ["e_cold", "e_toxin"], corrosive: ["e_electricity", "e_toxin"] };
  function cleDmg(k) {
    if (k === "impact" || k === "puncture" || k === "slash") return ["p_" + k, "dmg"];
    if (COMBO_SOURCES[k]) return COMBO_SOURCES[k];
    if (k === "void" || k === "true") return null;
    return ["e_" + k];
  }
  var NOMS_DMG = EST_EN
    ? { impact: "Impact", puncture: "Puncture", slash: "Slash", heat: "Heat", cold: "Cold",
        electricity: "Electricity", toxin: "Toxin", blast: "Blast", radiation: "Radiation", gas: "Gas",
        magnetic: "Magnetic", viral: "Viral", corrosive: "Corrosive", void: "Void", true: "True" }
    : { impact: "Impact", puncture: "Perforation", slash: "Tranchant", heat: "Chaleur", cold: "Froid",
        electricity: "Électricité", toxin: "Toxine", blast: "Explosion", radiation: "Radiation", gas: "Gaz",
        magnetic: "Magnétique", viral: "Viral", corrosive: "Corrosif", void: "Vide", true: "Vrais" };

  function rendStats() {
    var slotId = etat.sel, it = trouveItem(slotId), box = document.getElementById("ars-stats");
    if (!it) { box.innerHTML = ""; return; }
    var sous = "", sousHtml = null;
    // v38 : frames LIÉES — duo Sirius & Orion (un seul emplacement d'inventaire,
    // chaque moitié a son menu de mods — wiki) et Sevagoth ↔ son Ombre. La
    // bascule conserve le build de chaque moitié (etat.moities, par uniqueName).
    var LIEES = {
      "/Lotus/Powersuits/SiriusOrion/SiriusSuit": { vers: "/Lotus/Powersuits/SiriusOrion/OrionSuit", duo: true },
      "/Lotus/Powersuits/SiriusOrion/OrionSuit": { vers: "/Lotus/Powersuits/SiriusOrion/SiriusSuit", duo: true },
      "/Lotus/Powersuits/Wraith/Wraith": { vers: "/Lotus/Powersuits/Wraith/Reaper" },
      "/Lotus/Powersuits/Wraith/SevagothPrime": { vers: "/Lotus/Powersuits/Wraith/Reaper" },
      "/Lotus/Powersuits/Wraith/Reaper": { vers: "/Lotus/Powersuits/Wraith/Wraith" },
    };
    var lien = slotId === "frame" && LIEES[it.un];
    var lienItem = lien && D.frames.find(function (f) { return f.un === lien.vers; });
    if (slotId === "frame") sousHtml = (it.prime ? "Prime · " : "") + "aura " + aurasDe(it).map(function (p) { return polSvg(p); }).join(" ") + T(" · polarités ", " · polarities ") + (it.pol || []).map(function (p) { return polSvg(p); }).join(" ");
    else if (slotId !== "compagnon") {
      var disp = it.disp ? T(" · disposition riven ", " · riven disposition ") + "●".repeat(it.disp) + "○".repeat(Math.max(0, 5 - it.disp)) : "";
      sous = (it.type || "") + (it.mr ? T(" · maîtrise ", " · mastery ") + it.mr : "") + (it.trig ? " · " + it.trig.toLowerCase() : "") + disp;
    } else sous = it.cat;
    var eq = eqDe(slotId), h = '<div class="ars-st-hd">' + imgHtml(it, "ars-st-img") +
      '<span class="ars-st-tt"><b>' + esc(it.n) + '</b><span class="muted">' + (sousHtml || esc(sous)) + "</span></span></div>";
    if (lienItem) {
      h += '<p class="ars-liee">' + (lien.duo
          ? T("◐ Duo : un seul emplacement d'inventaire, chaque moitié se modde séparément (règle du jeu).",
              "◐ Duo: one inventory slot, each half is modded separately (game rule).")
          : T("◐ Son Ombre se modde séparément (règle du jeu).", "◐ Its Shadow is modded separately (game rule).")) +
        ' <button type="button" class="ars-liee-btn" data-liee="' + esc(lien.vers) + '">' +
        T("Modder ", "Mod ") + esc(lienItem.n) + " →</button></p>";
    }
    // v24 : bloc CAPACITÉ en tête de colonne gauche, comme dans le jeu.
    var capG = capacite(slotId, it, eq), overG = capG.used > capG.total;
    h += '<div class="ars-capzone"><div class="ars-capl">' + T("Capacité", "Capacity") +
      ' <b class="' + (overG ? "bad" : "") + '">' + capG.used + "/" + capG.total + "</b></div>" +
      '<div class="ars-cap-bar"><i style="width:' + Math.min(100, capG.used / Math.max(1, capG.total) * 100) + '%" class="' + (overG ? "bad" : "") + '"></i></div></div>';
    if (slotId === "frame") {
      var st = statsFrame(it, eq);
      var ehp = Math.round(st.hp * (1 + st.ar / 300));
      var formasTot = 0;
      SLOTS.concat(slotsActifs()).forEach(function (x) {
        var e2 = etat.equip[x.id];
        if (e2 && e2.formas) formasTot += Object.keys(e2.formas).length;
      });
      h += '<div class="ars-agg"><span title="' + T("Santé effective contre les dégâts réduits par l'armure : PV × (1 + armure/300)", "Effective health against armor-reduced damage: HP × (1 + armor/300)") + '">' + T("PV effectifs ", "Effective HP ") + ehp + dPin(etat.pin && etat.pin.frame && etat.pin.frame.ehp, ehp) + "</span>" +
        '<span title="' + T("Polarités modifiées sur tout le loadout", "Polarities changed across the whole loadout") + '">' + T("Formas du build : ", "Build formas: ") + formasTot + "</span>" +
        // v53 : Adaptation. Le wiki est formel sur deux points — la résistance
        // est MULTIPLICATIVE avec les autres réductions (dont l'armure, déjà
        // dans les PV effectifs), et elle se cumule PAR TYPE de dégât. C'est un
        // bonus qui se construit en encaissant : réglage explicite, jamais
        // supposé, comme le compteur de combo.
        (st.adapt && etat.adapt
          ? '<span class="ok" title="' + T("PV effectifs ÷ (1 − plafond) : la résistance se multiplie avec la réduction d'armure", "Effective HP ÷ (1 − cap): resistance multiplies with armor reduction") + '">' +
            T("avec Adaptation ", "with Adaptation ") + Math.round(ehp / (1 - st.adapt)) + "</span>"
          : "") +
        // v65 : même règle que la ligne d'Adaptation ci-dessus — une case qui
        // ne change aucun chiffre visible est une case qui ne sert à rien.
        (st.gstr && etat.gstr
          ? '<span class="ok" title="' + T("Puissance des pouvoirs pendant la fenêtre de Pouvoir Grandissant",
              "Ability strength during the Growing Power window") + '">' +
            T("avec Pouvoir Grandissant ", "with Growing Power ") +
            (st.str + Math.round(st.gstr * 100)) + " %</span>"
          : "") + "</div>" +
        (st.adapt
          ? '<p class="ars-adapt"><label><input type="checkbox" id="ars-adapt"' + (etat.adapt ? " checked" : "") + "> " +
            T("Adaptation aux cumuls max (", "Adaptation at max stacks (") + Math.round(st.adapt * 100) + " %)</label> " +
            '<span class="muted">' + T(
              "se construit en encaissant (+10 % par coup reçu, 20 s), séparément pour CHAQUE type de dégât — multiplicatif avec l'armure.",
              "builds up as you take hits (+10% per hit, 20s), separately for EACH damage type — multiplicative with armor.") + "</span></p>"
          : "") +
        /* v65 — POUVOIR GRANDISSANT. Une aura, et un CONDITIONNEL : il faut
           d'abord infliger un statut. Même traitement qu'Adaptation — une case
           décochée par défaut, et la puissance affichée à côté de la valeur
           permanente plutôt qu'à sa place, pour qu'on voie ce que la condition
           achète. */
        (st.gstr
          ? '<p class="ars-gstr"><label><input type="checkbox" id="ars-gstr"' + (etat.gstr ? " checked" : "") + "> " +
            T("Pouvoir Grandissant actif (+", "Growing Power active (+") + Math.round(st.gstr * 100) + " %)</label> " +
            '<span class="muted">' + T(
              "il faut d'abord infliger un statut AVEC UNE ARME ; la fenêtre dure alors " + (st.gdur || 6) +
                " s. C'est une aura, mais le bonus est personnel — il ne vaut que pour toi.",
              "you must first inflict a status WITH A WEAPON; the window then lasts " + (st.gdur || 6) +
                "s. It is an aura, but the bonus is personal — it only applies to you.") + "</span></p>"
          : "") +
        /* v65 — ÉCONOMIE D'ÉNERGIE. Rage et Équilibre ne changent aucune stat
           du tableau : ils changent le RYTHME auquel on récupère de l'énergie.
           Le seul chiffre qu'on puisse en tirer sans inventer les dégâts
           entrants est ce que rend une barre de santé entière — il ne suppose
           rien d'autre que la frame elle-même. On dit aussi ce qu'il vaut
           face à la réserve maximale : c'est là que le mod devient lisible. */
        (function () {
          if (!st.rage && !st.equiEn && !st.equiHp) return "";
          var lignes = [];
          if (st.rage) {
            var rendu = Math.round(st.hp * st.rage);
            lignes.push(T(
              "<b>" + Math.round(st.rage * 100) + " %</b> des dégâts encaissés SUR LA SANTÉ reviennent en énergie : " +
                "toute ta barre (" + st.hp + " PV) rend <b>" + rendu + "</b> d'énergie, soit " +
                Math.round(rendu / Math.max(1, st.en) * 100) + " % de ta réserve (" + st.en + ").",
              "<b>" + Math.round(st.rage * 100) + "%</b> of damage taken ON HEALTH comes back as energy: " +
                "your whole bar (" + st.hp + " HP) returns <b>" + rendu + "</b> energy, i.e. " +
                Math.round(rendu / Math.max(1, st.en) * 100) + "% of your pool (" + st.en + ")."));
          }
          if (st.equiEn || st.equiHp) {
            lignes.push(T(
              "Équilibre : un orbe de santé rend en plus <b>" + Math.round(st.equiEn * 100) +
                " %</b> de sa valeur en énergie, et un orbe d'énergie <b>" + Math.round(st.equiHp * 100) +
                " %</b> en santé.",
              "Equilibrium: a health orb also returns <b>" + Math.round(st.equiEn * 100) +
                "%</b> of its value as energy, and an energy orb <b>" + Math.round(st.equiHp * 100) +
                "%</b> as health."));
          }
          return '<p class="muted ars-energie">' + lignes.join("<br>") + "</p>";
        })() +
        /* v57 — RÉSISTANCES par type. Wiki (Flame Repellent) : « multiplicative
           with other sources of damage resistance such as Adaptation », et
           elles valent sur la santé COMME sur les boucliers, dégâts sur la
           durée compris. On ne les fond donc pas dans le chiffre unique de PV
           effectifs — qui serait faux contre tout autre type — mais on donne
           une ligne par type réellement résisté. */
        (function () {
          var cles = Object.keys(st.res || {});
          if (!cles.length) return "";
          var ad = (st.adapt && etat.adapt) ? st.adapt : 0;
          return '<table class="ars-res">' + cles.map(function (k) {
            var tot = 1 - (1 - st.res[k]) * (1 - ad);
            return "<tr><td>" + FX_FR[k] + "</td><td>" + Math.round(st.res[k] * 100) + " %</td><td>" +
              (tot >= 1
                ? '<b class="ok">' + T("immunisé", "immune") + "</b>"
                : T("PV effectifs ", "Effective HP ") + Math.round(ehp / (1 - tot))) + "</td></tr>";
          }).join("") + "</table>" +
          '<p class="muted ars-res-note">' + T(
            "Ces résistances valent sur la santé ET les boucliers, dégâts sur la durée compris. Elles se MULTIPLIENT entre elles et avec Adaptation (deux sources de 15 % et 45 % donnent 53,25 %, pas 60 %) — les PV effectifs ci-dessus ne valent que contre le type indiqué.",
            "These resistances apply to health AND shields, damage over time included. They MULTIPLY with each other and with Adaptation (15% and 45% give 53.25%, not 60%) — the effective HP above only holds against the listed type.") + "</p>";
        })();
      h += "<h3>" + T("Statistiques (rang 30)", "Stats (rank 30)") + "</h3><table>" +
        ligne(FX_FR.hp, st.base.hp, st.hp, "", "hp") + ligne(FX_FR.sh, st.base.sh, st.sh, "", "sh") +
        ligne(FX_FR.ar, st.base.ar, st.ar, "", "ar") + ligne(T("Énergie", "Energy"), st.base.en, st.en, "", "en") +
        ligne("Sprint", st.base.spr, st.spr, "", "spr") + "</table>" +
        "<h3>" + T("Pouvoirs", "Ability stats") + "</h3><table>" +
        // ordre de l'écran du jeu : Durée, Efficacité, Portée, Puissance
        ligne(FX_FR.dur, 100, st.dur, " %", "dur") + ligne(FX_FR.eff, 100, st.eff, " %", "eff") +
        ligne(FX_FR.rng, 100, st.rng, " %", "rng") + ligne(FX_FR.str, 100, st.str, " %", "str") + "</table>" +
        (st.effCap ? '<p class="muted">' + T("Efficacité plafonnée à 175 % (règle du jeu).", "Efficiency capped at 175% (game rule).") + '</p>' : "") +
        '<p class="muted">' + T("Réduction des dégâts par l\'armure : ", "Armor damage reduction: ") + st.dr + " %</p>" +
        blocDiag(T("🔍 Diagnostic de la Warframe", "🔍 Warframe diagnostic"), diagnostiqueFrame(eq, it)) +
        (it.passive ? '<details class="ars-det"><summary>' + T("Passif", "Passive") + '</summary><p>' + esc(it.passive) + "</p></details>" : "") +
        (it.abilities && it.abilities.length ? "<h3>" + T("Capacités", "Abilities") + "</h3>" +
          it.abilities.map(function (a, ai) {
            var cout = "";
            if (a.cost != null) {
              // v39 : coûts SPÉCIAUX (wiki) — Hildryn paie en BOUCLIERS (l'Effi-
              // cacité s'applique) ; Lavos n'a que des RECHARGES en secondes,
              // que l'Efficacité ne réduit pas (règle du jeu).
              var lavos = /\/Alchemist\//.test(it.un || "");
              var hildryn = /\/IronFrame\//.test(it.un || "");
              if (lavos) {
                cout = '<span class="ars-ab-cout" title="' + T("Recharge (Lavos n'utilise pas d'énergie — l'Efficacité est sans effet)", "Cooldown (Lavos uses no energy — Efficiency has no effect)") + '">⏱ ' + a.cost + " s</span>";
              } else {
                var mod = Math.round(a.cost * (2 - st.eff / 100) * 100) / 100;
                var ico = hildryn ? "🛡" : "⚡";
                var titre = hildryn
                  ? T("Coût en BOUCLIERS (Hildryn — bouge avec l'Efficacité)", "SHIELD cost (Hildryn — moves with Efficiency)")
                  : T("Coût en énergie (bouge avec l'Efficacité)", "Energy cost (moves with Efficiency)");
                cout = '<span class="ars-ab-cout" title="' + titre + '">' + ico + " " +
                  (mod === a.cost ? a.cost : a.cost + ' → <b class="' + (mod < a.cost ? "ok" : "bad") + '">' + mod + "</b>") + "</span>";
              }
            }
            // v30 (17/07/2026, demande de l'admin) : les STATS de la capacité — valeurs
            // du wiki officiel (rang max), multipliées par TES Puissance/Durée/
            // Portée (le type vient du champ wiki, règle du jeu). Base entre
            // parenthèses ; lignes sans donnée propre : absentes, jamais inventées.
            var stTable = "";
            if (a.st && a.st.length) {
              var TYPE_N = { str: FX_FR.str, dur: FX_FR.dur, rng: FX_FR.rng };
              stTable = '<table class="ars-ab-st">' + a.st.map(function (l) {
                var mult = { str: st.str, dur: st.dur, rng: st.rng }[l.t] / 100;
                var mod = Math.round(l.v * mult * 100) / 100;
                if (mod >= 100) mod = Math.round(mod * 10) / 10;
                var cls = mod > l.v ? "ok" : mod < l.v ? "bad" : "";
                return "<tr><td>" + esc(l.l || TYPE_N[l.t] || "") +
                  ' <small class="muted">(' + (TYPE_N[l.t] || "") + ")</small></td>" +
                  '<td class="ars-val ' + cls + '">' + mod + (l.u ? " " + esc(l.u) : "") +
                  (mod !== l.v ? " <small>(" + l.v + ")</small>" : "") + "</td></tr>";
              }).join("") + "</table>";
            }
            return '<details class="ars-det ars-abcard"><summary>' + imgHtml(a, "ars-ab-ico") +
              '<span class="ars-ab-n">' + (ai + 1) + " · " + esc(a.n) + "</span>" + cout +
              "</summary><p>" + esc(a.d || "—") + "</p>" + stTable + "</details>";
          }).join("") +
          '<p class="muted" style="font-size:.75rem;margin:.3em 0 0">' +
          T("Stats des pouvoirs : wiki officiel (rang max de la capacité) × tes Puissance/Durée/Portée. Base entre parenthèses.",
            "Ability stats: official wiki (max ability rank) × your Strength/Duration/Range. Base in parentheses.") + "</p>" : "");
      if (it.exalted && it.exalted.length) {
        // v44 : l'exaltée se modde ICI, sur SON propre emplacement (barre du
        // haut). Le résumé montre base → moddé avec SES mods (eqDe("exalteK")).
        it.exalted.forEach(function (ex, ek) {
          var eqEx = eqDe("exalte" + ek);
          var sx0 = statsArme(ex, null), sx = statsArme(ex, eqEx);
          var modde = (eqEx.mods.slots || []).some(Boolean) || eqEx.mods.exilus || eqEx.mods.st;
          h += "<h3>⚔ " + esc(ex.n) + ' <small class="muted">' +
            T("(arme exaltée — se modde sur son propre emplacement)", "(exalted weapon — modded on its own slot)") + "</small></h3>" +
            "<table>" + ligne(T("Dégâts / coup", "Damage / shot"), sx0.tot, sx.tot) +
            ligne(T("Critique", "Critical"), sx0.cc + " % ×" + sx0.cm, sx.cc + " % ×" + sx.cm) +
            ligne(T("Statut", "Status"), sx0.sc, sx.sc, " %") + "</table>" +
            '<p class="muted"><button type="button" class="ars-liee-btn" data-goexalte="exalte' + ek + '">' +
            (modde ? T("Voir / modifier ses mods →", "View / edit its mods →") : T("Modder cette exaltée →", "Mod this exalted →")) + "</button></p>";
        });
      }
    } else if (slotId === "compagnon") {
      var f = sommeFx(eq);
      // v56 — Berger : une AURA de la frame qui donne des PV et de l'armure
      // PLATS au compagnon. Plats, donc ajoutés APRÈS le pourcentage des mods
      // du compagnon, jamais multipliés par lui.
      var pHp = auraFrameCle("pethp"), pAr = auraFrameCle("petar");
      /* v82 — MODS DE LIEN (Lien-Vitalité, Lien-Redirection, Lien-Fibre).
         « +125 % de la santé max de ta Warframe » : la valeur se prend sur les
         stats MODDÉES de la frame équipée, donc après ses propres mods — pose
         Vitalité sur la frame et le compagnon en profite, comme en jeu.
         Même règle d'application que l'aura Berger juste au-dessus : c'est un
         bonus PLAT, ajouté APRÈS le pourcentage des mods du compagnon et
         jamais multiplié par lui. La règle est écrite sous le tableau, pas
         seulement ici : le joueur doit pouvoir vérifier le calcul.
         Sans frame équipée, lien() vaut 0 — on n'invente pas une frame. */
      var stFr = lienStatsFrame();
      var lien = function (cle, stat) {
        return (stFr && f[cle]) ? stFr[stat] * f[cle] : 0;
      };
      var lHp = lien("lnkhp", "hp"), lSh = lien("lnksh", "sh"), lAr = lien("lnkar", "ar");
      h += "<h3>" + T("Statistiques", "Stats") + "</h3><table>" +
        ligne(FX_FR.hp, it.hp, Math.round(it.hp * (1 + (f.hp || 0)) + pHp + lHp), "", "hp") +
        ligne(FX_FR.sh, it.sh, Math.round(it.sh * (1 + (f.sh || 0)) + lSh), "", "sh") +
        ligne(FX_FR.ar, it.ar, Math.round(it.ar * (1 + (f.ar || 0)) + pAr + lAr), "", "ar") +
        // v54 : SURGARDE. Valeur PLATE, jamais un pourcentage des PV, et
        // surtout : le wiki est formel — « Overguard is not affected by Damage
        // Reduction from armor […] or Damage type resistance effects such as
        // Adaptation ». Elle ne se multiplie donc avec RIEN : ni l'armure du
        // compagnon, ni l'Adaptation posée sur la frame. On l'affiche à part,
        // sans jamais la fondre dans des « PV effectifs ».
        (f.og ? ligne(FX_FR.og, 0, f.og, "", "og") : "") + "</table>" +
        (function () {
          if (!f.hrec) return "";
          var sc = soinChasseur(f.hrec);
          if (!sc) return '<p class="muted ars-chasseur">' + T(
            "Récupération du Chasseur : équipe les griffes de ta bête (emplacement « Arme compagnon ») pour chiffrer le soin — il dépend de leurs dégâts.",
            "Hunter Recovery: equip your beast's claws (“Companion weapon” slot) to see the healing — it depends on their damage.") + "</p>";
          return "<h3>" + T("Soin de la Warframe", "Warframe healing") + "</h3><table>" +
            ligne(T("Récupération du Chasseur", "Hunter Recovery"), 0, sc.pvs, T(" PV/s", " HP/s"), "hp") + "</table>" +
            '<p class="muted ars-chasseur">' + T(
              Math.round(f.hrec * 100) + " % des " + sc.dps + " DPS des griffes (" + esc(sc.g.n) + ", moddées). Coup direct à la cadence de la fiche du wiki, sur une cible sans armure : la cadence réelle dépend de l'IA de la bête, et les dégâts de statut ne sont pas comptés.",
              Math.round(f.hrec * 100) + "% of the claws' " + sc.dps + " DPS (" + esc(sc.g.n) + ", modded). Direct hits at the wiki's listed attack rate, on an unarmored target: the real rate depends on the beast's AI, and status damage is not counted.") + "</p>";
        })() +
        (lHp || lSh || lAr
          ? '<p class="muted ars-lien-pet">' + T("Dont ", "Of which ") +
            [lHp ? Math.round(lHp) + T(" PV", " HP") : "",
             lSh ? Math.round(lSh) + T(" de bouclier", " shield") : "",
             lAr ? Math.round(lAr) + T(" d'armure", " armor") : ""].filter(Boolean).join(", ") +
            T(" venus des mods de lien, calculés sur les statistiques MODDÉES de la Warframe (valeurs plates, ajoutées après les mods du compagnon).",
              " from the link mods, computed on the Warframe's MODDED stats (flat values, added after the companion's mods).") + "</p>"
          : "") +
        (pHp || pAr
          ? '<p class="muted ars-aura-pet">' + T("Dont ", "Of which ") +
            (pHp ? Math.round(pHp) + T(" PV", " HP") : "") + (pHp && pAr ? T(" et ", " and ") : "") +
            (pAr ? Math.round(pAr) + T(" d'armure", " armor") : "") +
            T(" venus de l'aura de la frame (valeurs plates, ajoutées après les mods du compagnon).",
              " from the frame aura (flat values, added after the companion's mods).") + "</p>"
          : "") +
        (f.og
          ? '<p class="muted">' + T(
              "La surgarde est un tampon À PART : ni l'armure ni Adaptation ne la réduisent, et elle ne s'ajoute pas aux PV effectifs. C'est un plafond, atteint par le surplus de soin des coups de mêlée de la Warframe. Quand elle tombe, elle offre 0,5 s d'invulnérabilité et, tant qu'elle tient, elle annule les effets de statut.",
              "Overguard is a SEPARATE buffer: neither armor nor Adaptation reduce it, and it does not add to effective HP. It is a cap, reached by the excess healing from the Warframe's melee hits. When it breaks it grants 0.5s of invulnerability, and while it holds it negates status effects.") + "</p>"
          : "");
    } else {
      var s0 = statsArme(it, null), s1 = statsArme(it, eq);
      // v46 : somme des effets de l'équipement — sert aux mods de FACTION,
      // qui ne touchent aucune stat de l'arme mais multiplient les dégâts
      // contre la faction visée (bloc Cible plus bas).
      var fArme = sommeFx(eq);
      h += "<h3>" + T("Dégâts par coup", "Damage per shot") + "</h3><table>";
      var types = {};
      Object.keys(s0.dmg).forEach(function (k) { types[k] = 1; });
      Object.keys(s1.dmg).forEach(function (k) { types[k] = 1; });
      Object.keys(types).forEach(function (k) {
        // v36 : icône du type + barre de répartition (part du total moddé)
        var part = s1.tot > 0 ? Math.round((s1.dmg[k] || 0) / s1.tot * 100) : 0;
        var nomT = (EST_EN ? (FX_FR["e_" + k] || FX_FR["ec_" + k] || FX_FR["p_" + k] || FX_FR[k] || k) : NOMS_DMG[k]) || k;
        h += ligne('<span class="ars-dmg-nom">' + dmgSvg(k) + esc(nomT) +
          '<i class="ars-dmg-part ars-dmg-' + k + '" style="width:' + part + '%" title="' + part + " %" + '"></i></span>',
          s0.dmg[k] || 0, s1.dmg[k] || 0, "", cleDmg(k));
      });
      var pinA = etat.pin && (etat.pin.armes || []).find(function (x) { return x.slot === slotId; });
      h += ligne("<b>Total</b>", s0.tot, s1.tot, "", "dmg").replace("</td></tr>", (pinA ? dPin(pinA.tot, s1.tot) : "") + "</td></tr>") + "</table>" +
        (it.alt ? '<p class="muted" style="margin:.2em 0 .6em">' + esc(it.alt.n) + " : " + it.alt.tot + T(" d\u00e9g\u00e2ts de base", " base damage") + "</p>" : "") +
        // v49 : l'aura est posée sur la frame mais compte ICI — on le dit.
        (function () {
          var au = aurasArmeNoms(it);
          if (!au.length) return "";
          return '<p class="muted ars-aura-note" style="margin:.2em 0 .6em">' +
            T("Aura de la frame incluse : ", "Frame aura included: ") +
            au.map(function (a) { return "<b>" + esc(a.n) + "</b> +" + a.v + " %"; }).join(" · ") +
            T(" (additif avec les mods de dégâts de base)", " (additive with base damage mods)") +
            (function () {
              var frEq = eqDe("frame"), mA = multAura(frEq), nomC = coactionNom(frEq);
              if (mA === 1 || !nomC) return ".";
              return T(", déjà mis à l'échelle ×", ", already scaled ×") + (Math.round(mA * 10000) / 10000) +
                T(" par ", " by ") + "<b>" + esc(nomC) + "</b>" +
                T(" (les deux moitiés du mod se multiplient).", " (the mod's two halves multiply).");
            })() + "</p>";
        })() +
        "<h3>" + T("Performances", "Performance") + "</h3><table>" +
        ligne(FX_FR.cc, s0.cc, s1.cc, " %", "cc") + ligne(T("Multi. critique", "Crit multiplier"), "×" + s0.cm, "×" + s1.cm, "", "cm") +
        ligne(FX_FR.sc, s0.sc, s1.sc, " %", "sc") +
        ligne(it.cat === "Melee" ? T("Vitesse d'attaque", "Attack speed") : FX_FR.fr, s0.fr, s1.fr, "", "fr") +
        (it.mag ? ligne(FX_FR.mag, s0.mag, s1.mag, "", "mag") + ligne(FX_FR.rel, s0.rel, s1.rel, " s", "rel") : "") +
        ligne("Multishot", s0.ms, s1.ms, "", "ms") +
        // v37 : procs de statut par seconde = cadence × multishot × chance (peut
        // dépasser 1 proc/tir quand la chance passe 100 %) ; répartis entre les
        // types au prorata des dégâts (règle U27.2, pondération ×4 supprimée).
        ligne(T("Procs de statut / s", "Status procs / s"), Math.round(s0.fr * s0.ms * s0.sc) / 100, Math.round(s1.fr * s1.ms * s1.sc) / 100, "", ["sc", "fr", "ms"]) +
        // v50 : bases enfin disponibles (modules du wiki) → les mods
        // correspondants ne sont plus « non simulés ».
        (it.ammo ? ligne(FX_FR.ammo, s0.ammo, s1.ammo, "", "ammo") : "") +
        // v94 : ramassage (AmmoPickup) et précision (dispersion min/max) — deux bases
        // du wiki qui laissaient 12 mods sans effet.
        (it.pick ? ligne(T("Munitions par ramassage", "Ammo per pickup"), s0.pick, s1.pick, "", ["ar_rifle", "ar_shotgun", "ar_sniper", "ar_pistol"]) : "") +
        (s0.prec ? ligne(T("Précision", "Accuracy"), s0.prec.base, s1.prec.moddee, "", "acc") : "") +
        (s0.pt || s1.pt ? ligne(FX_FR.pt, s0.pt, s1.pt, " m", "pt") : "") +
        ((s1.rge !== s0.rge || (it.rge && it.rge <= 60))
          ? ligne(FX_FR.rge, s0.rge, s1.rge, " m", "rge") : "") +
        (it.mrng ? ligne(FX_FR.mrng, s0.mrng, s1.mrng, " m", "mrng") : "") +
        (s1.sdur ? ligne(FX_FR.sdur, 100, Math.round((1 + s1.sdur) * 100), " %", "sdur") : "") +
        (it.cdur ? ligne(FX_FR.cdur, s0.cdur, s1.cdur, " s", "cdur") : "") +
        (s1.icombo ? ligne(FX_FR.icombo, 0, s1.icombo, "", "icombo") : "") +
        (s1.accc ? ligne(FX_FR.accc, 0, Math.round(s1.accc * 1000) / 10, " %", "accc") : "") +
        // v96 : « applies to the total damage dealt by the relevant maneuvers » (wiki) —
        // multiplicateur des finishers ; leurs multiplicateurs par classe ne sont pas modélisés.
        (s1.fin ? ligne(FX_FR.fin, 100, Math.round((1 + s1.fin) * 100), " %", "fin") : "") + "</table>" +
        // v55 : le combo initial peut venir d'une AURA (Acier Préparé) posée
        // sur la frame — un chiffre venu d'un autre emplacement ne doit pas
        // être un mystère, même règle qu'en v49 pour les dégâts.
        (function () {
          var vA = auraComboDe(it, eq);
          if (!vA) return "";
          return '<p class="muted ars-aura-combo" style="margin:.2em 0 .6em">' +
            T("Dont ", "Of which ") + vA + T(" de combo initial venus de l'aura de la frame.",
              " initial combo from the frame aura.") + "</p>";
        })() +
        // Montée en cadence : l'arme n'atteint sa cadence maximale qu'après N
        // tirs. Aucune source ne publie la COURBE de montée → on ne l'invente
        // pas, on annonce que le DPS ci-dessous est celui à pleine cadence.
        // v94 : mutation — l'autre munition, ramassée inutilisée, devient la sienne.
        (s1.amut && it.pick ? '<p class="muted ars-mutation" style="margin:.2em 0 .6em">' +
          T("Mutation : chaque ramassage de munitions ", "Mutation: each unused ") +
          (it.cat === "Secondary" ? T("principales", "primary") : T("secondaires", "secondary")) +
          T(" inutilisées te rend ", " ammo pickup gives you ") + "<b>" + Math.round(s1.pick * s1.amut) + "</b>" +
          T(" munitions (", " rounds (") + Math.round(s1.amut * 1000) / 10 + T(" % de ton ramassage).", " % of your pickup).") + "</p>" : "") +
        // v94 : précision — la dispersion moyenne derrière le chiffre, et la règle.
        (s1.prec && s1.prec.moddee !== s1.prec.base ? '<p class="muted ars-prec" style="margin:.2em 0 .6em">' +
          T("Dispersion moyenne : ", "Average spread: ") + s1.prec.disp + "°. " +
          T("Gros Calibre et Force Magnum ajoutent des degrés plats (pas le % affiché en jeu) ; précision = 100 ÷ dispersion moyenne (wiki).",
            "Heavy Caliber and Magnum Force add flat degrees (not the % shown in game); accuracy = 100 ÷ average spread (wiki).") + "</p>" : "") +
        /* v94 — INCARNON. La jauge se remplit par coups au POINT FAIBLE : pleine en
           charges ÷ gain coups (wiki, vérifié Felarx 30, Phenmor 12, Laetum 12). Vaut
           pour les Incarnon natives ET les armes à Incarnon Genesis installé. */
        (it.incc && it.incg ? '<p class="muted ars-incarnon" style="margin:.2em 0 .6em">' +
          T("Forme Incarnon (arme Incarnon ou Genesis installé) : jauge pleine en ", "Incarnon Form (Incarnon weapon or Genesis installed): full gauge in ") +
          "<b>" + Math.ceil(it.incc / it.incg) + "</b>" + T(" coups au point faible", " weakpoint hits") +
          " (" + it.incc + T(" charges, +", " charges, +") + it.incg + T(" par coup).", " per hit).") + "</p>" : "") +
        // v94 — FAMILLE (Family du wiki) : passer d'une variante à l'autre EN GARDANT le build.
        (function () {
          if (!it.fam) return "";
          var soeurs = (D.armes[it.cat] || []).filter(function (x) { return x.fam === it.fam && x.un !== it.un; });
          if (!soeurs.length) return "";
          return '<p class="muted ars-famille" style="margin:.2em 0 .6em">' + T("Même famille (garde tes mods) : ", "Same family (keeps your mods): ") +
            soeurs.map(function (x) { return '<button type="button" class="ars-fam-b" data-fam-un="' + esc(x.un) + '">' + esc(x.n) + "</button>"; }).join(" ") + "</p>";
        })() +
        (it.spool ? '<p class="muted" style="margin:.2em 0 .6em">' +
          T("Montée en cadence : ", "Spool-up: ") + it.spool + T(" tirs avant la cadence maximale — le DPS ci-dessous est celui à pleine cadence.",
            " shots before max fire rate — the DPS below is the one at full spool.") + "</p>" : "") +
        '<p class="muted" style="margin:.2em 0 .6em">' + T("La barre de chaque type de dégât est aussi sa chance relative de proc (au prorata des dégâts, règle du jeu).", "Each damage type's bar is also its relative proc chance (damage-weighted, game rule).") + "</p>" +
        /* v66 — la case des conditionnels « en visée ». Elle est posée SOUS le
           tableau des performances parce que c'est lui qu'elle change : cochée,
           tout ce qui suit (DPS, saignement, procs) est recalculé avec les
           bonus. On liste les stats touchées avec leur valeur, pour qu'on voie
           ce que la condition achète sans avoir à cocher pour comparer. */
        (function () {
          var c = s1.cond || {};
          var parts = [];
          if (c.cc) parts.push("+" + Math.round(c.cc * 100) + " % " + FX_FR.cc.toLowerCase());
          if (c.cm) parts.push("+" + Math.round(c.cm * 100) + " % " + FX_FR.cm.toLowerCase());
          if (c.sc) parts.push("+" + Math.round(c.sc * 100) + " % " + FX_FR.sc.toLowerCase());
          if (c.fr) parts.push("+" + Math.round(c.fr * 100) + " % " + FX_FR.fr.toLowerCase());
          if (!parts.length) return "";
          return '<p class="ars-cvise"><label><input type="checkbox" id="ars-cvise"' +
            (etat.cvise ? " checked" : "") + "> " +
            T("Conditions « en visée » remplies (", "Aiming conditions met (") + parts.join(" · ") + ")</label> " +
            '<span class="muted">' + T(
              "ces bonus demandent de VISER et d'avoir rempli le déclencheur du mod (tir à la tête, élimination, lancer de pouvoir…)" +
                (s1.cvdur ? ", pour " + s1.cvdur + " s" : "") +
                ". Coché, tout le panneau — DPS et saignement compris — est recalculé avec eux.",
              "these bonuses require AIMING and having met the mod's trigger (headshot, kill, ability cast…)" +
                (s1.cvdur ? ", for " + s1.cvdur + "s" : "") +
                ". When checked, the whole panel — DPS and bleed included — is recomputed with them.") +
            "</span></p>";
        })() +
        "<h3>" + T("DPS estimé", "Estimated DPS") + "</h3><table>" +
        ligne(T("Rafale", "Burst"), s0.burst, s1.burst, "", "dmg").replace("</td></tr>", (pinA ? dPin(pinA.burst, s1.burst) : "") + "</td></tr>") + ligne(T("Soutenu", "Sustained"), s0.sout, s1.sout, "", "dmg").replace("</td></tr>", (pinA ? dPin(pinA.sout, s1.sout) : "") + "</td></tr>") +
          /* v58 — SAIGNEMENT (Munitions du Chasseur). Affiché À PART et jamais
             ajouté aux deux lignes ci-dessus : les ticks IGNORENT L'ARMURE,
             alors que le DPS du dessus, lui, la subit. Les additionner
             donnerait un chiffre qui ne vaut contre aucune cible réelle.
             Même règle qu'en v54 pour la surgarde. */
          (s1.hm && s1.saign
            ? "<tr><td>" + T("Saignement <small class='muted'>(moyen, hors armure)</small>",
                "Bleed <small class='muted'>(average, ignores armor)</small>") +
              "</td><td class='ars-val ok'>" + s1.saign + "</td></tr>"
            : "") +
          // v64 — le saignement d'Hémorragie, sur sa PROPRE ligne. Il ignore
          // l'armure comme celui de v58, et pour la même raison il n'est pas
          // ajouté au DPS du dessus. Deux lignes plutôt qu'une somme : les
          // deux mods peuvent coexister, mais leurs chaînes de déclenchement
          // n'ont rien de commun, et les mélanger cacherait lequel porte le
          // chiffre — donc quel mod retirer si on veut de la capacité.
          (s1.hem && s1.hemDps
            ? "<tr><td>" + T("Saignement d'Impact <small class='muted'>(moyen, hors armure)</small>",
                "Impact bleed <small class='muted'>(average, ignores armor)</small>") +
              "</td><td class='ars-val ok'>" + s1.hemDps + "</td></tr>"
            : "") + "</table>" +
          (s1.hm && s1.saign
            ? '<p class="muted ars-saign">' + T(
                "Munitions du Chasseur : " + Math.round(s1.hm * 100) + " % de chance sur chaque coup CRITIQUE d'appliquer un Tranchant — " +
                  s1.saignProcs + " proc/s, " + s1.saignTick + " par tick, " + s1.saignTicks +
                    " ticks d'une seconde après 1 s de délai (durée " + s1.saignDuree + " s). " +
                  "Ces dégâts IGNORENT L'ARMURE : c'est l'intérêt du mod, et pourquoi ils ne sont pas ajoutés au DPS ci-dessus. " +
                  "Ils ne dépendent QUE des dégâts de base moddés — ni les mods élémentaires ni les mods physiques ne les augmentent — " +
                  "mais le multiplicateur critique compte, et les mods de faction s'y appliquent DEUX fois (×1,69 pour un +30 %).",
                "Hunter Munitions: " + Math.round(s1.hm * 100) + "% chance on each CRITICAL hit to force a Slash proc — " +
                  s1.saignProcs + " proc/s, " + s1.saignTick + " per tick, " + s1.saignTicks +
                    " one-second ticks after a 1s delay (" + s1.saignDuree + "s duration). " +
                  "This damage IGNORES ARMOR: that is the point of the mod, and why it is not added to the DPS above. " +
                  "It depends ONLY on modded base damage — neither elemental nor physical mods raise it — " +
                  "but the critical multiplier counts, and faction mods apply to it TWICE (×1.69 for a +30% one).") +
              (s1.sdur
                ? " " + T("La durée de statut équipée (+" + Math.round(s1.sdur * 100) + " %) allonge les 6 s de base — c'est ce qui donne " + s1.saignTicks + " ticks au lieu de 6.",
                          "The equipped status duration (+" + Math.round(s1.sdur * 100) + "%) extends the base 6s — that is what gives " + s1.saignTicks + " ticks instead of 6.")
                : "") + "</p>"
            : "") +
          /* v64 — la note d'Hémorragie. Elle dit la chaîne ENTIÈRE, parce que
             c'est elle qui surprend : trois conditions s'enchaînent avant le
             moindre tick, et la part d'Impact — la seule que le joueur peut
             faire bouger sans le vouloir — se lit dans le tableau de dégâts
             juste au-dessus. */
          (s1.hem && s1.hemDps
            ? '<p class="muted ars-hem">' + T(
                "Hémorragie : un statut d'Impact a " + Math.round(s1.hem * 100) +
                  " % de chance d'appliquer un Tranchant" +
                  (s1.hemX2 ? " — DOUBLÉ à " + Math.round(s1.hem * 200) + " % parce que la cadence moddée (" + s1.fr + ") est sous 2,5" : "") +
                  ". Trois conditions s'enchaînent : un statut part (" + s1.sc + " %), " +
                  "il tombe sur Impact (" + s1.hemPart + " % des dégâts), puis le mod se déclenche — " +
                  "soit " + s1.hemProcs + " proc/s et " + s1.hemTick + " par tick. " +
                  "ATTENTION, c'est l'INVERSE de Munitions du Chasseur : un mod élémentaire DILUE la part d'Impact et FAIT BAISSER ce saignement. " +
                  "Le critique n'est pas requis ici, donc son multiplicateur ne compte qu'au prorata des coups critiques.",
                "Hemorrhage: an Impact status has a " + Math.round(s1.hem * 100) +
                  "% chance to apply a Slash proc" +
                  (s1.hemX2 ? " — DOUBLED to " + Math.round(s1.hem * 200) + "% because the modded fire rate (" + s1.fr + ") is below 2.5" : "") +
                  ". Three conditions chain up: a status procs (" + s1.sc + "%), " +
                  "it lands on Impact (" + s1.hemPart + "% of damage), then the mod fires — " +
                  "that is " + s1.hemProcs + " procs/s and " + s1.hemTick + " per tick. " +
                  "CAREFUL, this is the OPPOSITE of Hunter Munitions: an elemental mod DILUTES the Impact share and LOWERS this bleed. " +
                  "A critical hit is not required here, so its multiplier only counts in proportion to critical hits.") + "</p>"
            : "");
      // v52 : bloc ATTAQUE LOURDE — le seul endroit où le multiplicateur de
      // combo agit sur les dégâts (règle du jeu).
      if (it.hvy) {
        var cbo = comboActuel();
        h += "<h3>" + T("Attaque lourde", "Heavy attack") + "</h3><table>" +
          ligne(FX_FR.hvy + " <small class='muted'>(×" + cbo + ")</small>", s0.hvy, s1.hvy, "", "dmg") +
          "<tr><td>" + T("Multiplicateur de classe", "Class multiplier") + "</td><td class='ars-val'>×" +
          s1.hvyMult + "</td></tr>" +
          (it.wup ? ligne(FX_FR.wup, s0.wup, s1.wup, " s", "wup") : "") +
          (s1.heff ? "<tr><td>" + T("Combo consommé", "Combo consumed") + "</td><td class='ars-val ok'>" +
            // wiki Melee_Combo : efficacité plafonnée à 90 % → une lourde coûte toujours
            // au moins 10 % du combo (Bobine Réflexe Prime seule affichait 0 %)
            Math.max(10, 100 - s1.heff) + " %</td></tr>" : "") + "</table>" +
          '<p class="muted">' + T(
            "Dégâts normaux moddés × multiplicateur fixe de la classe d'arme × multiplicateur de combo (règle du jeu). Coup Mortel s'ajoute dans le même seau que Point de Pression, mais pour la lourde seule. La vitesse d'attaque ne réduit PAS le temps de charge — elle réduit l'intervalle entre deux lourdes. L'attaque lourde consomme le compteur de combo.",
            "Modded normal damage × the weapon class's fixed multiplier × the combo multiplier (game rule). Killing Blow adds into the same bucket as Pressure Point, but for heavy attacks only. Attack speed does NOT reduce wind-up — it reduces the interval between heavy attacks. A heavy attack spends the combo counter.") + "</p>";
      }
      if (it.cat === "Melee") h += blocPosture(slotId, s0, s1);
      var awN = arcArmeDe(eq);
      if (awN) {
        h += '<p class="muted">' + (awN.fx && etat.arcmax
          ? T("Arcane « ", "Arcane “") + esc(awN.n) + T(" » incluse dans « Moddé » à ses stacks max (bonus multiplicatif avec les mods).",
              "” included in “Modded” at its max stacks (bonus multiplicative with mods).")
          : T("Arcane « ", "Arcane “") + esc(awN.n) + T(" » équipée mais NON additionnée aux chiffres", "” equipped but NOT added to the numbers") +
            (awN.fx ? T(" — coche « stacks max » pour l'inclure.", " — tick “max stacks” to include it.") : T(" (effet conditionnel).", " (conditional effect)."))) + "</p>";
      }
      /* ---- Efficacité par faction (v47, 03/09/2026) ----------------------
         Une seule question, six réponses : contre QUI ce build frappe-t-il le
         plus fort ? Pour chaque faction on multiplie les deux modificateurs
         que le jeu applique — ils vivent dans des « boîtes » séparées, donc
         ils se MULTIPLIENT (et ne s'additionnent pas) :
           • vulnérabilité du type de dégât (refonte 36.0 : vulnérable ×1,5,
             résistant ×0,5), pondérée par la répartition RÉELLE des dégâts
             du build — un build 100 % corrosif profite de tout le ×1,5,
             un build moitié corrosif moitié impact d'une partie seulement ;
           • mods de faction équipés (Fléau/Châtie-/Expulse-/Purifie-),
             additifs entre eux pour une même faction (×1,3 + ×1,55 = ×1,85).
         Exemple : corrosif pur contre Grineer = ×1,5 ; + Fléau des Grineers
         Accru Prime (×1,55) = ×2,33 au total (et non ×2,05 : le jeu
         multiplie ces deux boîtes, il ne les additionne pas).
         Cliquer une ligne choisit la faction de référence du build auto. */
      var facRef = (etat.cible && etat.cible.fac) || null;
      var rangs = Object.keys(FACTIONS).map(function (k) {
        var vuln = multFaction(s1.dmg, k), bane = 1 + (fArme["f_" + k] || 0);
        return { k: k, vuln: vuln, bane: bane, tot: vuln * bane };
      });
      var meilleur = rangs.reduce(function (a, b) { return b.tot > a.tot ? b : a; }).tot;
      var pire = rangs.reduce(function (a, b) { return b.tot < a.tot ? b : a; }).tot;
      var r2 = function (x) { return Math.round(x * 100) / 100; };
      // Deux colonnes seulement : le panneau de gauche fait ~320 px, un tableau
      // à cinq colonnes y débordait. Le détail du calcul vit sous le total, et
      // les chiffres sont AUSSI en attributs data- (recette indépendante de la
      // mise en page).
      h += "<h3>" + T("Efficacité par faction", "Effectiveness by faction") + "</h3>" +
        '<table class="ars-fac-tbl">' +
        rangs.map(function (r) {
          var fv = FAC_VULN[r.k] || { vuln: [], res: [] };
          // vert = meilleure faction du build (seulement s'il y a un vrai gain) ;
          // rouge = faction contre laquelle le build PERD (× < 1, résistance) —
          // un ×1 tout nu n'est pas un défaut, il ne se colore pas.
          var cls = (meilleur > pire && r.tot === meilleur && meilleur > 1) ? " best"
            : (r.tot === pire && pire < 1) ? " worst" : "";
          var el = FAC_ELEMS[r.k];
          var dmgF = Math.round(s1.tot * r.tot * 10) / 10;
          return '<tr class="ars-fac-r' + cls + (r.k === facRef ? " ref" : "") + '" data-fac="' + r.k +
            '" data-vuln="' + r2(r.vuln) + '" data-bane="' + r2(r.bane) + '" data-tot="' + r2(r.tot) +
            '" data-dmg="' + dmgF + '" role="button" tabindex="0" title="' +
            T("Faction de référence du build auto", "Reference faction for the auto-build") + '">' +
            '<td><span class="ars-fac-n">' + esc(FACTIONS[r.k].n) + "</span>" +
            (el ? '<span class="ars-fac-el">' + fv.vuln.map(dmgSvg).join("") + esc(el.n) + "</span>" : "") +
            (fv.res.length ? '<span class="ars-fac-el bad">' + fv.res.map(dmgSvg).join("") + "−50 %</span>" : "") +
            '</td><td class="ars-fac-tot"><b>×' + r2(r.tot) + "</b>" +
            '<span class="ars-fac-detail">×' + r2(r.vuln) +
            (r.bane > 1 ? ' <span class="ok">× ' + r2(r.bane) + "</span>" : "") +
            " → " + dmgF + "</span>" +
            '<i class="ars-fac-bar" style="width:' + Math.round(Math.min(1, r.tot / Math.max(meilleur, 1)) * 100) + '%"></i>' +
            "</td></tr>";
        }).join("") + "</table>" +
        '<p class="muted">' + T(
          "Multiplicateur total = vulnérabilité du type de dégât × mods de faction équipés : le jeu range les deux dans des boîtes séparées, donc ils se MULTIPLIENT. Corrosif pur contre Grineer ×1,5, plus un Fléau des Grineers Accru Prime ×1,55, donne ×2,33 (et non ×2,05). La vulnérabilité est pondérée par la répartition réelle des dégâts du build. Clique une ligne pour en faire la faction de référence du build auto. Hors armure, boucliers et surgarde de la cible.",
          "Total multiplier = damage-type vulnerability × equipped faction mods: the game keeps the two in separate buckets, so they MULTIPLY. Pure Corrosive vs Grineer ×1.5, plus a Primed Bane of Grineer ×1.55, gives ×2.33 (not ×2.05). Vulnerability is weighted by the build's real damage spread. Click a row to make it the auto-build's reference faction. Excludes target armor, shields and overguard.") + "</p>";
      h += blocDiag(T("🔍 Diagnostic du build", "🔍 Build diagnostic"), diagnostiqueArme(eq, it, s1));
      h += '<p class="muted">' + T("Coup moyen critique compris ; hors bonus conditionnels. Les vulnérabilités et les mods de faction (Fléau…) ne comptent que dans le tableau « Efficacité par faction ». En jeu, chaque type de dégât est arrondi au 1/16 des dégâts de base (quantization) : l'arsenal du jeu affiche des valeurs arrondies.", "Average shot includes crits; excludes conditional bonuses. Faction vulnerabilities and faction mods (Bane…) only count in the “Effectiveness by faction” table. In game, each damage type is rounded to 1/16 of base damage (quantization): the in-game arsenal shows rounded values.") + '</p>';
    }
    box.innerHTML = h;
  }

  /* v48 : panneau POSTURE — ce que la posture équipée fait vraiment. */
  function blocPosture(slotId, s0, s1) {
    var cls = classeArme(slotId);
    var info = combosDe(slotId, s0, s1);
    if (!info) {
      var dispo = D.mods.filter(function (m) { return m.st && postureVaAvec(m, cls); }).length;
      return '<h3>' + T("Posture", "Stance") + "</h3><p class=\"muted\">" +
        T("Aucune posture équipée — elle ajoute de la capacité (comme une aura) et débloque les enchaînements.",
          "No stance equipped — it adds capacity (like an aura) and unlocks the combos.") +
        (cls ? " " + dispo + T(" compatibles ", " compatible ") + esc(cls) + "." : "") + "</p>";
    }
    var meilleur = 0;
    info.combos.forEach(function (c) { if (c.dps > meilleur) meilleur = c.dps; });
    return "<h3>" + T("Posture", "Stance") + "</h3>" +
      '<p class="ars-post-n">' + esc(nomMod(info.mod)) +
      (info.wt ? ' <span class="muted">— ' + esc(info.wt) + "</span>" : "") + "</p>" +
      '<table class="ars-post-tbl">' + info.combos.map(function (c) {
        return '<tr class="ars-post-r' + (c.dps && c.dps === meilleur ? " best" : "") + '">' +
          "<td><b>" + esc(nomCombo(c.k)) + "</b>" +
          '<span class="ars-post-sub">' + esc(c.n) + " · " + c.h + T(c.h > 1 ? " coups" : " coup", c.h > 1 ? " hits" : " hit") + " · " + c.t + " %" +
          " · " + c.pts + T(" pts combo", " combo pts") +
          (c.p.length ? " · " + c.p.map(esc).join(", ") : "") + "</span></td>" +
          '<td class="ars-post-dps">' + (c.dps ? "<b>" + c.dps + "</b>" : '<span class="muted">—</span>') +
          '<span class="ars-post-sub">' + (c.d ? c.d + T(" s · ", " s · ") + c.deg + T(" dégâts", " damage") : T("durée non publiée", "duration not published")) +
          "</span></td></tr>";
      }).join("") + "</table>" +
      (function () {
        // v51 : montée du compteur de combo. Wiki : 100 % de multiplicateur de
        // posture = 1 point ; ×12 (le plafond) demande 220 coups consécutifs.
        var meilleurP = null;
        info.combos.forEach(function (c) { if (c.ptsSec && (!meilleurP || c.ptsSec > meilleurP.ptsSec)) meilleurP = c; });
        if (!meilleurP) return "";
        /* v96 — chance de combo supplémentaire : « affects all sources of combo count
           generation » (wiki True_Punishment) → chaque point en rapporte (1 + chance). */
        var gain = 1 + ((s1 && s1.accc) || 0);
        var ptsSec = Math.round(meilleurP.ptsSec * gain * 10) / 10;
        var secs = Math.round(coupsPourCombo(12) / (meilleurP.ptsSec * gain));
        return '<p class="ars-post-montee">' + T("Montée du combo : ", "Combo build-up: ") +
          "<b>" + esc(meilleurP.n) + "</b> " + T("donne ", "gives ") + ptsSec +
          T(" pts/s → ×12 en ", " pts/s → ×12 in ") + "<b>" + secs + " s</b>" +
          T(" de frappe continue", " of continuous attacking") +
          (gain > 1 ? T(" (dont +", " (incl. +") + Math.round((gain - 1) * 100) + T(" % de combo supplémentaire).", " % additional combo).") : ".") + "</p>";
      })() +
      '<p class="muted">' + T(
        "DPS d'un enchaînement joué en boucle : dégâts totaux du combo (en % des dégâts de base, coup moyen critique compris) divisés par sa durée, elle-même accélérée par la vitesse d'attaque moddée. Une posture n'ajoute AUCUNE statistique — elle ajoute de la capacité et donne ces enchaînements. Les procs listés sont FORCÉS (indépendants de la chance de statut). Les points de combo suivent la règle du jeu : 100 % de multiplicateur de posture = 1 point. Hors attaques lourdes et bonus conditionnels.",
        "DPS of one combo played on loop: the combo's total damage (as % of base damage, average crit included) divided by its duration, itself sped up by modded attack speed. A stance adds NO stat — it adds capacity and gives these combos. Listed procs are FORCED (independent of status chance). Combo points follow the game rule: 100% stance damage multiplier = 1 point. Excludes heavy attacks and conditional bonuses.") + "</p>";
  }

  /* ------------------------------ Sélecteurs ------------------------------ */
  var picker = document.getElementById("ars-picker");
  function ouvrePicker(titre, liste, rendu, surChoix) {
    picker.hidden = false;
    picker.innerHTML = '<div class="ars-pk-bd"></div><div class="ars-pk-box"><div class="ars-pk-top"><b>' +
      esc(titre) + '</b><input type="search" id="ars-pk-q" placeholder="' + T("Filtrer…", "Filter…") + '" aria-label="' + T("Filtrer", "Filter") + '">' +
      '<button class="ars-pk-x" aria-label="' + T("Fermer", "Close") + '">×</button></div><div class="ars-pk-liste" id="ars-pk-liste"></div></div>';
    var lst = document.getElementById("ars-pk-liste");
    function draw(q) {
      // v27 : recherche insensible aux ACCENTS et bilingue (« intensite » trouve
      // Intensité, « serration » trouve Dentelure via le nom EN) — même règle
      // que la collection du bas.
      var qq = normalize(q || "");
      var vis = liste.filter(function (x) {
        return !qq || normalize(x.n).indexOf(qq) !== -1 || (x.en && normalize(x.en).indexOf(qq) !== -1);
      }).slice(0, 400);
      lst.innerHTML = vis.map(rendu).join("") || '<p class="muted" style="padding:12px">' + T("Aucun résultat", "No result") + "</p>";
      Array.prototype.forEach.call(lst.querySelectorAll("[data-un]"), function (el) {
        el.addEventListener("click", function () { picker.hidden = true; surChoix(el.getAttribute("data-un") || null); });
      });
    }
    draw("");
    var champ = document.getElementById("ars-pk-q");
    champ.addEventListener("input", function (e) { draw(e.target.value); });
    champ.focus();
    picker.querySelector(".ars-pk-bd").onclick = picker.querySelector(".ars-pk-x").onclick = function () { picker.hidden = true; };
    // v31 : navigation au CLAVIER — ↑/↓ surlignent, Entrée choisit, la saisie
    // reste dans le champ de recherche (comme les palettes de commandes).
    var kbIdx = -1;
    function kbItems() { return lst.querySelectorAll(".ars-pk-it"); }
    function kbMaj() {
      var its = kbItems();
      for (var k = 0; k < its.length; k++) its[k].classList.toggle("kb", k === kbIdx);
      if (kbIdx >= 0 && its[kbIdx]) its[kbIdx].scrollIntoView({ block: "nearest" });
    }
    champ.addEventListener("input", function () { kbIdx = -1; kbMaj(); });
    document.addEventListener("keydown", function fNav(e) {
      if (picker.hidden) { document.removeEventListener("keydown", fNav); return; }
      if (e.key === "Escape") { picker.hidden = true; document.removeEventListener("keydown", fNav); return; }
      var its = kbItems();
      if (!its.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); kbIdx = Math.min(kbIdx + 1, its.length - 1); kbMaj(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); kbIdx = Math.max(kbIdx - 1, 0); kbMaj(); }
      else if (e.key === "Enter" && kbIdx >= 0 && its[kbIdx]) { e.preventDefault(); its[kbIdx].click(); }
    });
  }
  function pickItem(slotId) {
    var s = SLOTS.find(function (x) { return x.id === slotId; });
    var liste = slotId === "frame" ? D.frames
      : slotId === "compagnon" ? D.comp.compagnons
      : slotId === "armecomp" ? armesPourCompagnon()
      : D.armes[s.cat];
    ouvrePicker(T("Choisir — ", "Choose — ") + s.nom, [{ n: T("(vider l'emplacement)", "(empty the slot)"), un: "" }].concat(liste), function (x) {
      if (!x.un) return '<button class="ars-pk-it" data-un=""><b>' + esc(x.n) + "</b></button>";
      var sub = slotId === "frame"
        ? T("PV ", "HP ") + (x.hp + 100) + T(" · Armure ", " · Armor ") + x.ar + T(" · Énergie ", " · Energy ") + Math.round(x.en * 1.5) + (x.exalted && x.exalted.length ? T(" · ⚔ exaltée", " · ⚔ exalted") : "")
        : slotId === "compagnon" ? x.cat + T(" · PV ", " · HP ") + x.hp + T(" · Armure ", " · Armor ") + x.ar
        : (x.type || "") + " · " + Object.values(x.dmg || {}).reduce(function (a, b) { return a + b; }, 0).toFixed(0) + T(" dgts · crit ", " dmg · crit ") + Math.round(x.cc * 100) + " %";
      return '<button class="ars-pk-it" data-un="' + esc(x.un) + '">' + imgHtml(x, "ars-pk-img") +
        '<span class="ars-pk-txt"><b>' + esc(x.n) + '</b><span class="muted">' + esc(sub) + "</span></span></button>";
    }, function (un) {
      if (un === "" || un === null) { delete etat.equip[slotId]; }
      // v98 — rechoisir l'objet DÉJÀ équipé ne touche à rien : avant, la case était
      // remplacée par { un } et tout le build (mods, formas, arcanes) disparaissait.
      else if (!(etat.equip[slotId] && etat.equip[slotId].un === un)) { etat.equip[slotId] = { un: un }; eqDe(slotId); }
      etat.sel = slotId; sauve(); rendTout();
    });
  }
  /* v97 — en jeu, une bête n'a QUE ses griffes (pas interchangeables) et un
     robot n'a jamais de griffes. Sans compagnon équipé, tout reste proposé. */
  function armesPourCompagnon() {
    var c = trouveItem("compagnon"), l = D.comp.armes;
    if (!c) return l;
    if (c.cat === "Bête") {
      var g = l.filter(function (a) { return a.cat === "Claws" && a.bete === c.n; });
      return g.length ? g : l;
    }
    return l.filter(function (a) { return a.cat !== "Claws"; });
  }
  /* v97 — RÉCUPÉRATION DU CHASSEUR. Wiki (Hunter_Recovery) : la bête soigne la
     Warframe de 30 % des dégâts qu'elle inflige. Ces dégâts sont ceux de ses
     GRIFFES (arme à part depuis la mise à jour 37) : on reprend leur DPS moddé,
     calculé par le même statsArme que toutes les autres armes. null si les
     griffes ne sont pas équipées — on n'invente pas de DPS. */
  function soinChasseur(taux) {
    var g = trouveItem("armecomp");
    if (!taux || !g || g.cat !== "Claws") return null;
    var st = statsArme(g, eqDe("armecomp"));
    return { g: g, dps: st.burst, pvs: Math.round(st.burst * taux) };
  }
  function compatPour(slotId, i) {
    if (slotId === "frame") return estAura(i) ? ["AURA"] : ["WARFRAME"];
    if (/^exalte/.test(slotId)) {
      var ex = trouveItem(slotId);
      return ex && ex.mag ? (/Pistol/i.test(ex.un) ? ["Pistol", "SECONDARY"] : ["Rifle", "Sniper", "PRIMARY"]) : ["Melee", "MELEE"];
    }
    if (slotId === "compagnon") return ["COMPANION", "SENTINEL", "BEAST"];
    var it = trouveItem(slotId);
    // v97 — les griffes d'une bête ne prennent QUE les mods de griffes (Mâchoire, Morsure…)
    if (slotId === "armecomp") return it && it.cat === "Claws" ? ["Claws"] : ["Robotic", "Rifle"];
    if (!it) return [];
    if (it.cat === "Primary") return (it.type === "Shotgun" ? ["Shotgun"] : ["Rifle", "Sniper"]).concat(["PRIMARY"]);
    if (it.cat === "Secondary") return ["Pistol", "SECONDARY"];
    return ["Melee", "MELEE"];
  }
  function pickMod(slotId, i) {
    var it = trouveItem(slotId), eq = eqDe(slotId);
    var compats = compatPour(slotId, i);
    // Règle du jeu : ni deux fois le même mod, ni un mod ET sa variante
    // (Prime / Umbra / Archonte / Amalgame partagent la même « famille »).
    var dejaRefs = (eq.mods.slots || []).concat([eq.mods.exilus, eq.mods.aura, eq.mods.aura2])
      .map(refDe).filter(Boolean)
      .filter(function (r) { return r.un !== (refDe(i === "aura" ? eq.mods.aura : i === "aura2" ? eq.mods.aura2 : i === "st" ? eq.mods.st : i === "x" ? eq.mods.exilus : eq.mods.slots[Number(i)]) || {}).un || false; });
    var dejaUn = {}, dejaFam = {};
    dejaRefs.forEach(function (r) {
      dejaUn[r.un] = 1;
      var mm = modParUn(r.un);
      if (mm && mm.fam) dejaFam[mm.fam] = mm.n;
    });
    var liste = D.mods.filter(function (m) {
      // v48 : postures filtrées sur la CLASSE de l'arme (Nikana, Polearm…),
      // comme dans le jeu. Classe inconnue (composant de Zaw) → tout est montré.
      if (i === "st") return !!m.st && postureVaAvec(m, classeArme(slotId));
      if (m.st) return false;
      if (compats.indexOf(m.c) === -1) return false;
      if (estAura(i) ? m.c !== "AURA" : m.c === "AURA") return false;
      if (i === "x" && slotId === "frame" && !m.u && m.c === "WARFRAME") return false; // exilus : mods utilitaires
      if (dejaUn[m.un]) return false;
      if (m.fam && dejaFam[m.fam]) return false; // variante d'un mod déjà équipé
      return true;
    });
    var pol = polDe(slotId, it, eq, i);
    var clsA = classeArme(slotId);
    ouvrePicker(i === "st"
      ? (clsA ? T("Posture — ", "Stance — ") + esc(clsA)
              : T("Posture — classe de l'arme inconnue, toutes affichées", "Stance — unknown weapon class, all shown"))
      : "Mod — " + (i === "aura" ? "Aura" : i === "aura2" ? "Aura 2" : i === "x" ? "Exilus" : T("emplacement ", "slot ") + (Number(i) + 1)),
      [{ n: T("(retirer)", "(remove)"), un: "" }].concat(liste),
      function (m) {
        if (!m.un) return '<button class="ars-pk-it" data-un=""><b>' + esc(m.n) + "</b></button>";
        var d = (estAura(i) || i === "st") ? "+" + bonusAura(m, pol, null) : drainDansSlot(m, pol, null);
        var cls = m.st ? " · " + (classePosture(m) || m.c) + etiquettePosture(m, slotId) : "";
        return '<button class="ars-pk-it r-' + (RARETE[m.r] || "com") + '" data-un="' + esc(m.un) + '">' + imgHtml(m, "ars-pk-img") +
          '<span class="ars-pk-txt"><b>' + esc(m.n) + "</b>" +
          '<span class="muted">' + esc((m.tx || []).join(" · ").slice(0, 90)) + "</span></span>" +
          '<span class="ars-pk-d">' + polSvg(m.pol) + " " + d + esc(cls) + (m.fx || m.st ? "" : T(" · non simulé", " · not simulated")) + "</span></button>";
      },
      function (un) {
        var ref = un ? { un: un, rk: null } : null;
        if (i === "aura") eq.mods.aura = ref;
    else if (i === "aura2") eq.mods.aura2 = ref;
        else if (i === "st") eq.mods.st = ref;
        else if (i === "x") eq.mods.exilus = ref;
        else eq.mods.slots[Number(i)] = ref;
        sauve(); rendTout();
      });
  }
  function pickFrag(k) {
    var eq = eqDe("frame");
    var liste = [{ n: T("(retirer)", "(remove)"), un: "" }];
    FRAGS.forEach(function (col, ci) {
      col.buffs.forEach(function (bf, bi) {
        [false, true].forEach(function (tau) {
          var v = tau ? Math.round(bf.v * 1.5 * 10) / 10 : bf.v;
          liste.push({ n: col.c + (tau ? T(" Tauforgé", " Tauforged") : "") + " — " + bf.t.replace("{v}", v),
            un: ci + ":" + bi + ":" + (tau ? 1 : 0), coul: col.coul, sim: !!bf.fx });
        });
      });
    });
    ouvrePicker(T("Fragment d'Archon ", "Archon Shard ") + (k + 1), liste, function (x) {
      if (!x.un) return '<button class="ars-pk-it" data-un=""><b>' + esc(x.n) + "</b></button>";
      return '<button class="ars-pk-it" data-un="' + esc(x.un) + '"><span class="ars-pk-txt"><b>' +
        '<i class="ars-frag-dot" style="background:' + x.coul + '"></i>' + esc(x.n) + "</b>" +
        (x.sim ? "" : '<span class="muted">' + T("affiché en texte — non additionné aux stats", "shown as text — not added to the stats") + "</span>") + "</span></button>";
    }, function (un) {
      if (!un) eq.frags[k] = null;
      else {
        var p = un.split(":");
        eq.frags[k] = { c: Number(p[0]), b: Number(p[1]), tau: p[2] === "1" };
      }
      sauve(); rendTout();
    });
  }
  function pickArcane(k) {
    var eq = eqDe("frame");
    ouvrePicker("Arcane " + (k + 1), [{ n: T("(retirer)", "(remove)"), un: "" }].concat(D.arcanes), function (a) {
      return '<button class="ars-pk-it" data-un="' + esc(a.un || "") + '"><b>' + esc(a.n) + "</b>" +
        (a.tx ? '<span class="muted">' + esc(a.tx.join(" · ").slice(0, 100)) + "</span>" : "") + "</button>";
    }, function (un) { eq.arcanes[k] = un || null; sauve(); rendTout(); });
  }
  function pickArcaneArme(slotId) {
    var eq = eqDe(slotId);
    var cls = slotId === "primaire" ? "Primary" : slotId === "secondaire" ? "Secondary" : "Melee";
    var liste = [{ n: T("(retirer)", "(remove)"), un: "" }]
      .concat((D.arcArmes || []).filter(function (a) { return a.cls === cls; }));
    ouvrePicker(T("Arcane d'arme — ", "Weapon arcane — ") + cls, liste, function (a) {
      return '<button class="ars-pk-it" data-un="' + esc(a.un || "") + '"><b>' + esc(a.n) + "</b>" +
        (a.tx ? '<span class="muted">' + esc(a.tx.join(" · ").slice(0, 120)) + "</span>" : "") +
        (a.fx ? '<span class="ars-pk-d">' + T("simulable aux stacks max", "simulated at max stacks") + "</span>" : "") +
        "</button>";
    }, function (un) { eq.arcanes[0] = un || null; sauve(); rendTout(); });
  }

  /* --------------------- Collection basse (v5, façon jeu) --------------------- */
  // Clic sur une case → elle devient la CIBLE (surbrillance) et la collection en bas
  // liste ce qui est équipable dedans (recherche, filtres de polarité, tri) ; clic sur
  // une carte de la collection → équipée dans la case ciblée. Comme l'écran du jeu.
  var cible = null, collQ = "", collPol = null, collTri = "drain", collFx = null; // collFx = {cles:[...], nom:"Perforation"}
  function normalize(x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  var coll = document.getElementById("ars-coll");
  function listePour(slotId, i) {
    var it = trouveItem(slotId), eq = eqDe(slotId);
    var compats = compatPour(slotId, i);
    var dejaUn = {}, dejaFam = {};
    (eq.mods.slots || []).concat([eq.mods.exilus, eq.mods.aura, eq.mods.aura2, eq.mods.st]).map(refDe).filter(Boolean)
      .forEach(function (r) {
        dejaUn[r.un] = 1;
        var mm = modParUn(r.un);
        if (mm && mm.fam) dejaFam[mm.fam] = 1;
      });
    return D.mods.filter(function (m) {
      if (i === "st") { if (!m.st || !postureVaAvec(m, classeArme(slotId))) return false; }
      else {
        if (m.st) return false;
        if (compats.indexOf(m.c) === -1) return false;
        if (estAura(i) ? m.c !== "AURA" : m.c === "AURA") return false;
        if (i === "x" && slotId === "frame" && !m.u && m.c === "WARFRAME") return false;
      }
      if (dejaUn[m.un]) return false;
      if (m.fam && dejaFam[m.fam]) return false;
      return true;
    });
  }
  function rendColl() {
    // v29 (17/07/2026, demande de l'admin) : comme dans le jeu — dès qu'un équipement
    // est affiché, la collection des mods COMPATIBLES apparaît en bas SANS
    // cliquer d'emplacement (mode « équipement » : clic = premier emplacement
    // libre, glisser = l'emplacement de ton choix). Cliquer un emplacement
    // précis resserre le filtre (mode « ciblé », comportement historique).
    var slotId, i, modeEquip = false;
    if (cible) { slotId = cible.slot; i = cible.i; }
    else {
      slotId = etat.sel; i = 0; modeEquip = true; // filtres des emplacements normaux
      if (/^exalte/.test(slotId) === false && !trouveItem(slotId)) { coll.hidden = true; return; }
    }
    var it = trouveItem(slotId);
    if (!it) { coll.hidden = true; return; }
    var pol = modeEquip ? "none" : polDe(slotId, it, eqDe(slotId), i);
    var l = listePour(slotId, i).filter(function (m) {
      if (collQ && normalize(m.n).indexOf(normalize(collQ)) === -1 && normalize(m.en || "").indexOf(normalize(collQ)) === -1) return false;
      if (collPol && m.pol !== collPol) return false;
      // v29 : filtre par statistique cliquée — seulement les mods SIMULÉS qui
      // touchent cette stat (fx contient une des clés)
      if (collFx && !(m.fx && collFx.cles.some(function (k) { return m.fx[k]; }))) return false;
      return true;
    });
    l.sort(collTri === "nom"
      ? function (a, b) { return nomMod(a).localeCompare(nomMod(b), EST_EN ? "en" : "fr"); }
      : function (a, b) { return drainMod(b, null) - drainMod(a, null) || a.n.localeCompare(b.n, "fr"); });
    var pols = ["madurai", "vazarin", "naramon", "zenurik", "unairu", "penjaga"];
    var lbl = i === "aura" ? "Aura" : i === "aura2" ? "Aura 2" : i === "st" ? T("Posture", "Stance") : i === "x" ? "Exilus" : T("emplacement ", "slot ") + (Number(i) + 1);
    coll.hidden = false;
    coll.innerHTML =
      (modeEquip
        ? '<p class="ars-coll-tt">Collection — <b>' + T("mods compatibles", "compatible mods") + "</b> " + T("de", "of") + " " + esc(it.n) +
          ' <span class="muted">· ' + T("clic = premier emplacement libre · glisser = l'emplacement voulu", "click = first free slot · drag = the slot you want") + "</span></p>"
        : '<p class="ars-coll-tt">Collection — <b>' + esc(lbl) + "</b> " + T("de", "of") + " " + esc(it.n) +
          (i === "st" ? (classeArme(slotId)
            ? " · " + esc(classeArme(slotId))
            : T(" · classe inconnue : toutes les postures", " · unknown class: all stances")) : "") + "</p>") +
      '<div class="ars-coll-top"><input type="search" id="ars-coll-q" placeholder="' + T("Recherche…", "Search…") + '" aria-label="' + T("Rechercher un mod", "Search a mod") + '" value="' + esc(collQ) + '">' +
      '<span class="ars-polf">' + pols.map(function (p) {
        return '<button data-pol="' + p + '"' + (collPol === p ? ' class="on"' : "") + ' title="' + p + '">' + polSvg(p) + "</button>";
      }).join("") + "</span>" +
      '<select class="ars-tri" id="ars-coll-tri" aria-label="' + T("Trier", "Sort") + '"><option value="drain"' + (collTri === "drain" ? " selected" : "") + '>Drain</option><option value="nom"' + (collTri === "nom" ? " selected" : "") + ">" + T("Nom", "Name") + "</option></select>" +
      (collFx ? '<button class="ars-tri" id="ars-coll-fx-x" title="' + T("Retirer le filtre de statistique", "Remove the stat filter") + '">' + esc(collFx.nom) + ' ×</button>' : "") +
      (modeEquip ? "" : '<button class="ars-tri" id="ars-coll-x">' + T("Tout l'équipement", "Whole equipment") + "</button>") + "</div>" +
      (l.length ? '<div class="ars-coll-grid">' + l.slice(0, 120).map(function (m) {
        var d = (estAura(i) || i === "st") ? "+" + bonusAura(m, pol, null) : drainDansSlot(m, pol, null);
        // mods simulés : libellés localisés (FX_FR/EN) au rang max ; sinon texte source
        var fxColl = m.st ? (etiquettePosture(m, slotId).replace(/^ · /, "") ||
                             T("combos non chiffrés", "combos not quantified"))
          : m.fx ? texteFx(fxAt(m, rangMax(m)) || m.fx) : esc((m.tx || []).join(" · "));
        return '<button class="ars-mod v24 r-' + (RARETE[m.r] || "com") + '" data-equipe="' + esc(m.un) + '" title="' + esc((m.tx || []).join(" · ")) + '">' +
          '<span class="ars-mod-d">' + d + " " + polSvg(m.pol) + "</span>" +
          '<span class="ars-mod-art">' + imgHtml(m, "ars-mod-img") + "</span>" +
          '<span class="ars-mod-corps-c"><span class="ars-mod-n">' + esc(nomMod(m)) +
          (m.st ? ' <small class="muted">' + esc(classePosture(m) || m.c) + "</small>" : "") + "</span>" +
          '<span class="ars-mod-fx">' + fxColl + "</span></span></button>";
      }).join("") + "</div>" : '<p class="ars-coll-vide">' + T("Aucun mod ne correspond.", "No matching mod.") + "</p>");
    var q = document.getElementById("ars-coll-q");
    q.addEventListener("input", function () { collQ = q.value; rendColl(); });
    document.getElementById("ars-coll-tri").addEventListener("change", function (e) { collTri = e.target.value; rendColl(); });
    var bx = document.getElementById("ars-coll-x");
    if (bx) bx.addEventListener("click", function () { cible = null; rendTout(); });
    var bfx = document.getElementById("ars-coll-fx-x");
    if (bfx) bfx.addEventListener("click", function () { collFx = null; rendColl(); });
  }
  function equipe(un) {
    var ref = un ? { un: un, rk: null } : null;
    if (!cible) {
      // mode « équipement » : le mod part dans le PREMIER emplacement libre
      // (comme un clic dans la collection du jeu) ; complet → on le dit.
      var eq0 = eqDe(etat.sel);
      var libre = -1;
      for (var s = 0; s < 8; s++) if (!refDe(eq0.mods.slots[s])) { libre = s; break; }
      if (libre === -1) { alert(T("Les 8 emplacements sont pleins — glisse la carte sur l'emplacement à remplacer.", "All 8 slots are full — drag the card onto the slot to replace.")); return; }
      eq0.mods.slots[libre] = ref;
      sauve(); rendTout();
      return;
    }
    var eq = eqDe(cible.slot), i = cible.i;
    if (i === "aura") eq.mods.aura = ref;
    else if (i === "aura2") eq.mods.aura2 = ref;
    else if (i === "st") eq.mods.st = ref;
    else if (i === "x") eq.mods.exilus = ref;
    else eq.mods.slots[Number(i)] = ref;
    cible = null; collQ = ""; collPol = null;
    sauve(); rendTout();
  }
  coll.addEventListener("click", function (e) {
    var b = e.target.closest("[data-equipe]");
    if (b) equipe(b.getAttribute("data-equipe"));
    var pf = e.target.closest("[data-pol]");
    if (pf) { collPol = collPol === pf.getAttribute("data-pol") ? null : pf.getAttribute("data-pol"); rendColl(); }
  });

  /* ---- GLISSER-DÉPOSER (17/07/2026) — comme dans le jeu -------------------
     · collection → emplacement : équipe (compatibilité + règle des variantes
       vérifiées — jamais deux mods de la même famille) ;
     · emplacement → emplacement : déplace ou ÉCHANGE (l'ordre des emplacements
       compte pour les combinaisons d'éléments — le jeu permet ce réordonnage) ;
     · emplacement → collection : retire le mod.
     Les FORMAS restent liés à l'emplacement physique (règle du jeu). Souris
     seulement (HTML5 DnD) — au doigt, le parcours par clic reste inchangé. */
  function litRef(eq, i) { return i === "aura" ? eq.mods.aura : i === "aura2" ? eq.mods.aura2 : i === "st" ? eq.mods.st : i === "x" ? eq.mods.exilus : eq.mods.slots[Number(i)]; }
  function poseRef(eq, i, ref) {
    if (i === "aura") eq.mods.aura = ref;
    else if (i === "aura2") eq.mods.aura2 = ref;
    else if (i === "st") eq.mods.st = ref;
    else if (i === "x") eq.mods.exilus = ref;
    else eq.mods.slots[Number(i)] = ref;
  }
  // Un emplacement i accepte-t-il ce mod ? (mêmes règles que les sélecteurs)
  function accepte(slotId, i, un) {
    var m = modParUn(un);
    if (!m) return false;
    if (i === "st") return !!m.st;
    if (m.st) return false;
    var compats = compatPour(slotId, i);
    if (compats.indexOf(m.c) === -1) return false;
    if (estAura(i) ? m.c !== "AURA" : m.c === "AURA") return false;
    if (i === "x" && slotId === "frame" && !m.u && m.c === "WARFRAME") return false;
    return true;
  }
  // Le mod (ou sa famille Prime/Umbra/…) est-il déjà équipé ailleurs que saufI ?
  function dejaAilleurs(slotId, saufI, m) {
    var eq = eqDe(slotId);
    var paires = [["aura", eq.mods.aura], ["aura2", eq.mods.aura2], ["st", eq.mods.st], ["x", eq.mods.exilus]]
      .concat((eq.mods.slots || []).map(function (x, k) { return [k, x]; }));
    return paires.some(function (p) {
      if (String(p[0]) === String(saufI)) return false;
      var r = refDe(p[1]);
      if (!r) return false;
      if (r.un === m.un) return true;
      var mm = modParUn(r.un);
      return !!(m.fam && mm && mm.fam === m.fam);
    });
  }
  /* Drag MAISON par pointer events (17/07/2026) : le DnD HTML5 natif ne se
     déclenche pas de façon fiable (vérifié en vrai Chrome piloté) — on trace
     nous-mêmes : seuil 7 px pour préserver le clic, fantôme qui suit la souris,
     surbrillance des cibles valides, Échap pour annuler. Souris uniquement —
     au doigt, le parcours par clic reste inchangé (le défilement prime). */
  var dragEtat = null, dragDepart = null, dragActif = false, dragGhost = null, supprimeClic = false;
  function dropOk(cible2) {
    if (!dragEtat) return false;
    var slotId = etat.sel;
    if (dragEtat.t === "coll") {
      var m = modParUn(dragEtat.un);
      return !!m && accepte(slotId, cible2, dragEtat.un) && !dejaAilleurs(slotId, cible2, m);
    }
    if (String(dragEtat.i) === String(cible2)) return false;
    var eq = eqDe(slotId);
    var rA = refDe(litRef(eq, dragEtat.i));
    if (!rA || !accepte(slotId, cible2, rA.un)) return false;
    var rB = refDe(litRef(eq, cible2));
    return !rB || accepte(slotId, dragEtat.i, rB.un); // échange : l'autre doit rentrer aussi
  }
  function nettoieDrag() {
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    root.querySelectorAll(".dragging,.dragsur").forEach(function (el) { el.classList.remove("dragging", "dragsur"); });
    coll.classList.remove("dragsur");
    dragEtat = null; dragDepart = null; dragActif = false;
  }
  root.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 || e.pointerType !== "mouse") return;
    var g = e.target.closest ? e.target.closest("[data-drag]") : null;
    var c = e.target.closest ? e.target.closest("#ars-coll [data-equipe]") : null;
    if (!g && !c) return;
    dragDepart = { x: e.clientX, y: e.clientY, el: g || c,
      etat: g ? { t: "slot", i: g.getAttribute("data-drag") } : { t: "coll", un: c.getAttribute("data-equipe") } };
  });
  document.addEventListener("pointermove", function (e) {
    if (!dragDepart) return;
    if (!dragActif) {
      if (Math.hypot(e.clientX - dragDepart.x, e.clientY - dragDepart.y) < 7) return;
      dragActif = true;
      dragEtat = dragDepart.etat;
      supprimeClic = true;
      dragDepart.el.classList.add("dragging");
      dragGhost = dragDepart.el.cloneNode(true);
      dragGhost.classList.add("ars-ghost");
      dragGhost.classList.remove("dragging");
      dragGhost.style.width = dragDepart.el.offsetWidth + "px";
      dragGhost.style.height = dragDepart.el.offsetHeight + "px";
      document.body.appendChild(dragGhost);
    }
    dragGhost.style.transform = "translate(" + (e.clientX + 12) + "px," + (e.clientY + 10) + "px)";
    var sous = document.elementFromPoint(e.clientX, e.clientY); // le fantôme est pointer-events:none
    root.querySelectorAll(".dragsur").forEach(function (el) { el.classList.remove("dragsur"); });
    coll.classList.remove("dragsur");
    var kase = sous && sous.closest ? sous.closest("#ars-mods .ars-case") : null;
    if (kase && dropOk(kase.getAttribute("data-i"))) kase.classList.add("dragsur");
    else if (dragEtat.t === "slot" && sous && sous.closest && sous.closest("#ars-coll")) coll.classList.add("dragsur");
  });
  document.addEventListener("pointerup", function (e) {
    if (!dragDepart) return;
    var actif = dragActif, de = dragEtat;
    // Robustesse : certains pilotages (CDP, automatisation) sautent les
    // pointermove — si le relâchement est loin du point de départ, c'est un
    // glisser quand même (un humain qui glisse émet toujours des move : ce
    // repli ne change rien pour lui).
    if (!actif && Math.hypot(e.clientX - dragDepart.x, e.clientY - dragDepart.y) >= 7) {
      actif = true;
      de = dragDepart.etat;
      supprimeClic = true;
    }
    var sous = actif ? document.elementFromPoint(e.clientX, e.clientY) : null;
    nettoieDrag();
    // si le relâchement a lieu sur un AUTRE élément que l'appui, aucun « click »
    // ne suivra : désarmer la suppression pour ne pas manger le clic suivant.
    if (supprimeClic) setTimeout(function () { supprimeClic = false; }, 0);
    if (!actif || !sous) return;
    var slotId = etat.sel;
    dragEtat = de; // le temps de la validation
    var kase = sous.closest ? sous.closest("#ars-mods .ars-case") : null;
    if (kase && dropOk(kase.getAttribute("data-i"))) {
      var i2 = kase.getAttribute("data-i"), eq = eqDe(slotId);
      if (de.t === "coll") poseRef(eq, i2, { un: de.un, rk: null });
      else { // déplacement / échange — l'ordre des éléments suit, comme en jeu
        var a = litRef(eq, de.i), b = litRef(eq, i2);
        poseRef(eq, i2, a);
        poseRef(eq, de.i, b || null);
      }
      dragEtat = null;
      sauve(); rendTout();
      return;
    }
    dragEtat = null;
    if (de.t === "slot" && sous.closest && sous.closest("#ars-coll")) {
      poseRef(eqDe(slotId), de.i, null); // relâché dans la collection = retiré
      sauve(); rendTout();
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dragActif) nettoieDrag(); });
  // un glisser consommé ne doit pas déclencher le clic du relâchement
  root.addEventListener("click", function (e) {
    if (supprimeClic) { supprimeClic = false; e.stopPropagation(); e.preventDefault(); }
  }, true);

  /* ---- Export en image (17/07/2026) : carte 1200×630 dessinée en canvas —
     typographie et décor 100 % originaux (pas d'images externes : le CDN ne
     fournit pas de CORS, un canvas « souillé » serait inexportable). ---- */
  function exporteImage() {
    var it = trouveItem(etat.sel);
    if (!it) { alert(T("Équipe d'abord quelque chose à exporter.", "Equip something to export first.")); return; }
    var eq = eqDe(etat.sel);
    var cv = document.createElement("canvas");
    cv.width = 1200; cv.height = 630;
    var g = cv.getContext("2d");
    // fond
    var grad = g.createLinearGradient(0, 0, 0, 630);
    grad.addColorStop(0, "#131a26"); grad.addColorStop(1, "#070a10");
    g.fillStyle = grad; g.fillRect(0, 0, 1200, 630);
    var halo = g.createRadialGradient(600, -80, 60, 600, -80, 700);
    halo.addColorStop(0, "rgba(212,175,55,.22)"); halo.addColorStop(1, "transparent");
    g.fillStyle = halo; g.fillRect(0, 0, 1200, 630);
    // équerres dorées
    g.strokeStyle = "#d4af37"; g.lineWidth = 3;
    [[24,24,1],[1176,606,-1]].forEach(function (c) {
      g.beginPath(); g.moveTo(c[0], c[1] + 26 * c[2]); g.lineTo(c[0], c[1]); g.lineTo(c[0] + 26 * c[2], c[1]); g.stroke();
    });
    // en-tête
    g.fillStyle = "#e8c95c"; g.font = "600 22px Oswald, sans-serif";
    g.fillText("A R S E N A L   V O I D R E L A Y", 60, 70);
    g.fillStyle = "#e8edf6"; g.font = "700 54px Oswald, sans-serif";
    g.fillText(it.n.toUpperCase().slice(0, 30), 60, 130);
    g.strokeStyle = "#232c3d"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(60, 150); g.lineTo(1140, 150); g.stroke();
    // stats clés (gauche)
    g.font = "400 24px Inter, sans-serif";
    var lignes = [];
    if (etat.sel === "frame") {
      var st = statsFrame(it, eq);
      lignes = [[T("Santé", "Health"), st.hp], [T("Bouclier", "Shield"), st.sh], [T("Armure", "Armor"), st.ar], [T("Énergie", "Energy"), st.en],
        [T("PV effectifs", "Effective HP"), Math.round(st.hp * (1 + st.ar / 300))],
        [T("Puissance", "Strength"), st.str + " %"], [T("Durée", "Duration"), st.dur + " %"], [T("Portée", "Range"), st.rng + " %"], [T("Efficacité", "Efficiency"), st.eff + " %"]];
    } else if (etat.sel !== "compagnon") {
      var sa = statsArme(it, eq);
      lignes = [[T("Dégâts / coup", "Damage / shot"), sa.tot], [T("Critique", "Critical"), sa.cc + " % ×" + sa.cm], [T("Statut", "Status"), sa.sc + " %"],
        ["Multishot", sa.ms], [T("DPS rafale", "Burst DPS"), sa.burst], [T("DPS soutenu", "Sustained DPS"), sa.sout]];
    } else {
      lignes = [[T("Santé", "Health"), it.hp], [T("Bouclier", "Shield"), it.sh], [T("Armure", "Armor"), it.ar]];
    }
    lignes.forEach(function (l, i) {
      var y = 200 + i * 40;
      g.fillStyle = "#8fa0b8"; g.fillText(String(l[0]), 60, y);
      g.fillStyle = "#e8c95c"; g.font = "700 24px Inter, sans-serif";
      g.fillText(String(l[1]), 320, y);
      g.font = "400 24px Inter, sans-serif";
    });
    // mods (droite) : nom + rang + polarité/drain
    var refs = [["Aura", eq.mods.aura], ["Aura 2", eq.mods.aura2], [T("Posture", "Stance"), eq.mods.st], ["Exilus", eq.mods.exilus]]
      .concat((eq.mods.slots || []).map(function (x, i) { return ["Mod " + (i + 1), x]; }))
      .map(function (p) { var r = refDe(p[1]); return r ? [p[0], r] : null; })
      .filter(Boolean);
    g.fillStyle = "#e8c95c"; g.font = "600 20px Oswald, sans-serif";
    g.fillText("M O D S", 620, 190);
    refs.slice(0, 11).forEach(function (p, i) {
      var m = modParUn(p[1].un);
      if (!m) return;
      var y = 222 + i * 34;
      g.fillStyle = "#8fa0b8"; g.font = "400 18px Inter, sans-serif";
      g.fillText(p[0], 620, y);
      g.fillStyle = "#e8edf6"; g.font = "600 20px Inter, sans-serif";
      g.fillText(nomMod(m).slice(0, 34) + (m.lvs ? "  r" + rangDe(p[1], m) : ""), 720, y);
      g.fillStyle = "#e8c95c"; g.font = "700 18px Inter, sans-serif";
      g.fillText(POL_ICO[m.pol] || "·", 1120, y);
    });
    if (!refs.length) {
      g.fillStyle = "#8fa0b8"; g.font = "400 20px Inter, sans-serif";
      g.fillText(T("Aucun mod équipé", "No mod equipped"), 620, 230);
    }
    // capacité + pied
    var cap = capacite(etat.sel, it, eq);
    g.fillStyle = cap.used > cap.total ? "#f87171" : "#4ade80";
    g.font = "700 22px Oswald, sans-serif";
    g.fillText(T("CAPACITÉ ", "CAPACITY ") + cap.used + " / " + cap.total, 60, 580);
    g.fillStyle = "#8fa0b8"; g.font = "400 20px Inter, sans-serif";
    g.fillText(T("voidrelay.fr/arsenal — simulateur d'Arsenal gratuit", "voidrelay.fr/en/arsenal — free Arsenal simulator"), 620, 580);
    cv.toBlob(function (blob) {
      if (!blob) { alert(T("Export impossible dans ce navigateur.", "Export not possible in this browser.")); return; }
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "build-voidrelay-" + normalize(it.n).replace(/[^a-z0-9]+/g, "-") + ".png";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }, "image/png");
  }
  var btnImg = document.getElementById("ars-image");
  if (btnImg) btnImg.addEventListener("click", function () {
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(exporteImage);
  });

  /* ---- Copie robuste (17/07/2026) : clipboard refusé (permissions, vieux
     navigateur, iframe) → repli honnête par prompt, JAMAIS d'erreur JS. ---- */
  function copie(texte, btn, okTxt, defTxt) {
    var fini = function () {
      if (!btn) return;
      btn.textContent = okTxt;
      setTimeout(function () { btn.textContent = defTxt; }, 1800);
    };
    var repli = function () {
      try { window.prompt(T("Copie impossible automatiquement — sélectionne et copie :", "Automatic copy failed — select and copy:"), texte); } catch (e) {}
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texte).then(fini, repli);
      } else repli();
    } catch (e) { repli(); }
  }

  /* ---- RIVEN PERSONNALISÉ (17/07/2026, carte blanche de l'admin) ----------------
     Le joueur saisit les stats de SON riven (telles qu'affichées en jeu — la
     disposition y est déjà comprise) : il devient un mod synthétique injecté
     dans la base, la machinerie existante (drain, polarités, capacité, drag,
     partage, hors-ligne) le traite comme n'importe quel mod. Un riven par
     arme (règle du jeu) ; changer d'arme dans l'emplacement le retire avec
     elle (le riven appartient à l'arme). Honnêteté : uniquement des stats
     SIMULÉES par le moteur — jamais de chiffre inventé par nous. */
  var RIVEN_STATS = [
    ["dmg", T("Dégâts", "Damage")], ["ms", "Multishot"], ["cc", T("Chance critique", "Critical chance")],
    ["cm", T("Dégâts critiques", "Critical damage")], ["sc", T("Chance de statut", "Status chance")],
    ["fr", T("Cadence / vitesse d'attaque", "Fire rate / attack speed")], ["mag", T("Chargeur", "Magazine")],
    ["rel", T("Rechargement", "Reload")], ["e_heat", T("Chaleur", "Heat")], ["e_cold", T("Froid", "Cold")],
    ["e_electricity", T("Électricité", "Electricity")], ["e_toxin", T("Toxine", "Toxin")],
    ["p_impact", "Impact"], ["p_puncture", T("Perforation", "Puncture")], ["p_slash", T("Tranchant", "Slash")],
  ];
  function rivenUn(slotId) { return "riven::" + slotId; }
  // Synchronise D.mods avec les rivens de l'état (idempotent, appelé à chaque rendu).
  function majRivens() {
    if (!D.mods) return;
    ["primaire", "secondaire", "melee"].forEach(function (slotId) {
      var un = rivenUn(slotId);
      var idx = D.mods.findIndex(function (m) { return m.un === un; });
      var eq = etat.equip[slotId];
      var rv = eq && eq.riven;
      var it = trouveItem(slotId);
      if (!rv || !it) {
        if (idx !== -1) D.mods.splice(idx, 1);
        // retirer aussi la référence orpheline des emplacements
        if (eq && eq.mods && (eq.mods.slots || []).some(function (x) { return refDe(x) && refDe(x).un === un; })) {
          eq.mods.slots = eq.mods.slots.map(function (x) { return refDe(x) && refDe(x).un === un ? null : x; });
        }
        return;
      }
      var compats = compatPour(slotId, "0");
      var m = { n: rv.n, en: rv.n, un: un, pol: rv.pol || "madurai", img: null, fam: null, lvs: null,
        d0: rv.d0 || 18, fl: 0, c: compats[0], r: "Riven", u: false, aug: false,
        fx: rv.fx, full: rv.fx, tx: [texteFx(rv.fx)] };
      if (idx === -1) D.mods.push(m); else D.mods[idx] = m;
    });
  }
  function ouvreRiven(slotId) {
    var it = trouveItem(slotId);
    if (!it) return;
    var eq = eqDe(slotId);
    var rv = eq.riven || { n: it.n + " Riven", fx: {}, d0: 18, pol: "madurai" };
    var cles = Object.keys(rv.fx);
    picker.hidden = false;
    var rangs = [0, 1, 2, 3].map(function (k) {
      var cle = cles[k] || "", val = cle ? Math.round(rv.fx[cle] * 1000) / 10 : "";
      return '<p style="display:flex;gap:8px;align-items:center;margin:.35em 0">' +
        '<select class="ars-tri ars-rv-stat" style="flex:1">' +
        '<option value="">' + (k < 2 ? T("— stat ", "— stat ") + (k + 1) + " —" : k === 3 ? T("— malus (valeur négative) —", "— curse (negative value) —") : T("— stat 3 (optionnelle) —", "— stat 3 (optional) —")) + "</option>" +
        RIVEN_STATS.map(function (p) {
          return '<option value="' + p[0] + '"' + (p[0] === cle ? " selected" : "") + ">" + esc(p[1]) + "</option>";
        }).join("") + "</select>" +
        '<input class="ars-rv-val" type="number" step="0.1" min="-200" max="400" value="' + val + '" placeholder="%" style="width:6em;background:#0a0e16;border:1px solid var(--aline);color:var(--aink);padding:.4rem"> %</p>';
    }).join("");
    picker.innerHTML = '<div class="ars-pk-bd"></div><div class="ars-pk-box"><div class="ars-pk-top"><b>💜 Riven — ' + esc(it.n) +
      '</b><button class="ars-pk-x" aria-label="' + T("Fermer", "Close") + '">×</button></div>' +
      '<div class="ars-pk-liste" style="padding:12px">' +
      '<p style="margin:.2em 0"><input id="ars-rv-nom" type="text" value="' + esc(rv.n) + '" style="width:100%;background:#0a0e16;border:1px solid var(--aline);color:var(--aink);padding:.5rem" aria-label="' + T("Nom du riven", "Riven name") + '"></p>' +
      rangs +
      '<p style="display:flex;gap:12px;align-items:center;margin:.6em 0">' +
      '<label>Drain <input id="ars-rv-d" type="number" min="8" max="18" value="' + (rv.d0 || 18) + '" style="width:4.5em;background:#0a0e16;border:1px solid var(--aline);color:var(--aink);padding:.35rem"></label>' +
      '<label>' + T("Polarité ", "Polarity ") + '<select id="ars-rv-pol" class="ars-tri">' +
      ["madurai", "vazarin", "naramon", "zenurik"].map(function (p) {
        return '<option value="' + p + '"' + (p === (rv.pol || "madurai") ? " selected" : "") + ">" + POL_NOMS[p] + "</option>";
      }).join("") + "</select></label></p>" +
      '<p class="muted" style="font-size:.8rem">' +
      T("Saisis les valeurs telles qu'affichées sur TON riven en jeu (la disposition y est déjà comprise). Seules des stats simulées par le moteur sont proposées — les chiffres restent les tiens.",
        "Enter the values as shown on YOUR riven in game (disposition already included). Only engine-simulated stats are offered — the numbers stay yours.") + "</p>" +
      '<p style="display:flex;gap:8px;justify-content:flex-end">' +
      (eq.riven ? '<button class="ars-tri" id="ars-rv-del" style="color:#f87171">' + T("Supprimer", "Delete") + "</button>" : "") +
      '<button class="ars-tri" id="ars-rv-ok" style="padding:.6rem 1.2rem;color:var(--agold2);border-color:var(--agold)">' + T("Enregistrer", "Save") + "</button></p></div></div>";
    picker.querySelector(".ars-pk-bd").onclick = picker.querySelector(".ars-pk-x").onclick = function () { picker.hidden = true; };
    var del = document.getElementById("ars-rv-del");
    if (del) del.addEventListener("click", function () {
      delete eq.riven;
      picker.hidden = true;
      majRivens(); sauve(); rendTout();
    });
    document.getElementById("ars-rv-ok").addEventListener("click", function () {
      var fx = {};
      var stats = picker.querySelectorAll(".ars-rv-stat");
      var vals = picker.querySelectorAll(".ars-rv-val");
      for (var k = 0; k < stats.length; k++) {
        var cle = stats[k].value, v = parseFloat(vals[k].value);
        if (cle && isFinite(v) && v !== 0) fx[cle] = Math.max(-2, Math.min(4, v / 100));
      }
      if (!Object.keys(fx).length) { alert(T("Choisis au moins une stat avec une valeur.", "Pick at least one stat with a value.")); return; }
      eq.riven = {
        n: (document.getElementById("ars-rv-nom").value || it.n + " Riven").slice(0, 40),
        fx: fx,
        d0: Math.max(8, Math.min(18, Number(document.getElementById("ars-rv-d").value) || 18)),
        pol: document.getElementById("ars-rv-pol").value || "madurai",
      };
      picker.hidden = true;
      majRivens();
      // équipe dans le premier emplacement libre s'il n'est pas déjà posé
      var un = rivenUn(slotId);
      var deja = (eq.mods.slots || []).some(function (x) { return refDe(x) && refDe(x).un === un; });
      if (!deja) {
        for (var s2 = 0; s2 < 8; s2++) if (!refDe(eq.mods.slots[s2])) { eq.mods.slots[s2] = { un: un, rk: null }; break; }
      }
      sauve(); rendTout();
    });
  }

  /* ------------------------------ Événements ------------------------------ */
  function rendTout() {
    majRivens();
    rendLoadout(); rendModScreen(); rendStats(); rendColl();
    if (cible && cible.slot === etat.sel) {
      var c = document.querySelector('#ars-mods .ars-case[data-i="' + cible.i + '"]');
      if (c) c.classList.add("cible");
    }
  }
  document.getElementById("ars-loadout").addEventListener("click", function (e) {
    var dx = e.target.closest("[data-delslot]");
    if (dx) {
      e.stopPropagation();
      delete etat.equip[dx.getAttribute("data-delslot")];
      if (!trouveItem(etat.sel)) etat.sel = "frame";
      cible = null; sauve(); rendTout();
      return;
    }
    var b = e.target.closest("[data-slot]");
    if (!b) return;
    var id = b.getAttribute("data-slot");
    if (/^exalte/.test(id) || (trouveItem(id) && etat.sel !== id)) { etat.sel = id; sauve(); rendTout(); }
    else pickItem(id);
  });
  // Forma explicite (v23) : choisir LA polarité voulue ou enlever le forma —
  // fini le cycle aveugle sur une pastille (demande de l'admin, captures du jeu).
  var POL_NOMS = { madurai: "Madurai", vazarin: "Vazarin", naramon: "Naramon", zenurik: "Zenurik", unairu: "Unairu", penjaga: "Penjaga" };
  function ouvreForma(slotId, i) {
    var it = trouveItem(slotId), eq = eqDe(slotId);
    var cour = polDe(slotId, it, eq, i);
    var stock = (function () { var f = Object.assign({}, eq.formas); delete f[i]; return polDe(slotId, it, Object.assign({}, eq, { formas: f }), i); })();
    var liste = [{ un: "", n: T("(enlever le forma — polarité d'origine : ", "(remove forma — original polarity: ") + (POL_ICO[stock] || T("aucune", "none")) + ")" }]
      .concat(Object.keys(POL_NOMS).map(function (p) {
        return { un: p, n: POL_ICO[p] + "  " + POL_NOMS[p] + (p === cour ? T(" — actuelle", " — current") : "") };
      }))
      // Forma Umbra : existe en jeu (très rare) — proposé aussi, honnêtement nommé.
      .concat([{ un: "umbra", n: POL_ICO.umbra + "  Umbra (" + T("Forma Umbra — très rare en jeu", "Umbra Forma — very rare in game") + ")" + (cour === "umbra" ? T(" — actuelle", " — current") : "") }]);
    var ou = i === "aura" ? "Aura" : i === "aura2" ? "Aura 2" : i === "st" ? T("Posture", "Stance") : i === "x" ? "Exilus" : T("emplacement ", "slot ") + (Number(i) + 1);
    ouvrePicker(T("Forma — ", "Forma — ") + ou, liste, function (x) {
      return '<button class="ars-pk-it" data-un="' + esc(x.un) + '"><b>' + esc(x.n) + "</b></button>";
    }, function (un) {
      if (!un || un === stock) delete eq.formas[i];
      else eq.formas[i] = un;
      sauve(); rendTout();
    });
  }
  // v51 : <select> et <input number> émettent « change », pas « click ».
  document.getElementById("ars-mods").addEventListener("change", function (e) {
    if (e.target.id === "ars-combo") { etat.combo = Number(e.target.value) || 1; sauve(); rendStats(); return; }
    if (e.target.id === "ars-statuts") { etat.statuts = Math.max(0, Math.min(10, Number(e.target.value) || 0)); sauve(); rendStats(); }
  });
  document.getElementById("ars-mods").addEventListener("click", function (e) {
    var fchip = e.target.closest(".ars-forma");
    if (fchip) { ouvreForma(etat.sel, fchip.getAttribute("data-fslot")); return; }
    if (e.target.closest("#ars-reacteur")) { etat.reacteur = !!e.target.closest("#ars-reacteur").checked; sauve(); rendTout(); return; }
    if (e.target.closest("#ars-arcmax")) { etat.arcmax = !!e.target.closest("#ars-arcmax").checked; sauve(); rendTout(); return; }
    if (e.target.closest("#ars-galvmax")) { etat.galvmax = !!e.target.closest("#ars-galvmax").checked; sauve(); rendTout(); return; }

    var cfg = e.target.closest("[data-cfg]");
    if (cfg) { basculeCfg(etat.sel, Number(cfg.getAttribute("data-cfg"))); return; }
    var fg = e.target.closest(".ars-fragbtn");
    if (fg) { pickFrag(Number(fg.getAttribute("data-frag"))); return; }
    var arc = e.target.closest(".ars-arcbtn");
    if (arc) {
      if (arc.hasAttribute("data-riven")) ouvreRiven(etat.sel);
      else if (arc.hasAttribute("data-arcarme")) pickArcaneArme(etat.sel);
      else pickArcane(Number(arc.getAttribute("data-k")));
      return;
    }
    var rkb = e.target.closest(".ars-rk-btn");
    if (rkb) { // régler le niveau du mod (comme dans le jeu)
      var i2 = rkb.getAttribute("data-i"), eq2 = eqDe(etat.sel);
      var lire = function () { return i2 === "aura" ? eq2.mods.aura : i2 === "aura2" ? eq2.mods.aura2 : i2 === "x" ? eq2.mods.exilus : eq2.mods.slots[Number(i2)]; };
      var ref2 = refDe(lire());
      if (ref2) {
        var m2 = modParUn(ref2.un);
        if (m2) {
          var nv = rangDe(ref2, m2) + Number(rkb.getAttribute("data-rk"));
          ref2.rk = Math.max(0, Math.min(nv, rangMax(m2)));
          if (i2 === "aura") eq2.mods.aura = ref2;
          else if (i2 === "aura2") eq2.mods.aura2 = ref2;
          else if (i2 === "st") eq2.mods.st = ref2;
          else if (i2 === "x") eq2.mods.exilus = ref2;
          else eq2.mods.slots[Number(i2)] = ref2;
          sauve(); rendTout();
        }
      }
      return;
    }
    var del = e.target.closest("[data-del]");
    if (del) { // retirer en un clic
      var i3 = del.getAttribute("data-del"), eq3 = eqDe(etat.sel);
      if (i3 === "aura") eq3.mods.aura = null;
      else if (i3 === "aura2") eq3.mods.aura2 = null;
      else if (i3 === "st") eq3.mods.st = null;
      else if (i3 === "x") eq3.mods.exilus = null;
      else eq3.mods.slots[Number(i3)] = null;
      sauve(); rendTout(); return;
    }
    var vide = e.target.closest(".ars-vide"), plein = e.target.closest(".ars-mod-corps");
    var kase = vide || plein;
    if (kase) {
      cible = { slot: etat.sel, i: kase.getAttribute("data-i") };
      collQ = ""; collPol = null;
      rendTout();
      coll.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
  // v29 : cliquer une STATISTIQUE filtre la collection sur les mods qui la
  // touchent (Perforation -> mods de perforation, Critique -> mods de crit…).
  function clicStat(tr) {
    var cles = (tr.getAttribute("data-fx") || "").split(",").filter(Boolean);
    if (!cles.length) return;
    var nom = (tr.cells[0] && tr.cells[0].textContent || "").trim();
    if (collFx && collFx.cles.join(",") === cles.join(",")) collFx = null; // re-clic = retire
    else collFx = { cles: cles, nom: nom };
    rendColl();
    if (collFx) coll.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  document.getElementById("ars-stats").addEventListener("click", function (e) {
    // v38 : bascule duo / Ombre — chaque moitié GARDE son build (etat.moities)
    // v94 : variante de la même famille — on change l'arme, on GARDE mods, rangs et riven.
    var fb = e.target.closest ? e.target.closest("[data-fam-un]") : null;
    if (fb) {
      var cour = etat.equip[etat.sel] || {};
      etat.equip[etat.sel] = Object.assign({}, cour, { un: fb.getAttribute("data-fam-un") });
      sauve(); rendTout(); return;
    }
    var ge = e.target.closest ? e.target.closest("[data-goexalte]") : null;
    if (ge) { etat.sel = ge.getAttribute("data-goexalte"); sauve(); rendTout(); return; }
    var bl = e.target.closest ? e.target.closest("[data-liee]") : null;
    if (bl) {
      var vers = bl.getAttribute("data-liee");
      var courant = etat.equip.frame;
      etat.moities = etat.moities || {};
      if (courant && courant.un) etat.moities[courant.un] = courant;
      etat.equip.frame = etat.moities[vers] || { un: vers };
      eqDe("frame"); etat.sel = "frame";
      sauve(); rendTout();
      return;
    }
    var fr2 = e.target.closest ? e.target.closest("tr.ars-fac-r") : null;
    if (fr2) { choisitFaction(fr2.getAttribute("data-fac")); return; }
    var tr = e.target.closest ? e.target.closest("tr.ars-stat-clic") : null;
    if (tr) clicStat(tr);
  });
  document.getElementById("ars-stats").addEventListener("change", function (e) {
    if (e.target.id === "ars-adapt") { etat.adapt = !!e.target.checked; sauve(); rendStats(); }
    if (e.target.id === "ars-gstr") { etat.gstr = !!e.target.checked; sauve(); rendStats(); }
    if (e.target.id === "ars-cvise") { etat.cvise = !!e.target.checked; sauve(); rendStats(); }
  });
  document.getElementById("ars-stats").addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var fr3 = e.target.closest ? e.target.closest("tr.ars-fac-r") : null;
    if (fr3) { e.preventDefault(); choisitFaction(fr3.getAttribute("data-fac")); return; }
    var tr = e.target.closest ? e.target.closest("tr.ars-stat-clic") : null;
    if (tr) { e.preventDefault(); clicStat(tr); }
  });
  // v47 : la faction retenue ne sert plus qu'au build auto (« adapter les
  // éléments ») — re-cliquer la ligne active la désélectionne.
  function choisitFaction(fac) {
    if (!fac || !FACTIONS[fac]) return;
    var actuel = etat.cible && etat.cible.fac;
    etat.cible = actuel === fac ? null : { fac: fac };
    sauve(); rendStats();
  }
  document.getElementById("ars-reset").addEventListener("click", function () {
    if (!confirm(T("Vider tout le loadout ?", "Clear the whole loadout?"))) return;
    etat = { reacteur: true, sel: "frame", equip: {} };
    try { localStorage.removeItem(KEY); } catch (e) {}
    history.replaceState(null, "", location.pathname);
    rendTout();
  });
  var btnTxt = document.getElementById("ars-copytxt");
  if (btnTxt) btnTxt.addEventListener("click", function () {
    // Plan d'application EN JEU : le jeu n'ayant AUCUNE API d'import (aucun outil
    // ne peut équiper un build à ta place), on exporte la recette exacte à suivre
    // dans l'Arsenal : objet, mods dans l'ordre des emplacements avec leur rang,
    // et les formas à poser (emplacement → polarité).
    sauve();
    var lignes = [T("BUILD VOIDRELAY — plan d'application en jeu", "VOIDRELAY BUILD — in-game application plan"), ""];
    slotsActifs().forEach(function (sdef) {
      var it = trouveItem(sdef.id);
      if (!it) return;
      var eq = etat.equip[sdef.id] || {};
      lignes.push("▸ " + sdef.nom.toUpperCase() + " : " + it.n);
      var nomme = function (label, x) {
        var r = refDe(x);
        if (!r) return;
        var m = modParUn(r.un);
        if (m) lignes.push("   " + label + " : " + nomMod(m) + (m.lvs ? T(" (rang ", " (rank ") + rangDe(r, m) + "/" + rangMax(m) + ")" : ""));
      };
      if (eq.mods) {
        nomme("Aura", eq.mods.aura); nomme("Aura 2", eq.mods.aura2);
        nomme(T("Posture", "Stance"), eq.mods.st);
        nomme("Exilus", eq.mods.exilus);
        (eq.mods.slots || []).forEach(function (x, i) { nomme(T("Emplacement ", "Slot ") + (i + 1), x); });
      }
      (eq.frags || []).filter(Boolean).forEach(function (ref, fi) {
        lignes.push("   " + T("Fragment ", "Shard ") + (fi + 1) + " : " + fragTexte(ref));
      });
      (eq.arcanes || []).filter(Boolean).forEach(function (un) {
        var a = D.arcanes.find(function (x) { return x.un === un; }) ||
                (D.arcArmes || []).find(function (x) { return x.un === un; });
        if (a) lignes.push("   Arcane : " + a.n);
      });
      var formas = Object.keys(eq.formas || {});
      if (formas.length) {
        lignes.push("   " + T("Formas à poser : ", "Formas to apply: ") + formas.map(function (i) {
          var ou = i === "aura" ? "aura" : i === "aura2" ? "aura 2" : i === "st" ? T("posture", "stance") : i === "x" ? "exilus" : T("emplacement ", "slot ") + (Number(i) + 1);
          return ou + " → " + eq.formas[i];
        }).join(" ; "));
      }
      var cap = capacite(sdef.id, it, eqDe(sdef.id));
      lignes.push("   " + T("Capacité : ", "Capacity: ") + cap.used + "/" + cap.total + (cap.used > cap.total ? T(" ⚠ dépasse — impossible en jeu tel quel", " ⚠ over — impossible in game as is") : ""));
      lignes.push("");
    });
    lignes.push(T("Recharger ce build dans le simulateur : ", "Reload this build in the simulator: ") + location.href);
    copie(lignes.join("\n"), btnTxt, T("Plan copié ✓", "Plan copied ✓"), T("Copier le plan (jeu)", "Copy the plan (game)"));
  });
  // Copie POUR LE CHAT DU JEU : les joueurs partagent leurs builds en collant des
  // liens d'objets entre crochets ([Vitalité], [Intensité]…) que le chat rend
  // cliquables — l'autre joueur ouvre chaque mod et l'équipe. Une ligne par
  // équipement (le chat envoie ligne par ligne), rang annoté hors crochets.
  // Les crochets ne matchent que si la langue du client correspond (noms FR ici).
  var btnChat = document.getElementById("ars-chat");
  if (btnChat) btnChat.addEventListener("click", function () {
    var lignes = [];
    slotsActifs().forEach(function (sdef) {
      var it = trouveItem(sdef.id);
      if (!it) return;
      var eq = etat.equip[sdef.id] || {};
      var morceaux = [];
      var lie = function (x) {
        var r = refDe(x);
        if (!r) return;
        var m = modParUn(r.un);
        if (m) morceaux.push("[" + nomMod(m) + "]" + (m.lvs && rangDe(r, m) < rangMax(m) ? "(r" + rangDe(r, m) + ")" : ""));
      };
      if (eq.mods) {
        lie(eq.mods.aura); lie(eq.mods.aura2); lie(eq.mods.st);
        (eq.mods.slots || []).forEach(lie);
        lie(eq.mods.exilus);
      }
      if (morceaux.length) lignes.push(it.n + " : " + morceaux.join(" "));
    });
    if (!lignes.length) { alert(T("Équipe d'abord des mods : il n'y a rien à partager.", "Equip some mods first: there is nothing to share.")); return; }
    copie(lignes.join("\n"), btnChat, T("Copié pour le chat ✓", "Copied for chat ✓"), T("Copier pour le chat Warframe", "Copy for Warframe chat"));
  });
  // Import par collage : un lien VoidRelay (#b=…) ou un texte qui en contient un.
  var btnColle = document.getElementById("ars-paste");
  if (btnColle) btnColle.addEventListener("click", function () {
    var saisie = prompt(T("Colle un lien ou un texte de build VoidRelay (contenant #b=…) :", "Paste a VoidRelay build link or text (containing #b=…):"));
    if (!saisie) return;
    var mz = /#z=([A-Za-z0-9+\-$]+)/.exec(saisie);
    var m = /#b=([A-Za-z0-9+/=]+)/.exec(saisie);
    if (!mz && !m) { alert(T("Aucun build VoidRelay reconnu dans ce texte (il faut un lien avec #z=… ou #b=…).", "No VoidRelay build recognized in this text (a link with #z=… or #b=… is required).")); return; }
    try {
      var nouvel = mz && window.LZString
        ? JSON.parse(LZString.decompressFromEncodedURIComponent(mz[1]))
        : JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      if (!nouvel || typeof nouvel !== "object" || !nouvel.equip) throw new Error("format");
      etat = nouvel; etat.equip = etat.equip || {};
      cible = null; sauve(); rendTout();
      btnColle.textContent = T("Build chargé ✓", "Build loaded ✓");
      setTimeout(function () { btnColle.textContent = T("Coller un build", "Paste a build"); }, 1800);
    } catch (e) { alert(T("Ce build est illisible (lien tronqué ?).", "This build is unreadable (truncated link?).")); }
  });
  // Builds sauvegardés nommés (localStorage) : enregistrer / charger / supprimer.
  var KEYB = "vr-arsenal-builds";
  function litBuilds() { try { return JSON.parse(localStorage.getItem(KEYB) || "{}"); } catch (e) { return {}; } }
  var btnSauve = document.getElementById("ars-save");
  if (btnSauve) btnSauve.addEventListener("click", function () {
    var fr = trouveItem("frame");
    var nom = prompt(T("Nom du build :", "Build name:"), fr ? fr.n : T("Mon build", "My build"));
    if (!nom) return;
    var tous = litBuilds();
    tous[nom] = JSON.parse(JSON.stringify(etat));
    try { localStorage.setItem(KEYB, JSON.stringify(tous)); } catch (e) { alert(T("Stockage plein.", "Storage full.")); return; }
    btnSauve.textContent = T("Enregistré ✓", "Saved ✓");
    setTimeout(function () { btnSauve.textContent = T("Enregistrer", "Save"); rendBuilds(); }, 900);
  });
  function rendBuilds() {
    var zone = document.getElementById("ars-builds");
    if (!zone) return;
    var tous = litBuilds(), noms = Object.keys(tous);
    zone.innerHTML = noms.length
      ? T("Mes builds : ", "My builds: ") + noms.map(function (n) {
          return '<button class="ars-bld" data-bld="' + esc(n) + '">' + esc(n) + '</button><button class="ars-bld-x" data-bldx="' + esc(n) + '" title="' + T("Supprimer", "Delete") + '" aria-label="' + T("Supprimer", "Delete") + " " + esc(n) + '">×</button>';
        }).join(" ")
      : "";
    zone.querySelectorAll("[data-bld]").forEach(function (b) {
      b.addEventListener("click", function () {
        etat = JSON.parse(JSON.stringify(litBuilds()[b.getAttribute("data-bld")]));
        etat.equip = etat.equip || {}; cible = null; sauve(); rendTout();
      });
    });
    zone.querySelectorAll("[data-bldx]").forEach(function (b) {
      b.addEventListener("click", function () {
        var tous2 = litBuilds();
        delete tous2[b.getAttribute("data-bldx")];
        try { localStorage.setItem(KEYB, JSON.stringify(tous2)); } catch (e) {}
        rendBuilds();
      });
    });
  }
  rendBuilds();
  // v34 : QR code du build — à faire scanner à un pote en jeu. Lib qrcode
  // (MIT, auto-hébergée) ; lien compressé z= = QR bien moins dense.
  var btnQr = document.getElementById("ars-qr");
  if (btnQr) btnQr.addEventListener("click", function () {
    sauve();
    if (typeof qrcode === "undefined") { alert(T("Générateur QR non chargé.", "QR generator not loaded.")); return; }
    var url = location.href;
    try {
      var qr = qrcode(0, "L");
      qr.addData(url);
      qr.make();
      picker.hidden = false;
      picker.innerHTML = '<div class="ars-pk-bd"></div><div class="ars-pk-box"><div class="ars-pk-top"><b>QR — ' +
        T("scanne pour ouvrir ce build", "scan to open this build") + '</b><button class="ars-pk-x" aria-label="' + T("Fermer", "Close") + '">×</button></div>' +
        '<div class="ars-pk-liste" style="padding:18px;text-align:center;background:#fff">' +
        qr.createImgTag(5, 12) + '</div>' +
        '<p class="muted" style="padding:8px 12px;font-size:.78rem;word-break:break-all">' + esc(url.slice(0, 120)) + "…</p></div>";
      picker.querySelector(".ars-pk-bd").onclick = picker.querySelector(".ars-pk-x").onclick = function () { picker.hidden = true; };
    } catch (e) {
      alert(T("Build trop long pour un QR — partage le lien classique.", "Build too long for a QR — share the classic link."));
    }
  });
  /* v59 — fiche du build : édition, rendu et persistance. Le rendu passe
     INTÉGRALEMENT par esc() : ces trois champs peuvent venir d'un lien
     fabriqué par un tiers. */
  function rendFiche() {
    var vue = document.getElementById("ars-fiche-vue");
    if (!vue) return;
    var f = etat.fiche;
    if (!f || (!f.t && !f.a && !f.d)) { vue.hidden = true; vue.innerHTML = ""; return; }
    vue.hidden = false;
    vue.innerHTML =
      (f.t ? "<h2>" + esc(f.t) + "</h2>" : "") +
      (f.a ? '<p class="ars-fiche-a">' + T("par ", "by ") + esc(f.a) + "</p>" : "") +
      (f.d ? '<p class="ars-fiche-d">' + esc(f.d) + "</p>" : "");
  }
  function champsFiche() {
    return { t: document.getElementById("ars-fiche-t"), a: document.getElementById("ars-fiche-a"), d: document.getElementById("ars-fiche-d") };
  }
  /* À rappeler APRÈS restaure() : ce bloc est câblé bien avant que l'état ne
     soit chargé (restaure() n'est appelée qu'au « Départ », tout en bas). Sans
     ce rappel, une fiche arrivée par un lien n'apparaît jamais — défaut
     introduit puis corrigé le 03/09/2026, trouvé en ouvrant vraiment un lien
     partagé plutôt qu'en relisant le code. */
  function majFiche() {
    var champs = champsFiche();
    Object.keys(champs).forEach(function (k) { if (champs[k]) champs[k].value = (etat.fiche && etat.fiche[k]) || ""; });
    rendFiche();
  }
  (function fiche() {
    var btn = document.getElementById("ars-fiche-btn"), box = document.getElementById("ars-fiche");
    if (!btn || !box) return;
    var champs = champsFiche();
    var versChamps = majFiche;
    function depuisChamps() {
      var f = {};
      Object.keys(champs).forEach(function (k) { if (champs[k]) f[k] = champs[k].value; });
      etat.fiche = assainisFiche(f);
      sauve();
      rendFiche();
    }
    btn.addEventListener("click", function () {
      box.hidden = !box.hidden;
      if (!box.hidden) { versChamps(); if (champs.t) champs.t.focus(); }
    });
    Object.keys(champs).forEach(function (k) { if (champs[k]) champs[k].addEventListener("input", depuisChamps); });
    versChamps();
    rendFiche();
  })();
  document.getElementById("ars-share").addEventListener("click", function () {
    sauve();
    copie(location.href, document.getElementById("ars-share"), T("Lien copié ✓", "Link copied ✓"), T("Partager le build", "Share build"));
  });

  /* ---- Guides → simulateur : /arsenal?sim=<slug>&tier=<deb|mid|exp> ----
     Les pages builds du site portent un bouton « Simuler ce palier » : on résout
     l'objet par nom et chaque mod par son nom ANGLAIS (champ en) avec le bon
     compat ; tout mod introuvable est LISTÉ (jamais ignoré en silence). */
  var simNote = null;
  var TIER_FR = EST_EN
    ? { deb: "beginner", mid: "intermediate", exp: "expert" }
    : { deb: "débutant", mid: "intermédiaire", exp: "expert" };
  function chargeSim() {
    var p = new URLSearchParams(location.search);
    var slug = p.get("sim"), tier = (p.get("tier") || "exp");
    if (!slug) return Promise.resolve(false);
    return fetch("/data/arsenal_builds.json").then(function (r) { return r.json(); }).then(function (map) {
      var e = map[slug];
      if (!e) return false;
      var t = e.tiers[tier] || e.tiers.exp;
      var slotId = null, item = null;
      if (e.t === "frame") {
        item = D.frames.find(function (f) { return normalize(f.n) === normalize(e.n); });
        slotId = "frame";
      } else {
        [["Primary", "primaire"], ["Secondary", "secondaire"], ["Melee", "melee"]].some(function (c) {
          var it = D.armes[c[0]].find(function (w) { return normalize(w.n) === normalize(e.n); });
          if (it) { item = it; slotId = c[1]; return true; }
          return false;
        });
      }
      if (!item) return false;
      etat = { reacteur: true, sel: slotId, equip: {} };
      etat.equip[slotId] = { un: item.un };
      var eq = eqDe(slotId), manquants = [];
      var compats = compatPour(slotId, "0");
      function resous(nomEn, slot) {
        var mm = D.mods.find(function (m) {
          if (!m.en || normalize(m.en) !== normalize(nomEn) || m.st) return false;
          if (slot === "aura") return m.c === "AURA";
          return m.c !== "AURA" && (slot === "x" ? true : compats.indexOf(m.c) !== -1);
        });
        if (!mm) { manquants.push(nomEn); return null; }
        return { un: mm.un, rk: null };
      }
      if (t.aura) eq.mods.aura = resous(t.aura, "aura");
      if (t.aura2) eq.mods.aura2 = resous(t.aura2, "aura");
      if (t.exilus) eq.mods.exilus = resous(t.exilus, "x");
      (t.mods || []).slice(0, 8).forEach(function (n, i) { eq.mods.slots[i] = resous(n, i); });
      // Comme en jeu : un build de guide arrive AVEC ses formas — on pose
      // automatiquement les polarités nécessaires pour que la capacité tienne
      // (jamais de bandeau « build impossible » sur un build importé).
      var nbFormas = legaliseCapacite(slotId, poidsPour(slotId, OBJECTIFS.equilibre), 10);
      simNote = { nom: e.n, tier: TIER_FR[tier] || tier, manquants: manquants, formas: nbFormas };
      sauve();
      history.replaceState(null, "", location.pathname + location.hash);
      return true;
    }).catch(function () { return false; });
  }

  // Vitrine de l'écran vide : builds phares du site en un clic (recharge via
  // ?sim= → même chemin que les boutons des guides, bannière comprise).
  var PHARES = ["saryn-prime", "mesa-prime", "wisp-prime", "octavia-prime",
    "revenant-prime", "chroma-prime", "volt-prime", "nova-prime", "excalibur-umbra"];
  function rendVitrine() {
    fetch("/data/arsenal_builds.json").then(function (r) { return r.json(); }).then(function (map) {
      var zone = document.getElementById("ars-vit-grid");
      if (!zone) return;
      var cartes = PHARES.filter(function (sl) { return map[sl]; }).slice(0, 6).map(function (sl) {
        var fr = D.frames.find(function (f) { return normalize(f.n) === normalize(map[sl].n); });
        return '<a class="ars-vit" href="' + T("/arsenal", "/en/arsenal") + '?sim=' + encodeURIComponent(sl) + '&tier=exp">' +
          (fr ? imgHtml(fr, "ars-vit-img") : "") +
          '<span class="ars-vit-n">' + esc(map[sl].n) + '</span><span class="ars-vit-sub">' + T("Guide → simulateur", "Guide → simulator") + "</span></a>";
      });
      zone.innerHTML = cartes.join("") || '<p class="muted">' + T("Carte des builds indisponible.", "Build map unavailable.") + "</p>";
    }).catch(function () {
      var zone = document.getElementById("ars-vit-grid");
      if (zone) zone.innerHTML = '<p class="muted">' + T("Carte des builds indisponible.", "Build map unavailable.") + "</p>";
    });
  }

  /* ---- Comparateur A/B : builds sauvegardés côte à côte ---- */
  function resumeEtat(et) {
    var vrai = etat;
    etat = et;
    var out = { frame: null, armes: [], titre: (et && et.fiche && et.fiche.t) || "" };
    try {
      var fr = trouveItem("frame");
      if (fr) {
        var st = statsFrame(fr, eqDe("frame"));
        out.frame = { n: fr.n, hp: st.hp, sh: st.sh, ar: st.ar, en: st.en,
          ehp: Math.round(st.hp * (1 + st.ar / 300)),
          str: st.str, dur: st.dur, rng: st.rng, eff: st.eff,
          // v60 : le comparateur ignorait tout ce que le moteur a appris
          // depuis v53 — il comparait deux builds sur neuf chiffres.
          adapt: st.adapt ? Math.round(st.adapt * 100) : 0,
          res: st.res || {} };
      }
      ["primaire", "secondaire", "melee"].forEach(function (sl) {
        var it = trouveItem(sl);
        if (it) {
          var sa = statsArme(it, eqDe(sl));
          out.armes.push({ slot: sl, n: it.n, burst: sa.burst, sout: sa.sout, tot: sa.tot,
            cc: sa.cc, cm: sa.cm, sc: sa.sc, hvy: sa.hvy || 0, saign: sa.saign || 0 });
        }
      });
    } finally { etat = vrai; }
    return out;
  }
  /* ---- v60 — COMPARATEUR À N COLONNES ------------------------------------
     L'ancien comparait l'actuel à UN build enregistré, sur neuf chiffres. Il
     ignorait donc tout ce que le moteur a appris depuis : critique, statut,
     attaque lourde, saignement, Adaptation, résistances. Et comparer deux à
     deux quand on a cinq builds enregistrés ne répond pas à la question qu'on
     se pose vraiment — « lequel ? ».
     Désormais : l'actuel PLUS tous les builds enregistrés, côte à côte, et le
     meilleur de chaque ligne mis en avant. Le tableau défile horizontalement
     DANS son cadre : la page, elle, ne doit jamais déborder (garde-fou). */
  var COMP_MAX = 6;   // au-delà, le tableau devient illisible plutôt qu'utile
  function comparer() {
    var tous = litBuilds(), noms = Object.keys(tous);
    if (!noms.length) {
      alert(T("Enregistre d'abord au moins un build (bouton Enregistrer) — le comparateur met l'actuel en face de tes builds enregistrés.",
              "Save at least one build first (Save button) — the comparator puts the current one next to your saved builds."));
      return;
    }
    var cols = [{ nom: T("Actuel", "Current"), r: resumeEtat(etat) }];
    noms.slice(0, COMP_MAX - 1).forEach(function (n) { cols.push({ nom: n, r: resumeEtat(tous[n]) }); });
    afficheComparaison(cols, noms.length > COMP_MAX - 1 ? noms.length - (COMP_MAX - 1) : 0);
  }
  function afficheComparaison(cols, restants) {
    /* Une ligne = un libellé et une valeur par colonne. Sur toutes les stats
       comparées ici, PLUS GRAND VAUT MIEUX — c'est ce qui autorise un simple
       maximum. Si une stat où le petit gagne était ajoutée un jour (temps de
       rechargement, coût d'énergie), il faudrait un sens par ligne. */
    function lg(nom, vals, unite, prefixe) {
      var nums = vals.filter(function (v) { return typeof v === "number" && isFinite(v); });
      var max = nums.length ? Math.max.apply(null, nums) : null;
      var distinctes = nums.filter(function (v, i, t) { return t.indexOf(v) === i; }).length;
      return "<tr><td>" + nom + "</td>" + vals.map(function (v) {
        var meilleur = distinctes > 1 && v === max;
        return "<td class='ars-cmp-v" + (meilleur ? " ok" : "") + "'>" +
          (v == null || v === "" ? "—" : (prefixe || "") + v + (unite || "")) + "</td>";
      }).join("") + "</tr>";
    }
    var h = '<div class="ars-pk-bd"></div><div class="ars-pk-box"><div class="ars-pk-top"><b>' +
      T("Comparer ", "Compare ") + cols.length + T(" builds", " builds") +
      '</b><button class="ars-pk-x" aria-label="' + T("Fermer", "Close") + '">×</button></div>' +
      '<div class="ars-pk-liste" style="padding:12px"><div class="ars-cmp-wrap"><table class="ars-cmp"><tr><th></th>' +
      cols.map(function (c) {
        return "<th>" + esc(c.nom) +
          (c.r.titre ? '<br><small class="muted">' + esc(c.r.titre) + "</small>" : "") +
          (c.r.frame ? '<br><small class="muted">' + esc(c.r.frame.n) + "</small>" : "") + "</th>";
      }).join("") + "</tr>";

    var champ = function (sel) { return cols.map(sel); };
    if (cols.some(function (c) { return c.r.frame; })) {
      var fr = function (k) { return champ(function (c) { return c.r.frame ? c.r.frame[k] : null; }); };
      h += "<tr><th colspan='" + (cols.length + 1) + "' class='ars-cmp-sec'>" + T("Warframe", "Warframe") + "</th></tr>" +
        lg(T("Santé", "Health"), fr("hp")) + lg(T("Bouclier", "Shield"), fr("sh")) +
        lg(T("Armure", "Armor"), fr("ar")) + lg(T("PV effectifs", "Effective HP"), fr("ehp")) +
        lg(T("Énergie", "Energy"), fr("en")) +
        lg(T("Puissance", "Strength"), fr("str"), " %") + lg(T("Durée", "Duration"), fr("dur"), " %") +
        lg(T("Portée", "Range"), fr("rng"), " %") + lg(T("Efficacité", "Efficiency"), fr("eff"), " %") +
        (fr("adapt").some(Boolean) ? lg(T("Adaptation", "Adaptation"), fr("adapt"), " %") : "");
    }
    // Un emplacement d'arme par bloc, aligné sur l'INDEX : chaque build a ses
    // propres armes, on ne compare donc pas des noms mais des emplacements.
    var nMax = Math.max.apply(null, cols.map(function (c) { return c.r.armes.length; }).concat([0]));
    for (var i = 0; i < nMax; i++) {
      (function (idx) {
        var ar = function (k) { return champ(function (c) { return c.r.armes[idx] ? c.r.armes[idx][k] : null; }); };
        h += "<tr><th colspan='" + (cols.length + 1) + "' class='ars-cmp-sec'>" +
          champ(function (c) { return c.r.armes[idx] ? esc(c.r.armes[idx].n) : "—"; }).join(" ⟷ ") + "</th></tr>" +
          lg(T("Dégâts / coup", "Damage / shot"), ar("tot")) +
          lg(T("Chance critique", "Crit chance"), ar("cc"), " %") +
          lg(T("Multi. critique", "Crit multiplier"), ar("cm"), "", "×") +
          lg(T("Chance de statut", "Status chance"), ar("sc"), " %") +
          lg(T("DPS rafale", "Burst DPS"), ar("burst")) +
          lg(T("DPS soutenu", "Sustained DPS"), ar("sout")) +
          (ar("hvy").some(Boolean) ? lg(T("Attaque lourde", "Heavy attack"), ar("hvy")) : "") +
          (ar("saign").some(Boolean) ? lg(T("Saignement", "Bleed"), ar("saign")) : "");
      })(i);
    }
    h += "</table></div>" +
      '<p class="muted" style="margin:.6em 0 0">' +
      T("Vert = la meilleure valeur de la ligne. Les armes sont comparées par EMPLACEMENT, pas par nom.",
        "Green = best value in the row. Weapons are compared by SLOT, not by name.") +
      (restants ? " " + T("+" + restants + " build(s) enregistré(s) non affiché(s) — le tableau resterait lisible jusqu'à " + COMP_MAX + " colonnes.",
                          "+" + restants + " saved build(s) not shown — the table stays readable up to " + COMP_MAX + " columns.") : "") +
      "</p></div></div>";

    var picker = document.getElementById("ars-picker");
    picker.hidden = false;
    picker.innerHTML = h;
    picker.querySelector(".ars-pk-bd").onclick = picker.querySelector(".ars-pk-x").onclick = function () { picker.hidden = true; };
    document.addEventListener("keydown", function fEsc(e) {
      if (e.key === "Escape") { picker.hidden = true; document.removeEventListener("keydown", fEsc); }
    });
  }
  /* ---- v61 — CLASSEMENT DES ARMES ----------------------------------------
     La page qu'aucun site de build ne propose vraiment, et que ce moteur peut
     produire seul : les 611 armes classées, chacune montée par le MÊME
     algorithme avec le MÊME objectif. C'est ce qui rend la comparaison
     honnête — sinon on compare des builds, pas des armes.

     Deux limites, écrites sous le tableau plutôt que passées sous silence :
     • le choix des mods vient de construitPour(), donc d'une heuristique de
       pondération, pas de la méta réelle. Une arme dont le bon build repose
       sur un mod conditionnel non modélisé sera sous-estimée ;
     • le DPS soutenu ignore le temps de visée, le recul et la montée en
       cadence — un rayon continu y paraît meilleur qu'en jeu. */
  var CLASSE_SLOT = { Primary: "primaire", Secondary: "secondaire", Melee: "melee" };
  function classementArmes(cat, objK) {
    var vrai = etat, slot = CLASSE_SLOT[cat], obj = OBJECTIFS[objK] || OBJECTIFS.degats;
    var out = [];
    try {
      (D.armes[cat] || []).forEach(function (w) {
        if (!w || !w.un) return;
        // Même astuce que resumeEtat() : on prête l'état global le temps du
        // calcul, puis on le rend — construitPour() et statsArme() lisent tous
        // deux `etat`, il n'y a pas d'autre chemin.
        etat = { reacteur: true, sel: slot, equip: {} };
        etat.equip[slot] = { un: w.un };
        try {
          construitPour(slot, obj, true);
          var sa = statsArme(w, eqDe(slot));
          out.push({ n: w.n, un: w.un, mr: w.mr || 0, ty: w.type || "", tot: sa.tot,
            burst: sa.burst, sout: sa.sout, saign: sa.saign || 0 });
        } catch (e) { /* une arme qui ne se monte pas ne doit pas tuer le classement */ }
      });
    } finally { etat = vrai; }
    out.sort(function (a, b) { return (b.sout || 0) - (a.sout || 0); });
    return out;
  }
  var CLASSE_N = 40;
  function ouvreClassement(cat, objK) {
    cat = cat || "Primary";
    objK = objK || "degats";
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var liste = classementArmes(cat, objK);
    var ms = t0 ? Math.round(performance.now() - t0) : 0;
    var nomsCat = { Primary: T("Principales", "Primaries"), Secondary: T("Secondaires", "Secondaries"), Melee: T("Mêlée", "Melee") };
    var h = '<div class="ars-pk-bd"></div><div class="ars-pk-box"><div class="ars-pk-top"><b>' +
      T("Classement des armes", "Weapon ranking") + " — " + esc(nomsCat[cat]) +
      '</b><button class="ars-pk-x" aria-label="' + T("Fermer", "Close") + '">×</button></div>' +
      '<div class="ars-pk-liste" style="padding:12px">' +
      '<p class="ars-cls-ctl">' +
      Object.keys(CLASSE_SLOT).map(function (c) {
        return '<button type="button" class="ars-tri' + (c === cat ? " active" : "") + '" data-cls-cat="' + c + '">' + esc(nomsCat[c]) + "</button>";
      }).join(" ") + " &nbsp;·&nbsp; " +
      Object.keys(OBJECTIFS).map(function (k) {
        return '<button type="button" class="ars-tri' + (k === objK ? " active" : "") + '" data-cls-obj="' + esc(k) + '">' + esc(OBJECTIFS[k].n) + "</button>";
      }).join(" ") + "</p>" +
      '<div class="ars-cmp-wrap"><table class="ars-cmp ars-cls"><tr><th>#</th><th>' + T("Arme", "Weapon") +
      "</th><th>" + T("Type", "Type") + "</th><th>" + T("Maîtrise", "Mastery") + "</th><th>" + T("Dégâts / coup", "Damage / shot") +
      "</th><th>" + T("DPS rafale", "Burst DPS") + "</th><th>" + T("DPS soutenu", "Sustained DPS") + "</th></tr>" +
      liste.slice(0, CLASSE_N).map(function (x, i) {
        return "<tr><td>" + (i + 1) + '</td><td><button class="ars-pk-it ars-cls-n" data-cls-un="' + esc(x.un) + '">' + esc(x.n) + "</button></td>" +
          "<td class='ars-cmp-v'>" + esc(x.ty) + "</td><td class='ars-cmp-v'>" + x.mr +
          "</td><td class='ars-cmp-v'>" + x.tot + "</td><td class='ars-cmp-v'>" + x.burst +
          "</td><td class='ars-cmp-v" + (i === 0 ? " ok" : "") + "'>" + x.sout + "</td></tr>";
      }).join("") + "</table></div>" +
      '<p class="muted ars-cls-note" style="margin:.6em 0 0">' +
      T("Les " + liste.length + " armes sont montées par le MÊME algorithme avec le MÊME objectif — c'est ce qui rend la comparaison honnête. Deux limites : le choix des mods vient d'une heuristique, pas de la méta réelle (une arme dont le bon build repose sur un mod conditionnel non modélisé sera sous-estimée), et le DPS soutenu ignore le temps de visée, le recul et la montée en cadence. Le TYPE est affiché parce qu'il réserve des surprises : le Sirocco est la seule arme de type « Pistol » rangée dans les principales, et le moteur la monte avec des mods qu'elle ne porte pas en jeu — elle arrive donc trop haut. Rien n'est filtré en douce. Clique une arme pour l'équiper.",
        "All " + liste.length + " weapons are built by the SAME algorithm with the SAME objective — that is what makes the comparison honest. Two limits: mod choice comes from a heuristic, not the real meta (a weapon whose real build relies on an unmodelled conditional mod will be underrated), and sustained DPS ignores aim time, recoil and spool-up. The TYPE column is there because it holds surprises: the Sirocco is the only \"Pistol\"-type weapon filed under primaries, and the engine builds it with mods it cannot take in game — so it ranks too high. Nothing is silently filtered. Click a weapon to equip it.") +
      (ms ? " <small>(" + ms + " ms)</small>" : "") + "</p></div></div>";

    var picker = document.getElementById("ars-picker");
    picker.hidden = false;
    picker.innerHTML = h;
    picker.querySelector(".ars-pk-bd").onclick = picker.querySelector(".ars-pk-x").onclick = function () { picker.hidden = true; };
    picker.querySelectorAll("[data-cls-cat]").forEach(function (b) {
      b.onclick = function () { ouvreClassement(b.getAttribute("data-cls-cat"), objK); };
    });
    picker.querySelectorAll("[data-cls-obj]").forEach(function (b) {
      b.onclick = function () { ouvreClassement(cat, b.getAttribute("data-cls-obj")); };
    });
    picker.querySelectorAll("[data-cls-un]").forEach(function (b) {
      b.onclick = function () {
        var slot = CLASSE_SLOT[cat];
        etat.equip[slot] = { un: b.getAttribute("data-cls-un") };
        etat.sel = slot;
        picker.hidden = true;
        sauve(); rendTout();
      };
    });
    document.addEventListener("keydown", function fEsc(e) {
      if (e.key === "Escape") { picker.hidden = true; document.removeEventListener("keydown", fEsc); }
    });
  }
  /* ---- v62 — BIBLIOTHÈQUE PUBLIQUE DE BUILDS ------------------------------
     Le dernier des quatre chantiers. Le build lui-même voyage déjà dans le
     lien (v59) : la bibliothèque n'ajoute donc PAS un format de stockage, elle
     ajoute un annuaire — « qui a publié quoi pour cette arme, et qu'en pensent
     les autres ».

     ELLE PEUT NE PAS ÊTRE LÀ, et c'est le cas normal aujourd'hui : /api/builds
     répond 503 tant que la liaison D1 n'est pas créée dans le tableau de bord
     Cloudflare, et 404 sur un simple serveur de fichiers (le cas des tests
     locaux). Les deux sont traités comme une absence ANNONCÉE, jamais comme
     une panne : on explique, on ne casse pas. */
  function apiBuilds(chemin, options) {
    return fetch("/api/builds" + (chemin || ""), options)
      .then(function (r) {
        // Un serveur de fichiers répond 404 avec du HTML : json() échoue alors,
        // mais le STATUT reste l'information utile — on ne le perd pas en
        // route, sinon le message parle de « réseau » pour un simple 404.
        return r.json().catch(function () { return { ok: false, error: "réponse illisible" }; })
          .then(function (j) { return { statut: r.status, corps: j }; });
      })
      .catch(function (e) { return { statut: 0, corps: { ok: false, error: String(e && e.message || e) } }; });
  }
  function messageAbsence(rep) {
    var d = rep && rep.corps && rep.corps.detail;
    return '<p class="ars-biblio-absente">' +
      T("La bibliothèque n'est pas encore branchée sur ce site.", "The library is not connected on this site yet.") +
      (d ? " " + esc(d) : " " + T("Le point d'accès /api/builds ne répond pas (" + (rep.statut || "réseau") + ").",
                                  "The /api/builds endpoint is not answering (" + (rep.statut || "network") + ").")) +
      " " + T("Ton build reste partageable par lien, comme avant.", "Your build is still shareable by link, as before.") + "</p>";
  }
  /* Nommée « objet » et non « arme » : elle rend l'élément de l'emplacement
     SÉLECTIONNÉ, ce qui inclut la Warframe et le compagnon. La bibliothèque
     couvre donc tout l'arsenal, pas seulement les armes — vérifié, le panneau
     s'ouvre bien sur « Bibliothèque de builds — Chroma Prime ». */
  /* Nom lisible d'un objet à partir de son uniqueName.

     La bibliothèque GLOBALE (/arsenal#biblio) liste des builds de tous les
     objets : sans ce nom, on ne lirait que le titre choisi par l'auteur, sans
     savoir sur quoi il porte. Les données sont déjà en mémoire — c'est
     précisément pourquoi la bibliothèque vit ici plutôt que sur une page à
     part, qui aurait dû charger 510 Ko de tables juste pour des noms. */
  function nomDeUn(un) {
    if (!un) return "";
    var l = (D.frames || []).slice();
    var a = D.armes || {};
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k) && a[k] && a[k].length) l = l.concat(a[k]);
    if (D.comp) l = l.concat(D.comp.compagnons || [], D.comp.armes || []);
    for (var i = 0; i < l.length; i++) if (l[i] && l[i].un === un) return l[i].n || "";
    return "";
  }
  function objetCourant() {
    var it = trouveItem(etat.sel);
    return (it && it.un) ? { un: it.un, n: it.n } : null;
  }
  /* `tout` : ignore l'objet équipé et montre TOUS les builds publiés. C'est le
     mode de /arsenal#biblio — la bibliothèque avait besoin d'une URL, pas d'une
     page : sans adresse, un joueur ne pouvait ni la partager ni la trouver
     autrement qu'en équipant d'abord la bonne arme. */
  function ouvreBiblio(tout) {
    var arme = tout ? null : objetCourant();
    var picker = document.getElementById("ars-picker");
    var titre = tout
      ? T("Bibliothèque de builds — tous les objets", "Build library — all items")
      : T("Bibliothèque de builds", "Build library") + (arme ? " — " + esc(arme.n) : "");
    picker.hidden = false;
    picker.innerHTML = '<div class="ars-pk-bd"></div><div class="ars-pk-box"><div class="ars-pk-top"><b>' + titre +
      '</b><button class="ars-pk-x" aria-label="' + T("Fermer", "Close") + '">×</button></div>' +
      '<div class="ars-pk-liste" style="padding:12px" id="ars-biblio-corps"><p class="muted">' +
      T("Chargement…", "Loading…") + "</p></div></div>";
    picker.querySelector(".ars-pk-bd").onclick = picker.querySelector(".ars-pk-x").onclick = function () { picker.hidden = true; };
    var corps = document.getElementById("ars-biblio-corps");
    apiBuilds(arme ? "?arme=" + encodeURIComponent(arme.un) : "").then(function (rep) {
      /* Chemin d'erreur : brancherPublier() est appelée ici AUSSI, sinon le
         bouton « Choisir un objet » de blocPublier() serait affiché sans être
         branché — un bouton mort est pire que pas de bouton. */
      if (!rep.corps || rep.corps.ok !== true) {
        corps.innerHTML = messageAbsence(rep) + blocPublier(arme, true);
        brancherPublier(arme, corps);
        return;
      }
      var l = rep.corps.builds || [];
      corps.innerHTML =
        (l.length
          ? '<ul class="ars-biblio">' + l.map(function (b) {
              var surQuoi = tout ? nomDeUn(b.arme) : "";
              return '<li><div class="ars-biblio-t">' + esc(b.titre) + "</div>" +
                (surQuoi ? '<div class="muted">' + esc(surQuoi) + "</div>" : "") +
                (b.auteur ? '<div class="muted">' + T("par ", "by ") + esc(b.auteur) + "</div>" : "") +
                (b.notes ? '<div class="ars-biblio-n">' + esc(b.notes) + "</div>" : "") +
                '<div class="ars-biblio-a"><a href="' + esc(b.lien) + '">' + T("Ouvrir ce build →", "Open this build →") + "</a>" +
                '<button type="button" class="ars-tri" data-vote="' + Number(b.id) + '">▲ ' + Number(b.votes || 0) + "</button>" +
                '<button type="button" class="ars-tri" data-signal="' + Number(b.id) + '" title="' +
                T("Signaler ce build", "Report this build") + '">⚐ ' + T("Signaler", "Report") + "</button></div></li>";
            }).join("") + "</ul>"
          : '<p class="muted">' + (tout
              ? T("Aucun build publié pour l'instant — sois le premier.", "No published build yet — be the first.")
              : T("Aucun build publié pour cette arme — sois le premier.", "No published build for this weapon yet — be the first.")) + "</p>") +
        blocPublier(arme, false);
      /* Signalement : deux empreintes différentes masquent un build. Le bouton
         se désarme après le clic — le compte se fait côté serveur, cliquer
         encore n'ajouterait rien et laisserait croire le contraire. */
      corps.querySelectorAll("[data-signal]").forEach(function (b) {
        b.onclick = function () {
          b.disabled = true;
          apiBuilds("?a=signaler", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: Number(b.getAttribute("data-signal")) }) }).then(function (r) {
            if (r.corps && r.corps.ok) {
              b.textContent = r.corps.masque ? T("⚐ masqué", "⚐ hidden") : T("⚐ signalé", "⚐ reported");
            } else { b.disabled = false; }
          });
        };
      });
      corps.querySelectorAll("[data-vote]").forEach(function (b) {
        b.onclick = function () {
          apiBuilds("?a=vote", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: Number(b.getAttribute("data-vote")) }) }).then(function (r) {
            if (r.corps && r.corps.ok) b.textContent = "▲ " + r.corps.votes + (r.corps.deja ? " ✓" : "");
          });
        };
      });
      brancherPublier(arme, corps);
    });
  }
  function blocPublier(arme, absente) {
    /* Sans objet équipé — c'est le cas de /arsenal#biblio, où l'on arrive
       depuis /outils sans avoir rien choisi. « Équipe une arme » seul était un
       cul-de-sac : la fenêtre couvre justement l'arsenal. Le bouton la ferme,
       ce qui découvre l'arsenal derrière : l'action demandée devient faisable. */
    if (!arme) return '<div class="ars-biblio-pub"><p class="muted">' +
      T("Pour publier un build, choisis d'abord un objet dans l'arsenal.",
        "To publish a build, first pick an item in the arsenal.") + "</p>" +
      '<p><button type="button" class="ars-tri" id="ars-biblio-choisir">' +
      T("Choisir un objet", "Pick an item") + "</button></p></div>";
    return '<div class="ars-biblio-pub"><h3>' + T("Publier le build actuel", "Publish the current build") + "</h3>" +
      '<p class="muted">' + T("Le titre, l'auteur et les notes viennent de la fiche du build (bouton ✎). Ton build est publié tout de suite. Les adresses de sites sont retirées du texte, et deux signalements suffisent à masquer un build.",
        "Title, author and notes come from the build sheet (✎ button). Your build is published right away. Website addresses are stripped from the text, and two reports are enough to hide a build.") + "</p>" +
      (absente ? "" : '<p><button type="button" class="ars-tri" id="ars-biblio-go">' + T("Envoyer", "Submit") + "</button> " +
        '<span class="muted" id="ars-biblio-etat"></span></p>') + "</div>";
  }
  function brancherPublier(arme, corps) {
    var choisir = corps.querySelector("#ars-biblio-choisir");
    if (choisir) choisir.onclick = function () { document.getElementById("ars-picker").hidden = true; };
    var go = corps.querySelector("#ars-biblio-go");
    if (!go || !arme) return;
    go.onclick = function () {
      var etatTxt = corps.querySelector("#ars-biblio-etat");
      var f = etat.fiche || {};
      if (!f.t || f.t.length < 3) {
        etatTxt.textContent = T("Donne d'abord un titre au build (bouton ✎ Fiche).", "Give the build a title first (✎ Build sheet).");
        return;
      }
      sauve();  // le lien doit refléter l'état courant
      etatTxt.textContent = T("Envoi…", "Sending…");
      apiBuilds("", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arme: arme.un, titre: f.t, auteur: f.a || "", notes: f.d || "", lien: location.href }) })
        .then(function (r) {
          etatTxt.textContent = (r.corps && r.corps.ok)
            ? (r.corps.message || T("Envoyé.", "Sent."))
            : T("Refusé : ", "Rejected: ") + ((r.corps && r.corps.error) || r.statut);
        });
    };
  }
  var btnBib = document.getElementById("ars-biblio-btn");
  /* La fonction fléchée est OBLIGATOIRE : addEventListener passe l'événement en
     premier argument, donc `ouvreBiblio` reçu directement verrait `tout` = Event,
     c'est-à-dire une valeur vraie — le bouton d'une arme ouvrirait la vue globale. */
  if (btnBib) btnBib.addEventListener("click", function () { ouvreBiblio(false); });

  var btnCls = document.getElementById("ars-classement");
  if (btnCls) btnCls.addEventListener("click", function () { ouvreClassement("Primary", "degats"); });

  var btnComp = document.getElementById("ars-compare");
  if (btnComp) btnComp.addEventListener("click", comparer);

  /* ---- v41 : ÉPINGLE — fige les stats du moment, chaque modification montre
     son delta en direct dans le panneau (théorycraft : change un mod, VOIS). ---- */
  var btnPin = document.getElementById("ars-pin");
  function majPinBtn() {
    if (btnPin) btnPin.textContent = etat.pin ? T("📌 Épinglé ✓", "📌 Pinned ✓") : T("📌 Épingler", "📌 Pin");
  }
  if (btnPin) btnPin.addEventListener("click", function () {
    etat.pin = etat.pin ? null : resumeEtat(etat);
    sauve(); majPinBtn(); rendStats();
  });
  majPinBtn();
  // delta vs épingle : petit badge coloré, rien si identique ou pas d'épingle
  function dPin(av, ap) {
    if (!etat.pin || av == null || ap == null) return "";
    var d = Math.round((ap - av) * 100) / 100;
    if (!d) return "";
    return ' <small class="ars-pin-d ' + (d > 0 ? "ok" : "bad") + '" title="' +
      T("écart vs build épinglé", "vs pinned build") + '">' + (d > 0 ? "▲+" : "▼") + d + "</small>";
  }

  /* ---- BUILD AUTO (17/07/2026, demande de l'admin) --------------------------------
     Construit un build complet selon un OBJECTIF choisi (dégâts crit, statut,
     survie, pouvoirs, vitesse, équilibré) sur un périmètre au choix : équipement
     affiché, tout le loadout, ou tout + tirage au hasard des emplacements vides.
     Honnêteté : ne choisit que parmi les mods aux effets SIMULÉS (fx parsé) —
     jamais un mod « à l'aveugle » ; postures, arcanes et fragments ne sont pas
     touchés. Capacité respectée comme en jeu : formas posés automatiquement
     (5 max par équipement), puis rangs baissés, puis mod retiré en dernier
     recours — le résultat est TOUJOURS légal en capacité. Annulable (Ctrl+Z). */
  // frags : 5 fragments d'Archon (indices [couleur, buff] dans FRAGS, non-Tauforgés
  // — seuls les bonus CHIFFRABLES sont utilisés) ; pick : équipements MÉTA posés
  // par « remplir » (résolus par nom exact dans les données, jamais du hasard pur).
  var OBJECTIFS = {
    degats:   { n: T("Dégâts d'armes (critique)", "Weapon damage (critical)"),
                d: T("boss, assassinats, mono-cible", "bosses, assassinations, single target"),
                arme: { dmg: 10, ms: 9, cc: 8, cm: 8, fr: 5, sc: 3, e: 4, p: 2, mag: 1, rel: 1 },
                frame: { str: 6, dur: 4, eff: 4, rng: 3, hp: 3, ar: 2, en: 2, spr: 1 },
                comp: { hp: 6, ar: 4, sh: 2 },
                aura: ["Steel Charge", "Growing Power", "Energy Siphon"],
                frags: [[0, 0], [0, 0], [0, 2], [0, 3], [1, 0]],
                pick: { frame: ["Mesa Prime", "Chroma Prime", "Revenant Prime"], Primary: ["Soma Prime", "Vectis Prime", "Boltor Prime"], Secondary: ["Lex Prime", "Akstiletto Prime"], Melee: ["Nikana Prime", "Kronen Prime"], comp: ["Carrier Prime", "Helios Prime"] } },
    statut:   { n: T("Statut & éléments", "Status & elements"),
                d: T("Steel Path, ennemis blindés, hordes", "Steel Path, armored enemies, hordes"),
                arme: { dmg: 8, ms: 7, sc: 10, e: 8, fr: 4, cc: 3, cm: 3, p: 1 },
                frame: { str: 6, dur: 4, eff: 4, rng: 3, hp: 3, ar: 2, en: 2 },
                comp: { hp: 6, ar: 4, sh: 2 },
                aura: ["Growing Power", "Corrosive Projection", "Energy Siphon"],
                frags: [[0, 0], [0, 0], [0, 2], [0, 3], [1, 0]],
                pick: { frame: ["Saryn Prime", "Ember Prime", "Nova Prime"], Primary: ["Ignis Wraith", "Amprex", "Phenmor"], Secondary: ["Atomos", "Nukor Kuva"], Melee: ["Orthos Prime", "Galatine Prime"], comp: ["Smeeta Kavat", "Carrier Prime"] } },
    survie:   { n: T("Survie / tank", "Survival / tank"),
                d: T("survie longue, défense, arbitrages", "long survival, defense, arbitrations"),
                arme: { dmg: 8, ms: 7, cc: 6, cm: 6, sc: 4, fr: 4, e: 4 },
                frame: { hp: 10, ar: 8, sh: 5, en: 3, eff: 3, dur: 3, str: 2, rng: 1 },
                comp: { hp: 8, ar: 6, sh: 4 },
                aura: ["Physique", "Rejuvenation", "Stand United"],
                frags: [[0, 0], [0, 0], [0, 2], [0, 2], [0, 1]],
                pick: { frame: ["Rhino Prime", "Nidus Prime", "Chroma Prime"], Primary: ["Boltor Prime", "Strun Wraith"], Secondary: ["Lex Prime", "Furis"], Melee: ["Galatine Prime", "Reaper Prime"], comp: ["Nautilus", "Wyrm Prime"] } },
    pouvoirs: { n: T("Puissance de pouvoirs", "Ability strength"),
                d: T("frames à pouvoirs, nuke, buffs", "ability frames, nukes, buffs"),
                arme: { dmg: 8, ms: 7, cc: 6, cm: 6, sc: 4, fr: 4, e: 4 },
                frame: { str: 10, eff: 7, rng: 6, dur: 6, en: 4, hp: 2, ar: 1 },
                comp: { hp: 6, ar: 4, sh: 2 },
                aura: ["Growing Power", "Energy Siphon", "Brief Respite"],
                frags: [[1, 0], [1, 0], [1, 0], [1, 1], [1, 1]],
                pick: { frame: ["Saryn Prime", "Volt Prime", "Octavia Prime", "Wisp Prime"], Primary: ["Phenmor", "Amprex"], Secondary: ["Nukor Kuva", "Atomos"], Melee: ["Orthos Prime", "Nikana Prime"], comp: ["Wyrm Prime", "Smeeta Kavat"] } },
    vitesse:  { n: T("Vitesse / farm", "Speed / farming"),
                d: T("capture, sabotage, ouverture de reliques", "capture, sabotage, relic cracking"),
                arme: { fr: 9, dmg: 7, ms: 6, rel: 4, mag: 2, cc: 4, cm: 4, e: 3 },
                frame: { spr: 9, eff: 5, dur: 4, en: 3, rng: 3, hp: 2, ar: 1, str: 2 },
                comp: { hp: 5, ar: 3, sh: 2 },
                aura: ["Sprint Boost", "Energy Siphon"],
                frags: [[0, 3], [0, 3], [0, 0], [0, 0], [1, 1]],
                pick: { frame: ["Gauss Prime", "Volt Prime", "Wisp Prime"], Primary: ["Braton Prime", "Soma Prime"], Secondary: ["Akstiletto Prime", "Atomos"], Melee: ["Kronen Prime", "Orthos Prime"], comp: ["Smeeta Kavat", "Carrier Prime"] } },
    equilibre:{ n: T("Équilibré", "Balanced"),
                d: T("missions courantes, carte stellaire", "everyday missions, star chart"),
                arme: { dmg: 8, ms: 7, cc: 5, cm: 5, sc: 4, fr: 4, e: 4, mag: 1, rel: 1 },
                frame: { str: 5, dur: 4, eff: 4, rng: 3, hp: 5, ar: 4, sh: 2, en: 3, spr: 1 },
                comp: { hp: 6, ar: 4, sh: 3 },
                aura: ["Energy Siphon", "Corrosive Projection", "Rejuvenation"],
                frags: [[0, 0], [0, 2], [0, 3], [1, 0], [1, 1]],
                pick: { frame: ["Excalibur Umbra", "Rhino Prime", "Nova Prime"], Primary: ["Braton Prime", "Boltor Prime"], Secondary: ["Lex Prime", "Atomos"], Melee: ["Nikana Prime", "Orthos Prime"], comp: ["Carrier Prime", "Wyrm Prime"] } },
  };
  function scoreFx(fx, w) {
    var s = 0, k, poids;
    for (k in fx) {
      poids = w[k] != null ? w[k]
        : (k.indexOf("e_") === 0 || k.indexOf("ec_") === 0) ? (w.e || 0)
        : k.indexOf("p_") === 0 ? (w.p || 0) : 0;
      s += poids * fx[k];
    }
    return s;
  }
  function poidsPour(slotId, obj) {
    if (slotId === "frame") return obj.frame;
    if (slotId === "compagnon") return obj.comp;
    return obj.arme; // armes, exaltées, arme de compagnon
  }
  // Rend un équipement LÉGAL en capacité, exactement comme on le ferait en jeu :
  // formas d'abord (l'aura en premier — la polariser DOUBLE la capacité ajoutée),
  // puis rangs baissés, puis retrait en dernier recours. w = poids servant à
  // choisir QUOI baisser/retirer ; maxFormas borne la pose automatique.
  // Utilisé par le build auto (5 formas max) ET par l'import des builds guides/
  // vitrine (17/07/2026) : un build importé n'arrive plus jamais « impossible ».
  function legaliseCapacite(slotId, w, maxFormas) {
    var it = trouveItem(slotId);
    if (!it) return 0;
    var eq = eqDe(slotId);
    var formasPoses = 0, garde = 200;
    function cases() {
      var out = [];
      if (slotId === "frame" && refDe(eq.mods.aura)) out.push("aura");
      if (refDe(eq.mods.exilus)) out.push("x");
      for (var j = 0; j < 8; j++) if (refDe(eq.mods.slots[j])) out.push(j);
      return out;
    }
    function refA(i2) { return i2 === "aura" ? eq.mods.aura : i2 === "x" ? eq.mods.exilus : eq.mods.slots[Number(i2)]; }
    while (capacite(slotId, it, eq).used > capacite(slotId, it, eq).total && garde-- > 0) {
      var faites = false;
      if (formasPoses < maxFormas) {
        // polariser l'emplacement au drain le plus lourd dont la polarité diffère
        // (l'aura d'abord : la polariser DOUBLE la capacité ajoutée)
        var cible2 = null, gain = 0;
        cases().forEach(function (i2) {
          var m2 = modParUn(refDe(refA(i2)).un);
          if (!m2) return;
          var polCourante = polDe(slotId, it, eq, i2);
          if (polCourante === m2.pol) return;
          var d = i2 === "aura" ? bonusAura(m2, m2.pol, null) - bonusAura(m2, polCourante, null)
                                : drainDansSlot(m2, polCourante, null) - drainDansSlot(m2, m2.pol, null);
          if (d > gain) { gain = d; cible2 = { i: i2, pol: m2.pol }; }
        });
        if (cible2) { eq.formas[cible2.i] = cible2.pol; formasPoses++; faites = true; }
      }
      if (!faites) {
        // baisser d'un rang le mod au score le plus faible qui a des rangs réglables
        var bas = null, basScore = Infinity;
        cases().forEach(function (i2) {
          if (i2 === "aura") return;
          var r2 = refDe(refA(i2)), m3 = r2 && modParUn(r2.un);
          if (!m3 || !m3.lvs || rangDe(r2, m3) <= 0) return;
          var s3 = scoreFx(m3.fx || {}, w);
          if (s3 < basScore) { basScore = s3; bas = { i: i2, r: r2, m: m3 }; }
        });
        if (bas) {
          bas.r.rk = rangDe(bas.r, bas.m) - 1;
          if (bas.i === "x") eq.mods.exilus = bas.r; else eq.mods.slots[Number(bas.i)] = bas.r;
          faites = true;
        }
      }
      if (!faites) {
        // dernier recours : retirer le mod le moins bien classé (hors aura)
        var pire = null, pireScore = Infinity;
        cases().forEach(function (i2) {
          if (i2 === "aura") return;
          var r4 = refDe(refA(i2)), m4 = r4 && modParUn(r4.un);
          if (!m4) return;
          var s4 = scoreFx(m4.fx || {}, w);
          if (s4 < pireScore) { pireScore = s4; pire = i2; }
        });
        if (pire === null) break;
        if (pire === "x") eq.mods.exilus = null; else eq.mods.slots[Number(pire)] = null;
      }
    }
    return formasPoses;
  }

  // Construit les mods d'UN équipement. ecrase=false : les mods déjà posés restent.
  function construitPour(slotId, obj, ecrase) {
    var it = trouveItem(slotId);
    if (!it) return null;
    var eq = eqDe(slotId);
    var w = poidsPour(slotId, obj);
    var compats = compatPour(slotId, "0");
    if (ecrase) { eq.mods.slots = [null, null, null, null, null, null, null, null]; eq.mods.exilus = null; eq.formas = {}; if (slotId === "frame") eq.mods.aura = null; }
    var pris = {}, fams = {};
    function note(ref) {
      var m = ref && modParUn(ref.un);
      if (!m) return;
      pris[m.un] = 1;
      if (m.fam) fams[m.fam] = 1;
    }
    (eq.mods.slots || []).concat([eq.mods.exilus, eq.mods.aura, eq.mods.st]).map(refDe).forEach(note);
    var cand = D.mods
      .filter(function (m) {
        return m.fx && !m.st && m.c !== "AURA" && compats.indexOf(m.c) !== -1 &&
          !pris[m.un] && !(m.fam && fams[m.fam]);
      })
      .map(function (m) { return { m: m, s: scoreFx(m.fx, w) }; })
      .filter(function (x) { return x.s > 0.05; })
      .sort(function (a, b) { return b.s - a.s || a.m.n.localeCompare(b.m.n, "fr"); });
    function prend() {
      while (cand.length) {
        var x = cand.shift();
        if (pris[x.m.un] || (x.m.fam && fams[x.m.fam])) continue;
        pris[x.m.un] = 1;
        if (x.m.fam) fams[x.m.fam] = 1;
        return x.m;
      }
      return null;
    }
    // aura (frame) : d'abord une aura RÉPUTÉE pour l'objectif (liste par nom EN —
    // Growing Power, Physique, Sprint Boost…) ; à défaut, meilleur compromis
    // effet simulé + capacité ajoutée.
    if (slotId === "frame" && !refDe(eq.mods.aura)) {
      var polAura = polDe(slotId, it, eq, "aura");
      var meilleureAura = null;
      (obj.aura || []).some(function (nomEn) {
        var a = D.mods.find(function (m) { return m.c === "AURA" && m.en === nomEn; });
        if (a) { meilleureAura = a; return true; }
        return false;
      });
      if (!meilleureAura) {
        var meilleurScore = -1;
        D.mods.forEach(function (m) {
          if (m.c !== "AURA") return;
          var sc = scoreFx(m.fx || {}, w) * 4 + bonusAura(m, polAura, null) / 10;
          if (sc > meilleurScore) { meilleurScore = sc; meilleureAura = m; }
        });
      }
      if (meilleureAura) eq.mods.aura = { un: meilleureAura.un, rk: null };
    }
    var i;
    for (i = 0; i < 8; i++) {
      if (!refDe(eq.mods.slots[i])) {
        var m8 = prend();
        eq.mods.slots[i] = m8 ? { un: m8.un, rk: null } : eq.mods.slots[i] || null;
      }
    }
    if (!refDe(eq.mods.exilus)) {
      var mx = null;
      if (slotId === "frame") { // exilus frame : mods utilitaires (u) uniquement
        var candX = D.mods.filter(function (m) {
          return m.fx && m.u && !m.st && m.c !== "AURA" && compats.indexOf(m.c) !== -1 && !pris[m.un] && !(m.fam && fams[m.fam]);
        }).map(function (m) { return { m: m, s: scoreFx(m.fx, w) }; }).filter(function (x) { return x.s > 0.05; })
          .sort(function (a, b) { return b.s - a.s || a.m.n.localeCompare(b.m.n, "fr"); });
        mx = candX.length ? candX[0].m : null;
        if (mx) { pris[mx.un] = 1; if (mx.fam) fams[mx.fam] = 1; }
      } else mx = prend();
      if (mx) eq.mods.exilus = { un: mx.un, rk: null };
    }
    // ---- Ajustement de capacité : formas (5 max), puis rangs, puis retrait. ----
    var formasPoses = legaliseCapacite(slotId, w, 5);
    // Fragments d'Archon selon l'objectif (frame seule ; non-Tauforgés, bonus
    // chiffrables). On ne touche jamais des fragments déjà posés sans « remplacer ».
    var fragsPoses = 0;
    if (slotId === "frame" && obj.frags && (ecrase || !(eq.frags || []).some(Boolean))) {
      eq.frags = obj.frags.map(function (fb) { return { c: fb[0], b: fb[1], tau: false }; });
      fragsPoses = eq.frags.length;
    }
    var capFin = capacite(slotId, it, eq);
    return { slot: slotId, nom: it.n, formas: formasPoses, frags: fragsPoses, cap: capFin.used + "/" + capFin.total };
  }
  /* ---- INTELLIGENCE « MÉTA DU SITE » (17/07/2026, demande de l'admin) ------------
     Le build auto ne score plus à l'aveugle : il pioche d'abord dans les 694
     builds du site (data/arsenal_builds.json — la méta distillée des guides et
     retranscriptions vidéo), palier expert, résolus par nom EN comme les
     boutons « Simuler ce palier ». Repli honnête : équipement sans build au
     site (compagnons…) → scoring statistique, annoncé dans la bannière. ---- */
  var BUILDS_SITE = null;
  function chargeBuildsSite() {
    if (BUILDS_SITE) return Promise.resolve(BUILDS_SITE);
    return fetch("/data/arsenal_builds.json").then(function (r) { return r.json(); })
      .then(function (map) { BUILDS_SITE = map; return map; })
      .catch(function () { return null; });
  }
  function entreeSitePour(it) {
    if (!BUILDS_SITE || !it) return null;
    var cle = Object.keys(BUILDS_SITE).find(function (k) {
      return normalize(BUILDS_SITE[k].n) === normalize(it.n);
    });
    return cle ? BUILDS_SITE[cle] : null;
  }
  function resoudModEn(nomEn, slotId, i) {
    var compats = compatPour(slotId, "0");
    var mm = D.mods.find(function (m) {
      if (!m.en || normalize(m.en) !== normalize(nomEn) || m.st) return false;
      if (i === "aura") return m.c === "AURA";
      return m.c !== "AURA" && (i === "x" ? true : compats.indexOf(m.c) !== -1);
    });
    return mm ? { un: mm.un, rk: null } : null;
  }
  // Construit UN équipement depuis le build du site (palier expert).
  // Renvoie null si aucun build au site pour cet équipement.
  function construitDepuisSite(slotId, obj) {
    var it = trouveItem(slotId);
    if (!it) return null;
    var e = entreeSitePour(it);
    if (!e || !e.tiers || !e.tiers.exp) return null;
    var t = e.tiers.exp;
    var eq = eqDe(slotId);
    eq.mods.slots = [null, null, null, null, null, null, null, null];
    eq.mods.exilus = null;
    if (slotId === "frame") eq.mods.aura = null;
    if (t.aura && slotId === "frame") eq.mods.aura = resoudModEn(t.aura, slotId, "aura");
    if (t.exilus) eq.mods.exilus = resoudModEn(t.exilus, slotId, "x");
    (t.mods || []).slice(0, 8).forEach(function (n, i) { eq.mods.slots[i] = resoudModEn(n, slotId, i); });
    var formasPoses = legaliseCapacite(slotId, poidsPour(slotId, obj), 5);
    // fragments selon l'objectif (comme le mode scoring — frame seulement)
    var fragsPoses = 0;
    if (slotId === "frame" && obj.frags && !(eq.frags || []).some(Boolean)) {
      eq.frags = obj.frags.map(function (fb) { return { c: fb[0], b: fb[1], tau: false }; });
      fragsPoses = eq.frags.length;
    }
    var capFin = capacite(slotId, it, eq);
    return { slot: slotId, nom: it.n, formas: formasPoses, frags: fragsPoses,
      cap: capFin.used + "/" + capFin.total, source: "site" };
  }
  /* Adaptation ÉLÉMENTAIRE à la faction de la cible (armes seulement).
     Table vérifiée sur le wiki officiel (page Damage, 17/07/2026) :
     Grineer → Corrosif (électricité+toxine) · Corpus → Magnétique (froid+
     électricité) · Infesté → Chaleur · Corrompu/Orokin → Viral (froid+toxine)
     · Murmure → Radiation (chaleur+électricité) · Techrot : non documenté →
     PAS d'adaptation (annoncé). L'ordre des 2 mods posés est consécutif :
     la combinaison se forme comme en jeu. */
  var FAC_ELEMS = {
    grineer: { els: ["electricity", "toxin"], n: T("Corrosif", "Corrosive") },
    corpus: { els: ["cold", "electricity"], n: T("Magnétique", "Magnetic") },
    infeste: { els: ["heat"], n: T("Chaleur", "Heat") },
    corrompu: { els: ["cold", "toxin"], n: "Viral" },
    murmure: { els: ["heat", "electricity"], n: "Radiation" },
    techrot: { els: ["cold", "electricity"], n: T("Magnétique", "Magnetic") },
  };
  function adapteElements(slotId, fac) {
    var regle = FAC_ELEMS[fac];
    var it = trouveItem(slotId);
    if (!regle || !it) return null;
    var eq = eqDe(slotId);
    var compats = compatPour(slotId, "0");
    var dejaFam = {};
    (eq.mods.slots || []).concat([eq.mods.exilus]).map(refDe).filter(Boolean).forEach(function (r) {
      var m = modParUn(r.un);
      if (m && m.fam) dejaFam[m.fam] = 1;
    });
    // les éléments déjà présents dans les mods posés
    var presents = {};
    (eq.mods.slots || []).map(refDe).filter(Boolean).forEach(function (r) {
      var m = modParUn(r.un);
      var fx = m && m.fx || {};
      Object.keys(fx).forEach(function (k) { if (k.indexOf("e_") === 0) presents[k.slice(2)] = 1; });
    });
    var manquants = regle.els.filter(function (el) { return !presents[el]; });
    if (!manquants.length) return regle.n; // le build les a déjà
    // meilleur mod élémentaire PUR simulé pour chaque élément manquant
    function meilleurElem(el) {
      var cand = D.mods.filter(function (m) {
        return m.fx && m.fx["e_" + el] && !m.st && m.c !== "AURA" &&
          compats.indexOf(m.c) !== -1 && !(m.fam && dejaFam[m.fam]);
      }).sort(function (a, b) { return (b.fx["e_" + el] || 0) - (a.fx["e_" + el] || 0); });
      return cand[0] || null;
    }
    // pose dans les DERNIERS emplacements, consécutifs (l'ordre fait le combo)
    var pose = 0;
    for (var k = 0; k < manquants.length; k++) {
      var m2 = meilleurElem(manquants[k]);
      if (!m2) continue;
      var idx = 7 - (manquants.length - 1 - k);
      eq.mods.slots[idx] = { un: m2.un, rk: null };
      if (m2.fam) dejaFam[m2.fam] = 1;
      pose++;
    }
    if (pose) legaliseCapacite(slotId, poidsPour(slotId, OBJECTIFS.equilibre), 5);
    return pose || Object.keys(presents).length ? regle.n : null;
  }

  /* Arcanes par objectif (17/07/2026, demande de l'admin) — noms vérifiés dans les
     données réelles (30 arcanes de frame FR, 37 d'armes). Deux emplacements de
     frame + un par arme. Effets non additionnés aux chiffres (honnêteté
     inchangée — Merciless/Deadhead/Dexterity restent opt-in « stacks max »). */
  var ARC_OBJ = {
    degats:   { frame: ["Arcane Furie", "Arcane Awakening"], armes: { Primary: "Primary Merciless", Secondary: "Secondary Merciless", Melee: "Melee Crescendo" } },
    statut:   { frame: ["Arcane Furie", "Arcane Rage"], armes: { Primary: "Primary Merciless", Secondary: "Secondary Merciless", Melee: "Melee Influence" } },
    survie:   { frame: ["Arcane Gardien", "Arcane Grâce"], armes: { Primary: "Primary Merciless", Secondary: "Secondary Fortifier", Melee: "Melee Fortification" } },
    pouvoirs: { frame: ["Arcane Énergétique", "Arcane Élan"], armes: { Primary: "Primary Merciless", Secondary: "Secondary Merciless", Melee: "Melee Crescendo" } },
    vitesse:  { frame: ["Arcane Conséquence", "Arcane Agility"], armes: { Primary: "Primary Dexterity", Secondary: "Secondary Dexterity", Melee: "Melee Careen" } },
    equilibre:{ frame: ["Arcane Gardien", "Arcane Furie"], armes: { Primary: "Primary Merciless", Secondary: "Secondary Merciless", Melee: "Melee Crescendo" } },
  };
  // Pose les arcanes de l'objectif (frame : 2 ; arme : 1).
  // ecrase=false : ne remplace jamais une arcane déjà choisie par la joueuse.
  function poseArcanes(slotId, objK, ecrase) {
    var regle = ARC_OBJ[objK] || ARC_OBJ.equilibre;
    var it = trouveItem(slotId);
    if (!it) return 0;
    var eq = eqDe(slotId);
    eq.arcanes = eq.arcanes || [null, null];
    var poses = 0;
    if (slotId === "frame") {
      regle.frame.forEach(function (nom, k) {
        if (!ecrase && eq.arcanes[k]) return;
        var a = D.arcanes.find(function (x) { return x.n === nom; });
        if (a && a.un) { eq.arcanes[k] = a.un; poses++; }
      });
      return poses;
    }
    if (slotId === "primaire" || slotId === "secondaire" || slotId === "melee") {
      if (!ecrase && eq.arcanes[0]) return 0;
      var cls = slotId === "primaire" ? "Primary" : slotId === "secondaire" ? "Secondary" : "Melee";
      var aw = (D.arcArmes || []).find(function (x) { return x.n === regle.armes[cls]; });
      if (aw) { eq.arcanes[0] = aw.un; poses++; }
    }
    return poses;
  }

  function hasard(liste) { return liste[Math.floor(Math.random() * liste.length)]; }
  // « Remplir » : équipement MÉTA de l'objectif, résolu par nom exact dans les
  // données ; si aucun nom ne résout (données changées), repli honnête au hasard.
  function itemMeta(liste, noms) {
    var trouves = (noms || []).map(function (n) {
      return liste.find(function (x) { return x.n === n; });
    }).filter(Boolean);
    return trouves.length ? hasard(trouves) : hasard(liste);
  }
  function ouvreAuto() {
    picker.hidden = false;
    var opts = Object.keys(OBJECTIFS).map(function (k) {
      return '<label style="display:block;padding:7px 4px;border-bottom:1px solid var(--aline,#232c3d);cursor:pointer">' +
        '<input type="radio" name="ars-obj" value="' + k + '"' + (k === "degats" ? " checked" : "") + "> <b>" + OBJECTIFS[k].n + "</b>" +
        ' <span class="muted">— ' + OBJECTIFS[k].d + "</span></label>";
    }).join("");
    var aCible = !!(etat.cible && etat.cible.fac && FAC_ELEMS[etat.cible.fac]);
    picker.innerHTML = '<div class="ars-pk-bd"></div><div class="ars-pk-box"><div class="ars-pk-top"><b>' +
      T("Build auto — choisis l'objectif", "Auto-build — pick a goal") +
      '</b><button class="ars-pk-x" aria-label="' + T("Fermer", "Close") + '">×</button></div>' +
      '<div class="ars-pk-liste" style="padding:12px">' +
      '<p style="margin:0 0 4px"><b>' + T("Intelligence", "Intelligence") + "</b></p>" +
      '<label style="display:block;padding:4px 4px"><input type="radio" name="ars-src" value="site" checked> ' +
      T("Builds du site (recommandé) — la méta des guides, palier expert", "Site builds (recommended) — the guides' meta, expert tier") + "</label>" +
      '<label style="display:block;padding:4px 4px"><input type="radio" name="ars-src" value="stats"> ' +
      T("Scoring statistique — assemble selon l'objectif seul", "Statistical scoring — assembles from the goal alone") + "</label>" +
      '<label style="display:block;padding:8px 4px 10px"' + (aCible ? "" : ' class="muted"') + '><input type="checkbox" id="ars-auto-elems"' + (aCible ? " checked" : " disabled") + "> " +
      (aCible
        ? T("Adapter les éléments des armes à la cible (", "Match weapon elements to the target (") + esc(FACTIONS[etat.cible.fac].n) + " → " + esc((FAC_ELEMS[etat.cible.fac] || {}).n || "") + ")"
        : T("Adapter les éléments à la cible — clique d'abord une faction dans « Efficacité par faction » (Techrot : non documenté, jamais adapté)", "Match elements to the target — click a faction in “Effectiveness by faction” first (Techrot: undocumented, never adapted)")) + "</label>" +
      '<p style="margin:6px 0 4px"><b>' + T("Objectif", "Goal") + "</b> <span class='muted'>" + T("(fragments d'Archon, repli scoring, remplissage)", "(Archon shards, scoring fallback, fill)") + "</span></p>" + opts +
      '<p style="margin:12px 0 4px"><b>' + T("Périmètre", "Scope") + "</b></p>" +
      '<label style="display:block;padding:4px 4px"><input type="radio" name="ars-perim" value="sel" checked> ' + T("L'équipement affiché seulement", "The displayed equipment only") + "</label>" +
      '<label style="display:block;padding:4px 4px"><input type="radio" name="ars-perim" value="tous"> ' + T("Tout ce qui est équipé", "Everything equipped") + "</label>" +
      '<label style="display:block;padding:4px 4px"><input type="radio" name="ars-perim" value="remplir"> ' + T("Tout + remplir les emplacements vides au hasard", "Everything + fill empty slots at random") + "</label>" +
      '<label style="display:block;padding:10px 4px 4px"><input type="checkbox" id="ars-auto-ecrase" checked> ' + T("Remplacer les mods déjà posés", "Replace mods already equipped") + "</label>" +
      '<p class="muted" style="font-size:.8rem;margin:10px 0 6px">' +
      T("Choisit uniquement parmi les mods aux effets simulés et pose les 5 fragments d'Archon selon l'objectif ; arcanes posées selon l'objectif (jamais additionnées aux chiffres) ; postures non touchées. « Remplir » choisit des équipements réputés (pas du hasard). Capacité toujours respectée (formas posés automatiquement, 5 max). Ctrl+Z pour annuler.",
        "Picks only among mods with simulated effects and sets the 5 Archon Shards to match the goal; arcanes set by goal (never added to the numbers); stances left alone. “Fill” picks well-known equipment (not random). Capacity always respected (formas placed automatically, 5 max). Ctrl+Z to undo.") + "</p>" +
      '<p style="text-align:right"><button class="ars-tri" id="ars-auto-go" style="padding:.6rem 1.2rem">' + T("Construire", "Build") + "</button></p></div></div>";
    picker.querySelector(".ars-pk-bd").onclick = picker.querySelector(".ars-pk-x").onclick = function () { picker.hidden = true; };
    document.addEventListener("keydown", function fEsc(e) {
      if (e.key === "Escape") { picker.hidden = true; document.removeEventListener("keydown", fEsc); }
    });
    document.getElementById("ars-auto-go").addEventListener("click", function () {
      var objK = (picker.querySelector('input[name="ars-obj"]:checked') || {}).value || "degats";
      var perim = (picker.querySelector('input[name="ars-perim"]:checked') || {}).value || "sel";
      var srcSite = ((picker.querySelector('input[name="ars-src"]:checked') || {}).value || "site") === "site";
      var adapterEl = !!(document.getElementById("ars-auto-elems") || {}).checked;
      var ecrase = !!document.getElementById("ars-auto-ecrase").checked;
      var obj = OBJECTIFS[objK];
      if (perim === "remplir") {
        var pk = obj.pick || {};
        if (!etat.equip.frame) etat.equip.frame = { un: itemMeta(D.frames, pk.frame).un };
        if (!etat.equip.primaire) etat.equip.primaire = { un: itemMeta(D.armes.Primary, pk.Primary).un };
        if (!etat.equip.secondaire) etat.equip.secondaire = { un: itemMeta(D.armes.Secondary, pk.Secondary).un };
        if (!etat.equip.melee) etat.equip.melee = { un: itemMeta(D.armes.Melee, pk.Melee).un };
        if (!etat.equip.compagnon) etat.equip.compagnon = { un: itemMeta(D.comp.compagnons, pk.comp).un };
      }
      var slots = perim === "sel" ? [etat.sel]
        : slotsActifs().map(function (s) { return s.id; }).filter(function (id) { return trouveItem(id); });
      picker.hidden = true;
      // La méta du site exige arsenal_builds.json (déjà en cache hors-ligne) —
      // chargée à la demande, puis construction synchrone.
      (srcSite ? chargeBuildsSite() : Promise.resolve(null)).then(function () {
        var faits = slots.map(function (id) {
          var r = null;
          if (srcSite) r = construitDepuisSite(id, obj);
          if (!r) { r = construitPour(id, obj, ecrase); if (r) r.source = "stats"; }
          if (r) r.arcanes = poseArcanes(id, objK, ecrase);
          return r;
        }).filter(Boolean);
        if (!faits.length) { alert(T("Équipe d'abord quelque chose (ou choisis « remplir »).", "Equip something first (or pick “fill”).")); return; }
        // adaptation élémentaire des armes à la faction de la cible
        var elemsInfo = null;
        if (adapterEl && etat.cible && etat.cible.fac) {
          ["primaire", "secondaire", "melee"].forEach(function (sl) {
            if (slots.indexOf(sl) !== -1 && trouveItem(sl)) {
              var nEl = adapteElements(sl, etat.cible.fac);
              if (nEl) elemsInfo = nEl;
            }
          });
        }
        cible = null; sauve(); rendTout();
        var n = document.createElement("p");
        n.className = "ars-agg";
        var nbSite = faits.filter(function (f) { return f.source === "site"; }).length;
        n.innerHTML = "<span>⚙ " +
          (nbSite ? T("Build auto — méta du site (palier expert)", "Auto-build — site meta (expert tier)") : T("Build auto « ", "Auto-build “") + esc(obj.n) + (EST_EN ? "”" : " »")) + " : " +
          faits.map(function (f) {
            return esc(f.nom) + " " + f.cap +
              (f.source === "stats" && nbSite ? " <small class='muted'>" + T("(scoring — pas de build au site)", "(scoring — no site build)") + "</small>" : "") +
              (f.formas ? " (" + f.formas + " forma" + (f.formas > 1 ? "s" : "") + ")" : "") +
              (f.frags ? T(" + " + f.frags + " fragments d'Archon", " + " + f.frags + " Archon Shards") : "") +
              (f.arcanes ? " + " + f.arcanes + " arcane" + (f.arcanes > 1 ? "s" : "") : "");
          }).join(" · ") +
          (elemsInfo ? " · " + T("éléments adaptés : ", "elements matched: ") + esc(elemsInfo) + " (" + esc(FACTIONS[etat.cible.fac].n) + ")" : "") +
          "</span><span class='muted'>" + T("Ctrl+Z pour annuler", "Ctrl+Z to undo") + "</span>";
        var ancien = root.querySelector(".ars-auto-note");
        if (ancien) ancien.remove();
        n.classList.add("ars-auto-note");
        root.insertBefore(n, root.firstChild);
      });
    });
  }
  var btnAuto = document.getElementById("ars-auto");
  if (btnAuto) btnAuto.addEventListener("click", ouvreAuto);

  /* ---- Annuler (Ctrl+Z + BOUTON visible) : pile d'états ----
     17/07/2026 : le bouton ↩ rend l'annulation possible AU DOIGT (Ctrl+Z
     n'existe pas sur mobile) — il n'apparaît que s'il y a quoi annuler. */
  var pile = [];
  var sauveBrut = sauve;
  sauve = function () {
    var instantane = JSON.stringify(etat);
    if (pile[pile.length - 1] !== instantane) {
      pile.push(instantane);
      if (pile.length > 60) pile.shift();
    }
    sauveBrut();
    majUndo();
  };
  function annule() {
    if (pile.length < 2) return;
    pile.pop();
    etat = JSON.parse(pile[pile.length - 1]);
    cible = null;
    sauveBrut();
    rendTout();
    majUndo();
  }
  var btnUndo = document.getElementById("ars-undo");
  function majUndo() {
    if (btnUndo) btnUndo.hidden = pile.length < 2;
  }
  if (btnUndo) btnUndo.addEventListener("click", annule);
  document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) return;
    if (pile.length < 2) return;
    e.preventDefault();
    annule();
  });

  /* ---- « Retirer les mods » (17/07/2026) — le REMOVE ALL de l'écran du jeu :
     vide les mods de la CONFIG ACTIVE de l'équipement affiché seulement.
     Formas, arcanes et fragments restent (règle du jeu). Annulable. ---- */
  var btnRemoveAll = document.getElementById("ars-removeall");
  if (btnRemoveAll) btnRemoveAll.addEventListener("click", function () {
    var it = trouveItem(etat.sel);
    if (!it) { alert(T("Rien à retirer : aucun équipement affiché.", "Nothing to remove: no equipment displayed.")); return; }
    var eq = eqDe(etat.sel);
    eq.mods = modsVierges();
    cible = null;
    sauve(); rendTout();
  });

  /* ---- v24 : tilt 3D léger des cartes de mods (hologramme du jeu) ----
     Pointeur fin uniquement (jamais au doigt), prefers-reduced-motion respecté,
     rAF throttlé — zéro coût quand rien ne bouge. CSS : --rx/--ry sur .v24. */
  (function () {
    var mFine = window.matchMedia && matchMedia("(pointer:fine)");
    var mRed = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
    if (!mFine || !mFine.matches) return;
    var carte = null, pend = null;
    function applique(e) {
      pend = null;
      if (!carte || (mRed && mRed.matches)) return;
      var r = carte.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      carte.style.setProperty("--ry", (px * 7).toFixed(2) + "deg");
      carte.style.setProperty("--rx", (-py * 7).toFixed(2) + "deg");
    }
    root.addEventListener("pointermove", function (e) {
      var c = e.target && e.target.closest ? e.target.closest(".ars-mod.v24") : null;
      if (c !== carte) {
        if (carte) { carte.style.removeProperty("--rx"); carte.style.removeProperty("--ry"); }
        carte = c;
      }
      if (carte && !pend) pend = requestAnimationFrame(function () { applique(e); });
    });
    root.addEventListener("pointerleave", function () {
      if (carte) { carte.style.removeProperty("--rx"); carte.style.removeProperty("--ry"); carte = null; }
    });
  })();

  /* -------------------------------- Départ -------------------------------- */
  restaure();
  majFiche();   // la fiche vient de l'état : elle ne peut être rendue qu'ici
  chargeTout().then(function () { return chargeSim(); }).then(function () {
    if (simNote) {
      var n = document.createElement("p");
      n.className = "ars-agg";
      n.innerHTML = "<span>📖 " +
        (EST_EN
          ? "“" + esc(simNote.nom) + "” build (" + esc(simNote.tier) + " tier) loaded from the guide"
          : "Build « " + esc(simNote.nom) + " » (palier " + esc(simNote.tier) + ") chargé depuis le guide") + "</span>" +
        (simNote.formas ? "<span>" +
          (EST_EN ? simNote.formas + " forma" + (simNote.formas > 1 ? "s" : "") + " auto-applied (like in game)"
                  : simNote.formas + " forma" + (simNote.formas > 1 ? "s" : "") + " posé" + (simNote.formas > 1 ? "s" : "") + " automatiquement (comme en jeu)") + "</span>" : "") +
        (simNote.manquants.length ? '<span class="bad" title="' + T("Noms non résolus dans la base de mods", "Names not resolved in the mod database") + '">' + T("non trouvés : ", "not found: ") + esc(simNote.manquants.join(", ")) + "</span>" : "");
      root.insertBefore(n, root.firstChild);
    }
    document.getElementById("ars-meta").textContent =
      D.meta.compte.warframes + " Warframes · " +
      (D.meta.compte.primaires + D.meta.compte.secondaires + D.meta.compte.melee) + T(" armes · ", " weapons · ") +
      D.meta.compte.mods + " mods (" + D.meta.compte.modsSimules + T(" aux effets simulés) · données du ", " with simulated effects) · data from ") + D.meta.date;
    rendTout();
    /* /arsenal#biblio : la bibliothèque a enfin une adresse. Ouvert APRÈS
       chargeTout(), sinon nomDeUn() n'aurait aucune donnée à consulter et les
       lignes sortiraient sans nom d'objet. Le motif ne heurte ni #z= ni #b= :
       ceux-là exigent un « = » et un contenu. */
    if (/^#biblio\b/.test(location.hash || "")) ouvreBiblio(true);
  }).catch(function (e) {
    root.innerHTML = '<p class="muted">' + T("Impossible de charger les données de l'arsenal (", "Could not load the arsenal data (") + esc(e.message) + T("). Recharge la page.", "). Reload the page.") + "</p>";
  });
})();
