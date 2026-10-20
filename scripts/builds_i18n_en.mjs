/* ============================================================================
   VoidRelay — textes ANGLAIS du générateur de builds (2026-07-14).
   Séparé de generer_builds.mjs pour ne prendre AUCUN risque sur le rendu FR :
   le générateur importe ce module et produit en/builds/* avec ces chaînes.
   Les noms de mods restent les noms anglais du jeu (identiques aux clés FR).
   ========================================================================== */

export const EFFECTS_EN = {
  // Warframe
  // +100 % au rang max (wiki, vérifié le 20/10/2026) ; avant : +440/+440/+110/+150 %, périmés.
  "Vitality": "+100% Health", "Redirection": "+100% Shield", "Steel Fiber": "+100% Armor",
  "Flow": "+100% Energy Max",
  // Builds propres à Mesa et Excalibur (20/10/2026), valeurs wiki au rang max.
  "Pistol Amp": "aura: +27% pistol damage (squad)", "Narrow Minded": "+99% Duration / −66% Range",
  "Rolling Guard": "3 s invulnerable on dodge (7 s cooldown)", "Equilibrium": "Health orbs +110% Energy, Energy orbs +110% Health",
  "Mesa's Waltz": "Move at 50% speed during Peacemaker", "Chromatic Blade": "+300% Status Chance, element = energy color", "Primed Flow": "+185% Energy Max",
  "Continuity": "+30% Ability Duration", "Primed Continuity": "+55% Ability Duration",
  "Intensify": "+30% Ability Strength", "Umbral Intensify": "+44% Strength (Umbral set bonus)",
  "Umbral Vitality": "+100% Health (Umbral set bonus)",
  "Streamline": "+30% Ability Efficiency", "Stretch": "+45% Ability Range",
  "Archon Stretch": "+45% Range · energy regen on Electricity ability damage",
  "Constitution": "+28% Duration · faster knockdown recovery",
  "Adaptation": "+10% resistance per hit (max 90%) to damage type received",
  "Fleeting Expertise": "+60% Efficiency / −60% Duration",
  "Blind Rage": "+99% Strength / −55% Efficiency",
  "Transient Fortitude": "+55% Strength / −27.5% Duration",
  "Augur Message": "+24% Duration", "Augur Secrets": "+24% Strength", "Augur Pact": "+90% Secondary damage",
  "Cunning Drift": "+15% Range", "Power Drift": "+15% Strength",
  "Energy Siphon": "aura: +0.6 energy/s (squad)", "Steel Charge": "aura: +60% melee damage (squad)",
  // Rifle
  "Serration": "+165% Damage", "Split Chamber": "+90% Multishot",
  "Point Strike": "+150% Critical Chance", "Vital Sense": "+120% Critical Damage",
  "Hellfire": "+90% Heat", "Stormbringer": "+90% Electricity",
  "Cryo Rounds": "+90% Cold", "Primed Cryo Rounds": "+165% Cold", "Infected Clip": "+90% Toxin",
  "Fast Hands": "+30% Reload Speed", "Rupture": "+90% Impact",
  "Malignant Force": "+60% Toxin · +60% Status", "Rime Rounds": "+60% Cold · +60% Status",
  "Hunter Munitions": "30% chance of Slash proc on critical hit",
  "Vile Acceleration": "+90% Fire Rate / −15% Damage",
  "Heavy Caliber": "+165% Damage / reduced accuracy",
  "Galvanized Chamber": "+80% Multishot · +30% per kill (stacks ×5)",
  "Galvanized Aptitude": "+80% Status · on kill: bonus damage per active status",
  "Galvanized Scope": "+120% Crit while aiming · headshot-kill bonus",
  // Shotgun
  "Point Blank": "+90% Damage", "Primed Point Blank": "+165% Damage",
  "Hell's Chamber": "+120% Multishot",
  "Incendiary Coat": "+90% Heat", "Charged Shell": "+90% Electricity",
  "Contagious Spread": "+90% Toxin", "Chilling Grasp": "+90% Cold",
  "Ammo Stock": "+60% Magazine", "Tactical Pump": "+30% Reload",
  "Blaze": "+60% Damage · +60% Heat",
  "Toxic Barrage": "+60% Toxin · +60% Status", "Scattering Inferno": "+60% Heat · +60% Status",
  "Frigid Blast": "+60% Cold · +60% Status",
  "Blunderbuss": "+90% Critical Chance", "Ravage": "+110% Critical Damage", "Primed Ravage": "+165% Critical Damage",
  "Galvanized Hell": "+80% Multishot · +30% per kill (stacks ×5)",
  "Galvanized Savvy": "+80% Status · on kill: bonus damage per active status",
  // Pistol
  "Hornet Strike": "+220% Damage", "Barrel Diffusion": "+120% Multishot",
  "Lethal Torrent": "+60% Fire Rate · +60% Multishot",
  "Pistol Gambit": "+120% Critical Chance", "Primed Pistol Gambit": "+187% Critical Chance",
  "Target Cracker": "+60% Critical Damage", "Primed Target Cracker": "+110% Critical Damage",
  "Convulsion": "+90% Electricity", "Heated Charge": "+90% Heat",
  "Pathogen Rounds": "+90% Toxin", "Deep Freeze": "+90% Cold",
  "Gunslinger": "+72% Fire Rate", "Quickdraw": "+48% Reload", "Slip Magazine": "+30% Magazine",
  "Pistol Pestilence": "+60% Toxin · +60% Status", "Jolt": "+60% Electricity · +60% Status",
  "Galvanized Diffusion": "+80% Multishot · +30% per kill (stacks ×5)",
  "Galvanized Shot": "+80% Status · on kill: bonus damage per active status",
  // Melee
  "Pressure Point": "+120% Melee Damage", "Primed Pressure Point": "+165% Melee Damage",
  "Fury": "+30% Attack Speed",
  "Berserker Fury": "+35% Attack Speed on melee kill (max +70%)",
  "Reach": "+1.1 Range",
  "True Steel": "+60% Critical Chance", "Sacrificial Steel": "+88% Crit (doubled on Heavy Attack)",
  "Organ Shatter": "+90% Critical Damage",
  "Blood Rush": "Crit Chance +40% × combo multiplier",
  "Weeping Wounds": "Status +40% × combo multiplier",
  "Molten Impact": "+90% Heat", "North Wind": "+90% Cold",
  "Fever Strike": "+90% Toxin", "Primed Fever Strike": "+165% Toxin",
  "Volcanic Edge": "+60% Heat · +60% Status", "Vicious Frost": "+60% Cold · +60% Status",
  "Condition Overload": "+80% Melee Damage per status on target",
  // Archwing
  "Rubedo-Lined Barrel": "+220% Damage", "Automatic Trigger": "+90% Fire Rate",
  "Parallax Scope": "increased Critical Chance", "Charged Bullets": "+120% Electricity",
  "Hollowed Bullets": "increased Critical Damage", "Combustion Rounds": "+120% Heat",
  "Modified Munitions": "+60% Status", "Ammo Chain": "+100% Max Ammo",
  "Dual Rounds": "+60% Multishot", "Critical Focus": "increased Crit while aiming",
  "Cutting Edge": "+120% Damage", "Furor": "+60% Attack Speed",
  "Tempered Blade": "increased Critical Chance", "Bleeding Edge": "increased Critical Damage",
  "Sudden Impact": "+120% Impact", "Glacial Edge": "+120% Cold",
  "Searing Steel": "+120% Heat", "Poisonous Sting": "+120% Toxin", "Astral Slash": "+120% Slash",
  // Companions
  "Link Vitality": "+125% of your Warframe's Max Health", "Link Fiber": "+125% of your Warframe's Armor",
  "Animal Instinct": "+30m Loot Radar · +18m Enemy Radar",
  "Primed Animal Instinct": "greatly enlarged loot/enemy radar (Primed)",
  "Fetch": "vacuums loot (13.5m)", "Vacuum": "vacuums loot (13.5m)",
  "Pack Leader": "your melee hits heal the companion",
  "Bite": "+330% crit chance · +220% crit damage (Claws)", "Maul": "+330% Claws melee damage",
  "Savagery": "rushes 8 enemies (10m), knocked down at the end",
  "Hunter Recovery": "your damage heals the companion (30%)",
  "Momentous Bond": "Eximus kill: +120% random element (30s), −18s recovery",
  "Tenacious Bond": "headshot kill: −3s recovery · ×1.2 final crit damage if companion crit > 50%",
  "Duplex Bond": "bond: companion periodically duplicates",
  "Manifold Bond": "precepts apply the weapon's status · kill on 3+ statuses: −3s cooldown",
  "Enhanced Vitality": "+250% companion Health", "Metal Fiber": "+250% companion Armor",
  "Regen": "−20s recovery · 10s invulnerability on revive", "Primed Regen": "−35s recovery · 10s invulnerability on revive",
  "Assault Mode": "the Sentinel attacks nearby enemies",
  "Guardian": "restores your shields when they break",
  "Sanctuary": "shield while you revive allies",
  "Synth Deconstruct": "marked enemies drop health orbs",
  "Synth Fiber": "Health Orbs: +100% companion Armor (12s)",
};

export const FRAME_TIERS_EN = {
  deb: {
    t: "🌱 Beginner", cost: "0–1 forma · market mods, Vor and early planets",
    note: "The universal base: survivability (Vitality/Redirection/Steel Fiber) plus the four ability stats. All of these drop early (some from the market, others from enemies/containers on the first planets) and rank up without a potato.",
  },
  mid: {
    t: "⚙️ Intermediate", cost: "2–3 formas + Orokin Reactor · corrupted mods (Deimos) & Augur sets",
    note: "Push Strength with Blind Rage (Deimos vault runs) offset by Fleeting Expertise. Constitution (Vor's Prize) extends duration. Tune the Strength/Range/Duration balance around your frame's key ability.",
  },
  exp: {
    t: "🔥 Expert", cost: "4–6 formas + possibly an Umbra Forma · Primed mods (Baro), Umbral (The Sacrifice), maxed Arcanes",
    note: "The all-out build: Umbral set (2 pieces are often enough), Primed mods from Baro Ki'Teer, Adaptation (Arbitrations) and an Archon mod (Archon Hunts). Keep an eye on efficiency if you spam abilities.",
  },
};

export const WEAPON_RULES_EN = {
  Rifle: {
    label: "Rifle",
    deb:  { cost: "0–1 forma", note: "Base damage + 2 elements matched to the faction (Corrosive = Electricity+Toxin against Grineer, Magnetic = Cold+Electricity against Corpus shields…)." },
    mid:  { cost: "2–3 formas + catalyst", note: "Split Chamber (multishot) changes everything. The 60/60s (events/syndicates) raise status without sacrificing damage; Hunter Munitions (Ostron bounties) adds Slash procs on crits." },
    exp:  { cost: "4–6 formas + catalyst", note: "Galvanized mods (Arbitrations) that ramp up on kills + Primed from Baro. Weapon arcane: Primary Merciless (or Deadhead if you aim for heads). A good Riven replaces Heavy Caliber." },
  },
  Shotgun: {
    label: "Shotgun",
    deb:  { cost: "0–1 forma", note: "Point Blank + 2 elements for the faction. Blaze (damage + Heat) drops in Defense/Survival." },
    mid:  { cost: "2–3 formas + catalyst", note: "Hell's Chamber (multishot, Tier 3 Defense) is THE shotgun mod. Shotgun 60/60s come from syndicates/events." },
    exp:  { cost: "4–6 formas + catalyst", note: "Primed Point Blank/Ravage from Baro, Galvanized from Arbitrations. Arcane: Primary Merciless. Viral + Heat remains the most versatile combo." },
  },
  Pistol: {
    label: "Sidearm",
    deb:  { cost: "0–1 forma", note: "Hornet Strike first (every rank counts), then 2 elements matched to the faction." },
    mid:  { cost: "2–3 formas + catalyst", note: "Barrel Diffusion (multishot) + Lethal Torrent = the core of every sidearm. 60/60s (Pistol Pestilence/Jolt) via syndicates." },
    exp:  { cost: "4–6 formas + catalyst", note: "Galvanized Diffusion/Shot from Arbitrations, Primed from Baro. Arcane: Secondary Merciless — or Secondary Encumber for status weapons." },
  },
  Melee: {
    label: "Melee",
    deb:  { cost: "0–1 forma", note: "Pressure Point + speed (Fury) + 2 elements. Your weapon's stance adds mod capacity — slot it as soon as possible." },
    mid:  { cost: "2–3 formas + catalyst", note: "Blood Rush + Weeping Wounds (Deimos missions/derivatives): crit and status explode with the combo counter. Berserker Fury for speed." },
    exp:  { cost: "4–6 formas + catalyst", note: "Condition Overload multiplies damage per status on the target. Arcane: Melee Influence (Electricity) or Melee Duplicate. A well-rolled melee Riven replaces an element." },
  },
  "Arch-Gun": {
    label: "Arch-gun",
    deb:  { cost: "0–1 forma", note: "Arch-gun mods: Archwing missions and Fortuna's Profit-Taker. Rubedo-Lined Barrel = the Archwing « Serration »." },
    mid:  { cost: "2 formas + catalyst", note: "Dual Rounds (multishot) and Critical Focus complete the core. Usable on the ground via the Gravimag (Profit-Taker)." },
    exp:  { cost: "3–4 formas + catalyst", note: "The same core maxed out — Arch-guns have neither Galvanized nor arcanes: the headroom comes from formas and the Arch-gun Riven." },
  },
  "Arch-Melee": {
    label: "Arch-melee",
    deb:  { cost: "0–1 forma", note: "Cutting Edge (damage) + Furor (speed) + elements. Everything drops in Archwing missions." },
    mid:  { cost: "2 formas", note: "Bleeding Edge (crit) joins the core. Arch-melee mostly shines in Empyrean boardings." },
    exp:  { cost: "3 formas + catalyst", note: "Maxed core. No arcanes or Galvanized for Arch-melee — depth comes from formas." },
  },
};

export const TYPE_NOTE_EN = {
  Bow: "Bow: favour crit (Point Strike/Vital Sense) — charged shots crit hard.",
  Sniper: "Sniper: aim for the head; the zoom combo multiplies damage.",
  Launcher: "Launcher: self-damage is reduced but real; Firestorm (radius) is a great 9th pick in the weapon Exilus.",
  "Dual Pistols": "Dual pistols: high fire rate = the 60/60 status mods shine.",
  Throwing: "Thrown weapon: also works in stealth; Concealed Explosives (Baro) is a fun variant.",
};

export const COMP_RULES_EN = {
  "Bête": {
    deb:  { cost: "0–1 forma", note: "Link Health/Armor (inherit YOUR stats), Fetch (loot vacuum) and Pack Leader (heal via your melee): the survival kit of every beast." },
    mid:  { cost: "1–2 formas", note: "Hunter Recovery (Ostron bounties) heals your companion when YOU deal damage. Since Update 37, Bite and Maul go on the Claws (the beast's weapon), not in its mods." },
    exp:  { cost: "2–3 formas", note: "Bond mods (Duviri/Cavia) turn the companion into a real squadmate; Primed Animal Instinct from Baro. Since the companion rework, companions no longer die permanently." },
  },
  "Sentinelle": {
    deb:  { cost: "0–1 forma", note: "Vacuum (loot magnet), Regen (shorter recovery) and base survivability. Guardian recharges YOUR shields." },
    mid:  { cost: "1–2 formas", note: "Primed Regen (Baro): −35s recovery instead of −20s. The Synth set (Simaris) drops health orbs — combo with Equilibrium on your frame." },
    exp:  { cost: "2–3 formas", note: "Bond mods work on Sentinels too; Manifold Bond lets precepts apply the Sentinel weapon's status effects. Remember to mod the Sentinel's WEAPON separately (Serration/Hornet Strike fit there)." },
  },
};

export const SHARD_EN = {
  caster: {
    profil: "Ability caster",
    slots: ["🔴 Crimson — +Ability Strength", "🔴 Crimson — +Ability Strength", "🟡 Amber — +Casting Speed", "🔵 Azure — +Energy Max", "🔵 Azure — +Armor"],
    alt: "Variant: swap an Azure for a 🟣 Violet (Electricity damage → energy gain) if you run Archon Stretch.",
  },
  tank: {
    profil: "Tank / melee brawler",
    slots: ["🔵 Azure — +Armor", "🔵 Azure — +Health", "🔴 Crimson — +Ability Duration", "🟡 Amber — +Health Orb Effectiveness", "🔴 Crimson — +Ability Strength"],
    alt: "Variant: one 🟢 Emerald (+Corrosive damage) if you run Corrosive against armor.",
  },
  fast: {
    profil: "Mobile / skirmisher",
    slots: ["🟡 Amber — +Parkour Velocity", "🔴 Crimson — +Ability Strength", "🔵 Azure — +Health", "🔵 Azure — +Shield Regen", "🔴 Crimson — +Ability Duration"],
    alt: "Variant: double Amber (parkour + casting) for an ultra-nervous playstyle.",
  },
  poly: {
    profil: "All-rounder",
    slots: ["🔴 Crimson — +Ability Strength", "🔵 Azure — +Health", "🔵 Azure — +Armor", "🟡 Amber — +Energy on Spawn", "🔴 Crimson — +Ability Duration"],
    alt: "Tauforged shards give +50%: save them for your main frame.",
  },
};

export const UI_EN = {
  home: "Home", builds: "Builds", breadcrumbBuilds: "Builds",
  the3builds: "The 3 builds",
  jump: ['🌱 Beginner', '⚙️ Intermediate', '🔥 Expert'],
  baseStats: "Base stats", abilities: "Abilities", passive: "Passive:",
  statH: "Health", statS: "Shield", statAr: "Armor", statE: "Energy", statSpd: "Sprint speed", statMr: "Mastery required",
  sheet: "Info", cat: "Category", type: "Type", riven: "Riven disposition",
  catFr: { Primary: "Primary weapon", Secondary: "Secondary weapon", Melee: "Melee" },
  aura: "Aura", exilus: "Exilus", mainMods: "Main mods", arcanes: "Arcanes", claws: "Claws (beast weapon, since Update 37)",
  shards: (p) => `Archon Shards — 5 slots (profile: ${p})`,
  costDebW: " · early-planet mods", costMidW: " · syndicate 60/60s, common rares", costExpW: " · Galvanized (Arbitrations), Primed (Baro), Riven",
  costDebC: " · common drop mods", costExpC: " · Bond mods (Cavia) + Primed (Baro)",
  disclaimer: "⚠️ « Evergreen » builds generated per archetype — the meta evolves. Adjust to the mods, arcanes and shards you own. All 3 tiers only use real in-game mods.",
  allBuilds: "← All builds", sheetOf: "sheet", itemPrices: "Item prices",
  priceOfSet: (n) => `💰 ${n} set price`, priceOf: (n) => `💰 ${n} price`,
  midArcanes: ["Arcane Guardian", "Arcane Nullifier"],
  expArcanes: ["Arcane Energize", "Arcane Grace (or Molt Augmented)"],
  heroFrame: (mr) => `◈ Warframe · MR ${mr}`, heroFramePrime: (mr) => `◈ Prime Warframe · MR ${mr}`,
  heroWeapon: (label, mr) => `⚔ ${label} · MR ${mr}`,
  heroComp: (k) => `🐾 Companion · ${k === "Bête" ? "Beast" : "Sentinel"}`,
  weaponRole: (cat) => `${cat} — 3 mod tiers, from your first forma to the all-out build.`,
  titleFrame: (n) => `${n} Warframe build: beginner, intermediate, expert | VoidRelay`,
  descFrame: (n) => `${n} build in 3 tiers: mods to start with no resources, an intermediate setup, and an expert build with Primed/Umbral mods, arcanes and the 5 Archon Shard slots.`,
  titleWeapon: (n) => `${n} Warframe build: beginner, intermediate, expert | VoidRelay`,
  descWeapon: (n, label) => `${n} build (${label}) in 3 tiers: accessible starter mods, an intermediate tier, and an expert build (Galvanized/Primed + weapon arcane).`,
  titleComp: (n) => `${n} (companion) Warframe build: beginner to expert | VoidRelay`,
  descComp: (n, k) => `${n} build (${k === "Bête" ? "beast" : "sentinel"}) in 3 tiers: accessible survivability and utility, then Bond and Primed mods for an expert companion.`,
};
