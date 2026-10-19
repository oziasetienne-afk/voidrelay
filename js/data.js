/* Utilitaires + données statiques du site */
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
/* N'autorise que des URL sûres (http(s), lien interne #/…, chemin relatif). Rejette
   javascript:, data:, vbscript:, etc. À combiner avec esc() pour l'attribut HTML. */
function safeUrl(u){
  u=String(u==null?"":u).trim();
  if(/^(https?:\/\/|\/|#|\.\/|\.\.\/|[\w./-]+$)/i.test(u) && !/^\s*(javascript|data|vbscript|file):/i.test(u)) return u;
  return "";
}
function slug(name){return name.trim().toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");}
function sellPrice(median){return Math.max(1,Math.round(median*0.85));} // ~15% sous le médian = vente rapide
/* Encodage base64url (sûr pour une URL/hash) — pour partager un build via lien. */
function b64e(s){try{return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}catch(e){return "";}}
function b64d(s){try{return decodeURIComponent(escape(atob(String(s).replace(/-/g,"+").replace(/_/g,"/"))));}catch(e){return "";}}

/* Thèmes d'accent (couleur) inspirés des factions / Warframes. [label, accent, accent2, indigo]. */
const ACCENTS={
 tenno:["Tenno","#38bdf8","#7dd3fc","#818cf8"],
 grineer:["Grineer","#f97316","#fb923c","#f59e0b"],
 corpus:["Corpus","#2dd4bf","#5eead4","#22d3ee"],
 infeste:["Infesté","#a3e635","#bef264","#84cc16"],
 orokin:["Orokin","#eab308","#facc15","#fbbf24"],
 void:["Void","#a78bfa","#c4b5fd","#8b5cf6"],
 ember:["Ember","#fb7185","#fca5a5","#f97316"],
 frost:["Frost","#60a5fa","#93c5fd","#38bdf8"],
 saryn:["Saryn","#a3e635","#86efac","#a78bfa"],
};

/* Listes suivies par le scanner de marché (url_name warframe.market) */
const WATCH={
  warframes:["ash_prime_set","atlas_prime_set","banshee_prime_set","baruuk_prime_set","chroma_prime_set",
    "ember_prime_set","equinox_prime_set","frost_prime_set","gara_prime_set","garuda_prime_set","gauss_prime_set",
    "grendel_prime_set","harrow_prime_set","hydroid_prime_set","inaros_prime_set","khora_prime_set","limbo_prime_set",
    "loki_prime_set","mag_prime_set","mesa_prime_set","mirage_prime_set","nekros_prime_set","nezha_prime_set",
    "nidus_prime_set","nova_prime_set","nyx_prime_set","oberon_prime_set","octavia_prime_set","protea_prime_set",
    "revenant_prime_set","rhino_prime_set","saryn_prime_set","titania_prime_set","trinity_prime_set","valkyr_prime_set",
    "vauban_prime_set","volt_prime_set","wisp_prime_set","wukong_prime_set","zephyr_prime_set"],
  primary:["soma_prime_set","boltor_prime_set","braton_prime_set","burston_prime_set","latron_prime_set",
    "paris_prime_set","tigris_prime_set","sybaris_prime_set","vectis_prime_set","rubico_prime_set","baza_prime_set",
    "tenora_prime_set","stradavar_prime_set","corinth_prime_set","astilla_prime_set","panthera_prime_set"],
  secondary:["lex_prime_set","vasto_prime_set","akbolto_prime_set","aklex_prime_set","akstiletto_prime_set",
    "aksomati_prime_set","akjagara_prime_set","akbronco_prime_set","magnus_prime_set","pandero_prime_set",
    "zakti_prime_set","spira_prime_set","hikou_prime_set","ballistica_prime_set","bronco_prime_set"],
  melee:["bo_prime_set","fang_prime_set","ankyros_prime_set","dakra_prime_set","orthos_prime_set","reaper_prime_set",
    "scindo_prime_set","fragor_prime_set","nikana_prime_set","dual_kamas_prime_set","galatine_prime_set",
    "destreza_prime_set","kronen_prime_set","venka_prime_set","nami_skyla_prime_set","redeemer_prime_set",
    "gram_prime_set","tipedo_prime_set","guandao_prime_set","glaive_prime_set"],
  arcanes:["arcane_energize","arcane_grace","arcane_guardian","melee_duplicate","arcane_steadfast",
    "magus_repair","magus_lockdown","arcane_aegis","arcane_velocity","molt_vigor","arcane_avenger","arcane_blessing"],
  mods:["primed_continuity","primed_flow","primed_pressure_point","primed_reach","primed_fury",
    "primed_animal_instinct","blind_rage","transient_fortitude","narrow_minded","fleeting_expertise",
    "overextended","hunter_munitions","blood_rush","weeping_wounds","condition_overload","galvanized_aptitude",
    "galvanized_chamber","galvanized_diffusion","vigilante_armaments","argon_scope","bladed_rounds","hornet_strike"],
};
const CAT_LABEL={warframes:"Warframes",primary:"Armes principales",secondary:"Armes secondaires",melee:"Mêlée",arcanes:"Arcanes",mods:"Mods"};

/* Contenu du guide platine */
const GUIDE=[
  {id:"intro",title:"La vérité d'abord",blocks:[
    {p:"Pas de bouton magique ni de record plat/heure officiel. Les vrais jackpots sont des ventes UNIQUES : un god roll de Riven (500 – 2 000, jusqu'à 5 000-8 000+ PL) ou un arcane maxé. Pour un vétéran, l'edge n'est pas de farmer plus vite mais de TRADER MALIN : timing du marché + Rivens."}]},
  {id:"vault",title:"1. Arbitrage Vaultage / Prime Resurgence (meilleur ROI)",blocks:[
    {ul:["Stocke les pièces dorées RARES + sets AVANT l'annonce de vault, vends dans le pic (+300 à +700 %).",
      "2ᵉ fenêtre 3-6 mois après, quand le stock de reliques s'épuise.",
      "Prime Resurgence : vends AVANT qu'une frame revienne (prix crash), achète pendant, garde pour après."]},
    {warn:"Les pics légendaires sont morts (Prime Resurgence plafonne tout). Top sets vaultés PC = 60-110 PL aujourd'hui. Une nouvelle Prime Access crashe la frame précédente."}]},
  {id:"rivens",title:"2. Rivens (le plafond maximum)",blocks:[
    {ul:["Flip (sûr) : achète sous-coté, revends. 50-300 PL/flip, faible variance = meilleur plat/h stable.",
      "Roll (loterie) : riven non-roll 50-100p sur arme MÉTA, farm Kuva, reroll. God 2000-3500, mega-god 5000+.",
      "Kuva : Kuva Floods (~1200/run) + Survie Kuva (Taveuni) + Booster ×2 + Smeeta Kavat. Roll au cap = 3500 kuva."]},
    {warn:"Dispositions rééquilibrées à CHAQUE Prime Access → un riven peut perdre sa valeur du jour au lendemain. Prix affiché ≠ prix vendu (vérifie les ventes closes)."}]},
  {id:"prime",title:"3. Trading de sets Prime (revenu régulier)",blocks:[
    {ul:["Farm reliques vite : Hepit (Lith), Ukko (Neo), Apollo/Lua Disruption (Axi). Raffine en Radieuse, radshare à 4, vends les SETS complets.",
      "~50-150 PL/h. La vraie limite = le temps de vente, pas le farm.",
      "Pièces communes : convertis-les en ducats plutôt que brader à 2 PL."]}]},
  {id:"baro",title:"4. Ducats → Flip Baro Ki'Teer",blocks:[
    {ul:["Vends les pièces junk dorées (100 ducats), stocke jusqu'au cap de 5000.",
      "Baro (~tous les 15j) : achète Mods Primed + armes Prisma/Vandal, revends après son départ. Ex : Quanta Vandal 50p → 200p."]},
    {warn:"Capital gelé des semaines. Ne flippe PAS ses cosmétiques. Garde crédits+ducats prêts."}]},
  {id:"arcanes",title:"5. Arcanes (secondaire)",blocks:[
    {p:"Piège : les vieux guides mentent. Energize n'est plus à 350p mais ~100p."},
    {ul:["Melee Duplicate ~215 PL (Netracells / Deep Archimedea)","Arcane Steadfast ~175 PL (SP Captain Vor, Mirror Defense)",
      "Energize/Grace ~100 PL (Capture Hydrolyst)"]},
    {p:"Fais tes Netracells CHAQUE semaine = le meilleur platine-arcane du jeu, sans effort."}]},
  {id:"planning",title:"Planning hebdo (5-7h/sem)",blocks:[
    {p:"Rappel : un échange se conclut UNIQUEMENT en ligne (connecté + « ingame »). L'annonce est une vitrine ; réserve un BLOC TRADING par session."},
    {ul:["Hebdo bloquées (~1h30) : Netracells ×5, Deep Archimedea, Chasse Archon.",
      "Session 1 : hebdo + farm reliques → bloc trading (liste + conclus au Dojo).",
      "Session 2 : Deep Archimedea + radshare ciblé → bloc trading (flip rivens + sets).",
      "Session 3 : reliques→ducats + veille vault → grosse session de vente / Maroo's le week-end.",
      "Objectif : ~300-600+ platine/semaine + pics rivens/vault."]}]},
  {id:"pieges",title:"Pièges & arnaques",blocks:[
    {warn:"Aucun « glitch pour doubler ton platine » n'existe : 100 % arnaque."},
    {ul:["N'achète jamais de plat pas cher hors boutique officielle (récupéré ensuite + risque de ban).",
      "Re-vérifie la fenêtre de trade avant CHAQUE Accepter (swap de dernière seconde).",
      "Trade dans ton Dojo (plus sûr que Maroo's)."]}]},
  {id:"outils",title:"Outils des top traders",blocks:[
    {ul:["warframe.market (+ API, onglet Stats pour volume/historique).","riven.market (enchères rivens).",
      "AlecaFrame (overlay : note tes rivens + prix suggéré + listing 1-clic).","Extension WFM Price History (graphiques + alertes)."]}]},
];

/* ---- Builds par SITUATION (façon PandaaHH). Noms de mods en anglais (standard du jeu). ---- */
const SH_STR="Force des capacités (ambre, Tauforged si possible)";
const BUILDS={
frames:[
 {name:"Rhino Prime",role:"Tank facile — parfait pour débuter (Iron Skin)",tip:"Cast Iron Skin TÔT (avant de prendre des coups). Roar (3) = énorme buff de dégâts pour l'équipe.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Steel Fiber","Intensify","Streamline","Continuity","Flow","Redirection","Stretch"],arcanes:["Arcane Guardian"],shards:"—",note:"Iron Skin (2) encaisse tout. Simple et increvable."},
   {situ:"Endurance / Polyvalent",mods:["Umbral Vitality","Umbral Intensify","Steel Fiber","Streamline","Primed Continuity","Flow","Stretch","Augur Reach"],arcanes:["Arcane Guardian","Arcane Grace"],shards:"2-3 Armure + 2 "+SH_STR,note:"Aura Steel Charge, Exilus Cunning Drift. Tient sur la durée en Steel Path."},
   {situ:"Anti-Boss (Roar)",mods:["Umbral Vitality","Umbral Intensify","Blind Rage","Transient Fortitude","Primed Continuity","Streamline","Augur Secrets","Steel Fiber"],arcanes:["Arcane Guardian"],shards:"4-5 "+SH_STR,note:"Force max → Roar booste massivement les dégâts (toi + équipe) sur le boss."}]},
 {name:"Saryn Prime",role:"Nuke de zone (efface les salles)",tip:"Spore (1) + Toxic Lash (2) pour propager, Miasma (4) pour finir. La PORTÉE prime.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Stretch","Intensify","Continuity","Streamline","Flow","Transient Fortitude","Redirection"],arcanes:["Arcane Guardian"],shards:"—",note:"Propage les Spores avec Toxic Lash, déclenche Miasma sur les paquets."},
   {situ:"Endurance / Steel Path",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Transient Fortitude","Primed Continuity","Streamline","Flow"],arcanes:["Arcane Guardian","Arcane Grace"],shards:"2 Vitesse d'incantation + 3 "+SH_STR,note:"Aura Growing Power, Exilus Cunning Drift. ~235% portée pour tout propager."},
   {situ:"Nuke max",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Blind Rage","Primed Continuity","Streamline","Molt Augmented"],arcanes:["Molt Augmented","Arcane Guardian"],shards:"5 "+SH_STR,note:"Force + portée poussées : efface des salles entières d'un coup."}]},
 {name:"Mesa Prime",role:"DPS pistolet auto (Peacemaker)",tip:"L'arme = tes Régulateurs : build-les (cadence/crit/élément). Shooting Gallery (2) anti-étourdissement.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Continuity","Stretch","Intensify","Flow","Fleeting Expertise","Constitution"],arcanes:["Arcane Aegis"],shards:"—",note:"Peacemaker (4) vise tout seul. Reste statique pour tirer."},
   {situ:"DPS / Steel Path",mods:["Umbral Vitality","Umbral Intensify","Fleeting Expertise","Streamline","Constitution","Primed Continuity","Stretch","Mesa's Waltz"],arcanes:["Arcane Velocity","Arcane Avenger"],shards:"2 Efficacité capacités + 2 Force",note:"Mesa's Waltz = bouger en Peacemaker. Riven de Régulateurs conseillé."},
   {situ:"Anti-Boss",mods:["Umbral Vitality","Umbral Intensify","Fleeting Expertise","Streamline","Primed Continuity","Blind Rage","Stretch","Mesa's Waltz"],arcanes:["Arcane Velocity","Arcane Avenger"],shards:"3 Force",note:"Monte la Force pour les dégâts de Peacemaker sur le boss."}]},
 {name:"Wisp Prime",role:"Support/buff + nuke (Helminth)",tip:"Pose toujours tes 3 Reservoirs (motes). Breach Surge (Helminth) = nuke.",
  builds:[
   {situ:"Débutant (support)",mods:["Vitality","Redirection","Stretch","Intensify","Continuity","Streamline","Flow","Augur Reach"],arcanes:["Arcane Guardian"],shards:"—",note:"Reservoirs = buffs vitesse/régen/dégâts pour toute l'équipe."},
   {situ:"Endurance / Buff",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Primed Continuity","Streamline","Flow","Cunning Drift"],arcanes:["Arcane Guardian","Arcane Energize"],shards:"2 Force + 1 Vitesse d'incantation",note:"Augment Fused Reservoir. Aura Coaction Drift pour des buffs d'aura."},
   {situ:"Nuke (Breach Surge)",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Blind Rage","Primed Continuity","Streamline","Fused Reservoir"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"4 "+SH_STR,note:"Helminth Breach Surge + Sol Gate (4) = nuke aveuglant de zone."}]},
 {name:"Khora Prime",role:"Contrôle + BUTIN bonus (farm)",tip:"Strangledome + augment Pilfering = CC ET loot. Whipclaw pour les dégâts.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Stretch","Intensify","Continuity","Streamline","Flow","Steel Fiber","Constitution"],arcanes:["Arcane Guardian"],shards:"—",note:"Strangledome (4) piège les ennemis, Whipclaw (1) les tue."},
   {situ:"FARM (Pilfering)",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Pilfering Strangledome","Streamline","Primed Continuity","Flow"],arcanes:["Arcane Guardian","Arcane Energize"],shards:"2 Force + 2 Portée",note:"Pilfering Strangledome = butin bonus garanti. LE build farm."},
   {situ:"DPS (Whipclaw)",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Pilfering Strangledome","Blind Rage","Primed Continuity","Streamline"],arcanes:["Arcane Avenger","Arcane Guardian"],shards:"3 Force",note:"Whipclaw scale avec portée + crit. Helminth Nourish/Pillage possible."}]},
 {name:"Octavia Prime",role:"Nuke passif + survie (quasi AFK)",tip:"Mallet (1) + Resonator (2) = nuke baladeur. Metronome (3) = invisibilité.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Stretch","Intensify","Continuity","Streamline","Flow","Constitution","Redirection"],arcanes:["Arcane Guardian"],shards:"—",note:"Mallet renvoie les dégâts ennemis = il monte tout seul."},
   {situ:"Endurance / Survie",mods:["Umbral Vitality","Stretch","Augur Reach","Primed Continuity","Streamline","Flow","Intensify","Cunning Drift"],arcanes:["Arcane Guardian","Arcane Energize"],shards:"3 Durée des capacités",note:"Augment Conductor. Beaucoup de durée → Mallet/Metronome tiennent longtemps."},
   {situ:"Nuke (Steel Path)",mods:["Umbral Vitality","Stretch","Augur Reach","Primed Continuity","Streamline","Blind Rage","Constitution","Molt Efficiency"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"2 Durée + 2 Force",note:"Max dégâts Mallet : l'ennemi se tue sur ses propres tirs, même en haut niveau."}]},
 {name:"Revenant Prime",role:"Quasi-immortel + nuke",tip:"Mesmer Skin (2) = invulnérabilité (recast quand les charges baissent). Danse Macabre (4) = nuke.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Continuity","Stretch","Intensify","Flow","Constitution","Redirection"],arcanes:["Arcane Guardian"],shards:"—",note:"Mesmer Skin te rend quasi-invincible."},
   {situ:"Tank immortel",mods:["Umbral Vitality","Stretch","Augur Reach","Primed Continuity","Streamline","Intensify","Flow","Cunning Drift"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"2 Force + 2 Efficacité capacités",note:"Augment Mesmer Shield (partage l'invuln à l'équipe)."},
   {situ:"Nuke (Danse Macabre)",mods:["Umbral Vitality","Stretch","Augur Reach","Blind Rage","Primed Continuity","Streamline","Intensify","Molt Efficiency"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"3 "+SH_STR,note:"Danse Macabre adapte ses éléments — règle selon la faction (Viral conseillé)."}]},
 {name:"Gauss Prime",role:"Vitesse + tank + nuke statut",tip:"Garde la batterie pleine (sprint). Kinetic Plating (2) = tank. Thermal Sunder = nuke statut.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Continuity","Stretch","Intensify","Flow","Constitution","Redirection"],arcanes:["Arcane Aegis"],shards:"—",note:"Batterie pleine = vitesse + résistance via Kinetic Plating."},
   {situ:"Endurance / Tank",mods:["Umbral Vitality","Stretch","Augur Reach","Primed Continuity","Streamline","Intensify","Flow","Cunning Drift"],arcanes:["Arcane Guardian","Arcane Aegis"],shards:"2 Armure + 2 Force",note:"Increvable tant que la batterie monte (sprint/Mach Rush)."},
   {situ:"Nuke statut (Thermal Sunder)",mods:["Umbral Vitality","Stretch","Augur Reach","Blind Rage","Primed Continuity","Streamline","Intensify","Molt Efficiency"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"4 "+SH_STR,note:"Spam Thermal Sunder froid→chaud (Viral/Blast) sur toute la salle."},
   {situ:"Fissures / Vitesse",mods:["Vitality","Streamline","Continuity","Stretch","Intensify","Flow","Constitution","Sprint Boost"],arcanes:["Arcane Aegis"],shards:"Vitesse de course",note:"Mach Rush pour foncer aux objectifs — capture/extermination express."}]},
 {name:"Volt Prime",role:"Vitesse d'équipe + boost dégâts d'armes",tip:"Speed (2) accélère l'équipe. Electric Shield (3) devant un sniper = dégâts décuplés (Eidolons !).",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Continuity","Stretch","Intensify","Flow","Constitution","Redirection"],arcanes:["Arcane Guardian"],shards:"—",note:"Speed + Electric Shield : utile partout dès le début."},
   {situ:"Anti-Boss / Eidolon",mods:["Umbral Vitality","Stretch","Primed Continuity","Streamline","Flow","Intensify","Augur Reach","Cunning Drift"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"2 Force + 2 Vitesse d'incantation",note:"Pose Electric Shield, tire ton sniper à travers : crit énorme sur l'Eidolon."},
   {situ:"Fissures / Vitesse",mods:["Vitality","Streamline","Continuity","Stretch","Intensify","Flow","Constitution","Sprint Boost"],arcanes:["Arcane Guardian"],shards:"Vitesse de course",note:"Speed (2) pour traverser les missions à toute allure."},
   {situ:"Nuke (Discharge)",mods:["Umbral Vitality","Stretch","Augur Reach","Blind Rage","Primed Continuity","Streamline","Intensify","Transient Fortitude"],arcanes:["Arcane Energize"],shards:"3 "+SH_STR,note:"Augment Capacitance (boucliers via Discharge). CC + dégâts de zone."}]},
 {name:"Nova Prime",role:"Accélère/ralentit tout + nuke",tip:"Slow Nova (force basse) = défense facile. Speed Nova (force haute) = farm express.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Continuity","Stretch","Intensify","Flow","Constitution","Redirection"],arcanes:["Arcane Guardian"],shards:"—",note:"Molecular Prime (4) portée max. Force décide vitesse ou ralentissement."},
   {situ:"Slow (Défense/Endurance)",mods:["Umbral Vitality","Stretch","Augur Reach","Overextended","Primed Continuity","Streamline","Flow","Fleeting Expertise"],arcanes:["Arcane Guardian","Arcane Energize"],shards:"2 Portée + 2 Durée",note:"Overextended (force basse) → ennemis 75% plus lents. Top défense/objectif."},
   {situ:"Speed (Farm/Fissures)",mods:["Umbral Vitality","Stretch","Augur Reach","Transient Fortitude","Primed Continuity","Streamline","Intensify","Molt Efficiency"],arcanes:["Arcane Energize"],shards:"3 "+SH_STR,note:"Force haute → ennemis accélérés = farm de reliques/affinité express."}]},
 {name:"Titania Prime",role:"Forme fée ultra-mobile + DPS (Razorwing)",tip:"En Razorwing, build ton FUSIL primaire : c'est lui qui booste tes Dex Pixia. Razorwing Blitz = vitesse folle.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Continuity","Stretch","Intensify","Flow","Redirection","Constitution"],arcanes:["Arcane Guardian"],shards:"—",note:"Razorwing (4) = vol + Dex Pixia. Augment Razorwing Blitz pour la vitesse."},
   {situ:"Anti-Boss / DPS",mods:["Umbral Vitality","Streamline","Primed Continuity","Flow","Intensify","Stretch","Razorwing Blitz","Cunning Drift"],arcanes:["Arcane Energize","Arcane Velocity"],shards:"2 Force + 2 Vitesse d'incantation",note:"Tes Dex Pixia profitent des mods de FUSIL : build-le crit/statut pour le boss."},
   {situ:"Endurance",mods:["Umbral Vitality","Streamline","Primed Continuity","Flow","Intensify","Stretch","Razorwing Blitz","Aviator"],arcanes:["Arcane Guardian","Arcane Aegis"],shards:"2 Armure + 2 Force",note:"Aviator réduit les dégâts en l'air : tu survis en Steel Path."},
   {situ:"Fissures / Vitesse",mods:["Vitality","Streamline","Continuity","Flow","Intensify","Stretch","Razorwing Blitz","Sprint Boost"],arcanes:["Arcane Guardian"],shards:"Vitesse de course",note:"Razorwing + Blitz = la frame la plus rapide pour traverser les missions."}]},
 {name:"Frost Prime",role:"Défense / tank de zone (Snow Globe)",tip:"Snow Globe (3) protège l'objectif et ralentit ; Avalanche (4) gèle et donne de l'armure (augment Icy Avalanche).",
  builds:[
   {situ:"Débutant",mods:["Vitality","Steel Fiber","Streamline","Stretch","Continuity","Flow","Intensify","Redirection"],arcanes:["Arcane Guardian"],shards:"—",note:"Pose Snow Globe sur la cryopode : la défense devient triviale."},
   {situ:"Défense Steel Path",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Primed Continuity","Streamline","Flow","Steel Fiber"],arcanes:["Arcane Guardian","Arcane Grace"],shards:"2 Force + 2 Santé",note:"Gros Globe + Avalanche pour geler/tuer. Augment Icy Avalanche = armure d'équipe."}]},
 {name:"Ember Prime",role:"Nuke de feu (Inferno) + dégâts %",tip:"Le mètre de chaleur (Immolation) booste tes dégâts mais monte le coût ; gère-le. Fire Blast réduit l'armure ennemie.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Stretch","Continuity","Intensify","Flow","Constitution","Redirection"],arcanes:["Arcane Guardian"],shards:"—",note:"Inferno (4) brûle toute la salle. Immolation (2) pour tank + énergie."},
   {situ:"Nuke Steel Path",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Blind Rage","Primed Continuity","Streamline","Fleeting Expertise"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"4 Force des capacités",note:"Fire Blast (3) enlève l'armure, puis Inferno efface. Beaucoup de Force."}]},
 {name:"Inaros Prime",role:"Tank increvable (santé énorme) — idéal débutant",tip:"Réserve de santé colossale, se soigne en exécutant les ennemis affaiblis. Quasi impossible à tuer.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Steel Fiber","Streamline","Stretch","Continuity","Flow","Intensify","Redirection"],arcanes:["Arcane Grace","Arcane Guardian"],shards:"—",note:"Tu survis à tout. Devour (2) immobilise et te soigne."},
   {situ:"Tank Steel Path",mods:["Umbral Vitality","Umbral Fiber","Umbral Intensify","Steel Fiber","Primed Continuity","Streamline","Flow","Augur Reach"],arcanes:["Arcane Grace","Arcane Guardian"],shards:"3 Santé + 2 Armure",note:"Helminth conseillé (Nourish/Gloom ou une capacité de dégâts) : Inaros tank mais manque de dégâts."}]},
 {name:"Nezha Prime",role:"Vitesse + tank (Warding Halo) + nuke (Divine Spears)",tip:"Warding Halo (3) = bouclier increvable peu coûteux. Firewalker (1) pour la vitesse.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Stretch","Continuity","Intensify","Flow","Constitution","Redirection"],arcanes:["Arcane Guardian"],shards:"—",note:"Warding Halo te rend quasi-invincible pour peu d'énergie."},
   {situ:"Polyvalent Steel Path",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Primed Continuity","Streamline","Flow","Blind Rage"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"2 Force + 2 Vitesse d'incantation",note:"Divine Spears (4) cloue et amplifie les dégâts : excellent tank-DPS polyvalent."}]},
 {name:"Protea Prime",role:"Tourelles (Blaze Artillery) + soutien + survie",tip:"Blaze Artillery (2) scale avec le statut de tes armes. Dispensary (1) = munitions/énergie/santé. Temporal Anchor (4) = survie.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Stretch","Continuity","Intensify","Flow","Constitution","Redirection"],arcanes:["Arcane Guardian"],shards:"—",note:"Pose Dispensary pour l'énergie, Blaze Artillery pour les dégâts."},
   {situ:"DPS Steel Path",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Primed Continuity","Streamline","Flow","Blind Rage"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"3 Force des capacités",note:"Amorce le statut avec un secondaire (Kuva Nukor) pour booster les tourelles."}]},
 {name:"Mag Prime",role:"CC + nuke (Magnetize) + loot (Greedy Pull)",tip:"Magnetize (2) crée une bulle qui amplifie énormément tes tirs. Augment Greedy Pull ramène le butin à toi.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Stretch","Continuity","Intensify","Flow","Redirection","Constitution"],arcanes:["Arcane Guardian"],shards:"—",note:"Tire dans la bulle de Magnetize = dégâts décuplés."},
   {situ:"Nuke Steel Path",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Blind Rage","Primed Continuity","Streamline","Fleeting Expertise"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"3 Force des capacités",note:"Polarize (3) déchire boucliers/armure (Corpus/Grineer), puis Magnetize + arme = nuke."}]},
 {name:"Garuda Prime",role:"DPS sanglant + tank régen (Blood Altar)",tip:"Bloodletting (2) convertit ta santé en énergie ; Blood Altar (1) te soigne ; Seeking Talons (4) ouvre les ennemis au statut.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Stretch","Continuity","Intensify","Flow","Redirection","Constitution"],arcanes:["Arcane Guardian"],shards:"—",note:"Plus ta santé est basse, plus tes Talons frappent fort (passif)."},
   {situ:"DPS Steel Path",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Blind Rage","Primed Continuity","Streamline","Flow"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"3 Force des capacités",note:"Seeking Talons amplifie le statut sur les cibles : combo avec un amorceur. Énergie infinie via Bloodletting."}]},
 {name:"Nidus Prime",role:"Tank régénérant (stacks) + CC (Larva) + DPS (Virulence)",tip:"Accumule des stacks de Mutation (Virulence) : increvable et tout est boosté. Larva (2) regroupe les ennemis.",
  builds:[
   {situ:"Débutant",mods:["Vitality","Streamline","Stretch","Continuity","Intensify","Flow","Redirection","Constitution"],arcanes:["Arcane Guardian"],shards:"—",note:"Monte tes stacks avec Virulence (1) sur les paquets ; ils te ressuscitent."},
   {situ:"DPS / Endurance",mods:["Umbral Vitality","Umbral Intensify","Stretch","Augur Reach","Blind Rage","Primed Continuity","Streamline","Flow"],arcanes:["Arcane Energize","Arcane Guardian"],shards:"3 Force des capacités",note:"Larva + Virulence = CC + dégâts. Parasitic Link (3) augmente tes dégâts. Increvable en endurance."}]},
],
weapons:[
 {name:"Torid",role:"Primaire crit/statut, méta du moment",tip:"Active la forme Incarnon, puis Galvanized Aptitude/Chamber + arcane Merciless = montée en flèche par kills.",
  builds:[
   {situ:"Polyvalent",mods:["Serration","Split Chamber","60/60 élément ×2","Point Strike","Vital Sense","Heavy Caliber"],arcanes:["Primary Deadhead"],shards:"—",note:"Bon partout. Tir alterné pour charger la forme Incarnon."},
   {situ:"Steel Path",mods:["Galvanized Aptitude","Galvanized Chamber","60/60 ×2","Vital Sense","Critical Delay","Serration"],arcanes:["Primary Merciless"],shards:"—",note:"Galvanized + Merciless montent en kill-streak. Viral conseillé."},
   {situ:"Crit max",mods:["Riven (CC/CD/Multishot)","Galvanized Chamber","Hunter Munitions","Vital Sense","Critical Delay","éléments faction"],arcanes:["Primary Merciless"],shards:"—",note:"Hunter Munitions = crit converti en saignement (Viral + Saignement)."}]},
 {name:"Glaive Prime",role:"Mêlée — lancer explosif (heavy attack)",tip:"Power Throw + Volatile Quick Return (rebond explosif) + dégâts d'attaque lourde.",
  builds:[
   {situ:"Débutant",mods:["Pressure Point","Organ Shatter","True Steel","éléments","Power Throw","Quick Return"],arcanes:["—"],shards:"—",note:"Lance le glaive : explosion au contact."},
   {situ:"Attaque lourde (méta)",mods:["Killing Blow","Corrupt Charge","Amalgam Organ Shatter","Power Throw","Volatile Quick Return","Primed Pressure Point"],arcanes:["Melee Influence/Duplicate"],shards:"Force de mêlée",note:"Lance → explosion AoE qui efface les salles. Combo Corrupt Charge."},
   {situ:"Steel Path",mods:["Riven (dégâts/attaque lourde)","Killing Blow","Volatile Quick Return","Viral/Heat","Organ Shatter","Power Throw"],arcanes:["Melee Influence"],shards:"Force de mêlée",note:"Influence propage l'électricité entre les ennemis touchés."}]},
 {name:"Kuva Nukor",role:"Secondaire — amorceur de statut (primer)",tip:"Sert d'AMORCEUR : applique le Viral à tout, puis tu nettoies avec ton arme/mêlée principale.",
  builds:[
   {situ:"Polyvalent",mods:["Hornet Strike","Barrel Diffusion","Lethal Torrent","60/60 ×2","Convulsion"],arcanes:["Secondary Deadhead"],shards:"—",note:"Faisceau qui touche plusieurs cibles : Viral en masse."},
   {situ:"Primer (méta)",mods:["Galvanized Shot","Galvanized Diffusion","Viral (2×60/60)","Hornet Strike","Lethal Torrent","Convulsion"],arcanes:["Secondary Deadhead"],shards:"—",note:"Le meilleur amorceur Viral : prépare les cibles pour ton DPS."},
   {situ:"Statut max",mods:["Riven (statut/multishot)","Galvanized Shot","Viral + Heat","Hornet Strike","Lethal Torrent","Pistol Pestilence"],arcanes:["Secondary Deadhead"],shards:"—",note:"Empile le Viral à 10× puis finis avec une grosse arme."}]},
],
};
const OVERFRAME="https://overframe.gg/";
const PANDAAHH="https://warframe.pandaahh.fr/";

/* Templates de DÉPART pour les items sans build détaillé (couverture complète) */
const GEN_FRAME={
  mods:["Vitality","Redirection","Streamline","Flow","Stretch","Continuity","Intensify","Steel Fiber"],
  arcanes:["Arcane Guardian","Arcane Energize"],
  note:"Base solide pour n'importe quelle frame. Adapte ensuite selon le RÔLE : NUKE → +Force (Blind Rage, Umbral Intensify) · CONTRÔLE → +Portée (Augur Reach, Overextended) · BUFF → +Durée (Primed Continuity, Constitution) · SPAM de capacités → +Efficacité (Fleeting Expertise). Exilus: Cunning Drift. Aura: Steel Charge ou Energy Siphon."};
const GEN_WEAPON={
  primary:{mods:["Serration","Split Chamber","Vital Sense","Point Strike (ou Critical Delay)","60/60 élément ×2","Galvanized Aptitude","Galvanized Chamber"],
    arcanes:["Primary Merciless (ou Deadhead)"],
    note:"Base fusil. CRIT → Point Strike + Vital Sense + Hunter Munitions. STATUT → Galvanized Aptitude + multishot. Viral (+ Heat ou Saignement) = la combinaison méta. Adapte l'élément à la faction."},
  secondary:{mods:["Hornet Strike","Barrel Diffusion","Lethal Torrent","Vital Sense","60/60 élément ×2","Galvanized Shot","Galvanized Diffusion"],
    arcanes:["Secondary Merciless (ou Deadhead)"],
    note:"Base pistolet. Sert souvent d'AMORCEUR (applique le Viral à 100% statut), puis tu finis avec une grosse arme. Adapte crit/statut selon l'arme."},
  melee:{mods:["Primed Pressure Point","Sacrificial Steel","Organ Shatter","Blood Rush","Weeping Wounds","Condition Overload","90% élément ×2","Primed Fever Strike"],
    arcanes:["Melee Influence (ou Duplicate)"],
    note:"Base mêlée. Blood Rush + Weeping Wounds montent crit/statut avec le combo. Condition Overload = dégâts qui explosent selon le nombre de statuts sur la cible."}};

/* ---- Idées de Fashion Frame par Warframe (clé = nom de base ; s'applique aussi au Prime) ----
   Idées inspirées de la culture « fashion frame » et des concours officiels (Fashion Frame
   Contests). Ce ne sont PAS des palmarès officiels. Les cosmétiques nommés (casques alt,
   syandanas, skins TennoGen, sets d'armure) sont des exemples réels connus ; à adapter selon
   ce que tu possèdes. Quand un cosmétique précis n'est pas sûr, on reste sur style + palette. */
const FASHION={
 "Ash":["Assassin nocturne : skin Locust/Koga, syandana Uru, palette noir mat & rouge sang, énergie cramoisie.","Shinobi doré (sur Prime) : détails Prime + set d'armure Edo, accents or sur noir."],
 "Atlas":["Golem tellurique : set d'armure lourd + syandana Pakal, palette roche grise & ocre, énergie ambre/lave."],
 "Banshee":["Spectre sonore : silhouette épurée, syandana fin (Igaro), palette blanc os & violet, énergie cyan « onde »."],
 "Baruuk":["Moine du désert : robes beige & or, syandana Repala, énergie blanc apaisé, accents cuivre."],
 "Bonewidow":["Mech-chevalier (Necramech) : Ironbride en avant, plaques sombres & or terni, énergie rouge profond."],
 "Caliban":["Hybride Sentient : palette cuivre oxydé & turquoise, énergie or Sentient, formes anguleuses."],
 "Chroma":["Dragon élémentaire : skin Dynasty + syandana en ailes (Vala), palette assortie à l'élément (rouge feu / bleu givre), pelt coloré."],
 "Citrine":["Joyau cristallin : tons améthyste & rose quartz, énergie scintillante, syandana facetté."],
 "Cyte-09":["Chasseur urbain (1999) : palette militaire kaki & orange signal, accents techniques sobres."],
 "Dagath":["Spectre équestre : palette ossuaire blanc & noir, énergie vert spectral, voiles façon linceul."],
 "Dante":["Érudit-relieur : tons parchemin & encre, or ancien, syandana façon cape/manuscrit."],
 "Ember":["Phénix ardent : casque Phoenix + skin Vermillion, palette braise rouge/orange, énergie feu.","Cendres froides : noir charbon & rouge sombre, énergie braise."],
 "Equinox":["Dualité jour/nuit : palette mi-claire mi-sombre, énergie contrastée (blanc/noir), syandana sobre."],
 "Excalibur":["Chevalier paragon : casque Pendragon + armure assortie, palette argent & bleu royal, énergie dorée.","Proto-Armure rétro (skin Zato/Proto-Armor) : gris métal & accents vifs."],
 "Follie":["Style à composer : choisis un thème cohérent (palette duo + 1 syandana) — frame récent, peu de cosmétiques établis."],
 "Frost":["Givre arctique : casque Squall + skin Harka, palette bleu glacier & blanc, énergie cyan."],
 "Gara":["Verre brisé : skin Glamasz, palette éclats translucides bleu/blanc, énergie prismatique."],
 "Garuda":["Comtesse sanglante : palette rouge sang & noir laqué, syandana en plumes, énergie cramoisie."],
 "Gauss":["Coureur cinétique : palette blanc course & rouge/vert (assortis l'énergie au mode batterie), accents fluo, lignes de vitesse."],
 "Grendel":["Gros dur jovial : tons cuir brun & vert infesté, énergie acide, accents robustes."],
 "Gyre":["Orage néon : palette violet & cyan électrique, énergie arc bleu, finitions chromées."],
 "Harrow":["Prêtre pénitent : armure & syandana façon soutane, palette noir & or liturgique, énergie blanc sacré."],
 "Helminth":["Difforme par nature : joue l'organique — palette chair & rouge infesté, énergie bio (peu de cosmétiques classiques)."],
 "Hildryn":["Colosse Solaris : armure massive, palette acier & orange Vox Solaris, énergie ambre."],
 "Hydroid":["Corsaire des abysses : casque Triton + skin Rakkam, palette bleu marine & laiton, énergie écume."],
 "Inaros":["Pharaon du sable : armure Targis + syandana Asa, palette or & lapis-lazuli, énergie sable."],
 "Ivara":["Archère sylvestre : palette vert forêt & or, syandana léger, énergie ambrée."],
 "Jade":["Archange : palette blanc & or céleste, syandana en ailes, énergie lumineuse."],
 "Khora":["Dompteuse féline : assortis Venari à ta palette, acier & rouge, énergie chaude, lignes nettes."],
 "Koumei":["Oracle du destin : laque rouge & or, motifs façon kimono, énergie dorée, accents traditionnels."],
 "Kullervo":["Maudit vengeur : palette fer rouillé & rouge, syandana en chaînes, énergie sang."],
 "Lavos":["Alchimiste : palette vert poison & cuivre, fioles visibles, énergie toxique changeante."],
 "Limbo":["Magicien du Rift : skin Limina + chapeau/cape, palette noir & blanc « spectacle », énergie violet rift."],
 "Loki":["Filou de l'ombre : casque Swindle, palette gris fumée & vert, énergie discrète, silhouette furtive."],
 "Mag":["Magnéticienne : casque Coil + skin Gauss, palette bleu acier & blanc, énergie magnéta."],
 "Mesa":["Pistolera : skin Presidio, palette cuir désert & rouge, attitude western, énergie laiton."],
 "Mirage":["Arlequin lumineux : casque Harlequin, palette bariolée or & noir, énergie prismatique."],
 "Nekros":["Nécromancien : casque Irkalla, palette os & noir, syandana lugubre, énergie vert mort."],
 "Nezha":["Prince céleste : skin Empyrean, palette rouge & or impérial, rubans, énergie flamme."],
 "Nidus":["Fléau infesté : skin Phryke, palette chair & rouge infesté, énergie organique pulsante."],
 "Nova":["Étoile antimatière : casque Atomica + skin Asuri, palette blanc & rose néon, énergie éclatante."],
 "Nokko":["Style à composer : palette duo nette + 1 syandana cohérent — frame récent, peu de cosmétiques établis."],
 "Nyx":["Esprit télépathe : casque Menticide + skin Nemesis, palette violet & noir, énergie psy."],
 "Oberon":["Paladin sylvestre : casque Feyarch, palette or & vert, syandana noble, énergie sacrée."],
 "Octavia":["Diva musicale : skin Maestra, palette or & noir de scène, énergie « note » colorée."],
 "Oraxia":["Style à composer : thème cohérent (palette + syandana) — frame récent, peu de cosmétiques établis."],
 "Protea":["Ingénieure tactique : palette graphite & or rose, accents tech, énergie ambre, lignes propres."],
 "Qorvex":["Colosse de béton : palette béton gris & jaune radioactif, énergie verte, formes massives."],
 "Revenant":["Spectre Eidolon : palette turquoise Sentient & violet, énergie lumineuse façon Eidolon."],
 "Rhino":["Tank de guerre : casque Vanguard/Thrak + armure lourde, palette acier & rouge, énergie métallique."],
 "Saryn":["Reine des spores : casque Chlora + skin Orphid, palette vert toxique & violet, énergie venimeuse."],
 "Sevagoth":["Faucheur d'ombre : cape/syandana, palette noir brume & cyan spectral, énergie fantôme."],
 "Styanax":["Hoplite : palette bronze & bleu Égée, cape drapée, énergie dorée, accents antiques."],
 "Temple":["Rockstar (1999) : cuir noir & néon, attitude scène, énergie électrique, accents chromés."],
 "Titania":["Fée enchantée : palette pétale rose/vert & or, ailes, énergie scintillante."],
 "Trinity":["Soigneuse clémente : skin Strega, palette blanc & or « médical », syandana sobre, énergie soin."],
 "Uriel":["Style à composer : thème angélique/cohérent (palette claire + syandana) — frame récent, peu de cosmétiques établis."],
 "Valkyr":["Berserker félin : casque Bastet (ou skin Gersemi restauré), palette acier griffé & rouge, énergie rage."],
 "Vauban":["Ingénieur militaire : casque Gambit/Esprit, palette kaki & laiton, énergie technique."],
 "Voidrig":["Mech artilleur (Necramech) : plaques industrielles & orange, énergie ambre, allure de siège."],
 "Volt":["Conducteur électrique : casque Pulse/Storm + skin Zener, palette bleu/cyan & blanc, énergie arc."],
 "Voruna":["Meute lupine : palette fourrure noire & argent, accents lunaires, énergie blanc lune."],
 "Wisp":["Esprit flottant : skin Vela, palette éthérée bleu/violet pâle, énergie lueur douce."],
 "Wukong":["Roi des singes : palette or & rouge impérial, fourrure, énergie dorée, allure de monarque."],
 "Xaku":["Relique du Vide : palette os & cendre, énergie void (violet/turquoise), accents fracturés."],
 "Yareli":["Surfeuse : palette aqua & corail vif, look jeune et fun, énergie eau, Merulina assortie."],
 "Zephyr":["Oiseau-tempête : casque Aithon/Cierzo, palette plumes blanches & ciel, énergie vent."],
};
/* Idée générique si un frame n'est pas (encore) dans FASHION (couverture complète). */
const FASHION_GENERIC=["Compose un look cohérent : 1 set d'armure + 1 syandana assortis au thème du frame, et harmonise la couleur d'énergie avec ta palette dominante (règle des 2-3 couleurs max)."];

/* ---- Spots de ressources (assistant de farm) ----
   Les ressources ne sont pas échangeables → absentes d'items.json. On fournit ici les
   spots les plus connus et stables. Pour le détail exhaustif : drop tables du wiki. */
const RESOURCE_SPOTS={
 "Kuva":["Kuva Siphon & Kuva Flood (alertes, partout sur l'étoile)","Survie Kuva — Taveuni (Kuva Fortress), idéale en continu","Disruption + Smeeta Kavat (booster de butin) pour le rendement"],
 "Endo":["Sculptures Ayatan (chasse hebdo chez Maroo, Bazar de Maroo)","Arbitrages (grosses récompenses d'Endo)","Récompenses de rotation (Défense/Interception)"],
 "Neurodes":["Lua (toutes missions) — drop fréquent","Deimos / Eris (Infesté)","Récompenses de rotation (Défense, Survie)"],
 "Neural Sensors":["Jupiter (Corpus)","Boss Alad V — Themisto (Jupiter)"],
 "Orokin Cell":["Saturn — Helene (Défense)","Boss Lieutenant Lech Kril (Ceres / Mars)","Boss Sargas Ruk (Saturn — Tethys)"],
 "Tellurium":["Missions Archwing (drop direct)","Uranus / Neptune — Salacia (Défense Mobile Archwing)"],
 "Argon Crystal":["N'importe quelle mission du Vide (Void) — ⚠️ se dégrade en 24 h, farme juste avant l'usage"],
 "Oxium":["Ennemis Oxium Osprey (Corpus)","Jupiter — Io (Défense)","Missions Corpus en général"],
 "Nitain Extract":["Offres Nightwave (Cred)","Sorties / récompenses ponctuelles","⚠️ pas farmable en continu"],
 "Cryotic":["Missions d'Excavation — la seule source"],
 "Mutagen Sample":["Eris (Infesté)","Jupiter","Défense de l'Orokin Derelict"],
 "Forma":["Plan via reliques du Vide (Void Relics) — ouvre des reliques","Récompenses d'événements / Baro à l'occasion"],
 "Plastids":["Saturn / Phobos / Uranus","Récompenses de rotation"],
 "Rubedo":["Earth / Sedna / Void","Récompenses de rotation"],
 "Polymer Bundle":["Mercury / Venus / Uranus"],
 "Detonite / Fieldron / Mutagen (composants)":["Invasions (récompenses)","Fabrication via échantillons + recherche de clan"],
};

/* ---- Build planner : base de mods curée (valeurs connues, à jour). ----
   Effets en fraction (0.30 = +30%). Frame : str/dur/range/eff/health/shield/armor.
   Arme : dmg (dégâts base), ms (multishot), cc (chance crit), cd (mult crit),
   status (chance statut), elem (élément % de la base), fr (cadence). */
const PLANNER_MODS={
 frame:[
  {n:"Intensify",e:{str:.30}},{n:"Umbral Intensify",e:{str:.44}},
  {n:"Blind Rage",e:{str:.99,eff:-.55}},{n:"Transient Fortitude",e:{str:.55,dur:-.275}},
  {n:"Augur Secrets",e:{str:.24}},{n:"Power Drift",e:{str:.15}},{n:"Molt Augmented",e:{str:.60},note:"max stacks (60%)"},
  {n:"Stretch",e:{range:.45}},{n:"Augur Reach",e:{range:.30}},{n:"Cunning Drift",e:{range:.15}},
  {n:"Overextended",e:{range:.90,str:-.60}},
  {n:"Continuity",e:{dur:.30}},{n:"Primed Continuity",e:{dur:.55}},{n:"Constitution",e:{dur:.28}},
  {n:"Augur Message",e:{dur:.24}},{n:"Narrow Minded",e:{dur:.99,range:-.66}},
  {n:"Streamline",e:{eff:.30}},{n:"Fleeting Expertise",e:{eff:.60,dur:-.60}},
  {n:"Vitality",e:{health:4.40}},{n:"Umbral Vitality",e:{health:5.50}},
  {n:"Redirection",e:{shield:4.40}},{n:"Primed Redirection",e:{shield:5.40}},
  {n:"Steel Fiber",e:{armor:1.10}},{n:"Umbral Fiber",e:{armor:1.375}},{n:"Armored Agility",e:{armor:.45}},
 ],
 rifle:[
  {n:"Serration",e:{dmg:1.65}},{n:"Heavy Caliber",e:{dmg:1.65},note:"-55% précision (ignorée ici)"},
  {n:"Split Chamber",e:{ms:.90}},{n:"Vigilante Armaments",e:{ms:.60}},
  {n:"Point Strike",e:{cc:1.50}},{n:"Critical Delay",e:{cc:.48,fr:-.36}},
  {n:"Vital Sense",e:{cd:1.20}},
  {n:"Malignant Force",e:{elem:.60,status:.60},el:"Toxique"},{n:"High Voltage",e:{elem:.60,status:.60},el:"Électricité"},
  {n:"Rime Rounds",e:{elem:.60,status:.60},el:"Froid"},{n:"Thermite Rounds",e:{elem:.60,status:.60},el:"Chaleur"},
  {n:"Infected Clip",e:{elem:.90},el:"Toxique"},{n:"Stormbringer",e:{elem:.90},el:"Électricité"},
  {n:"Cryo Rounds",e:{elem:.90},el:"Froid"},{n:"Hellfire",e:{elem:.90},el:"Chaleur"},
  {n:"Galvanized Aptitude",e:{status:.80},note:"+ dégâts/statut sur kill (non calculé)"},
  {n:"Galvanized Chamber",e:{ms:.60},note:"multishot à stacks sur kill (non calculé)"},
  {n:"Hunter Munitions",e:{},note:"~30% des crits → saignement (non calculé)"},
  {n:"Vile Acceleration",e:{fr:.90,dmg:-.15}},
 ],
};
const PLANNER_SLOTS=8; // hors aura/exilus (modèle simplifié)

/* ---- Tâches récurrentes (checklist) ---- */
const TASKS={
 daily:["Sortie du jour","Défis quotidiens Nightwave","Récompense de connexion","Réputation de syndicat","Marché du Vide (Teshin) si Essence d'Acier"],
 weekly:["Netracells ×5 (Sanctum Anatomica)","Archimedea Profonde (Deep Archimedea)","Chasse Archon","Garnison de Kahl (Veilbreaker)","Défis hebdo Nightwave","Le Circuit / Duviri (adaptateurs Incarnon)","Passage de Baro Ki'Teer (tous les 15 j)"],
};

/* ---- Mondes ouverts (open worlds) — données curées & sourcées ----
   Noms propres (mondes, zones, ressources, missions) = identiques FR/EN (jamais traduits).
   Prose (où / notes) = {fr,en}. Chances : sourcées Wiki Warframe + drop tables DE quand publiées ;
   sinon « rareté » indicative (minage/pêche = pools pondérés, pas de % simple).
   Sources par monde dans `src`. Vérifié 2026-06-13. */
const OPEN_WORLDS=[
 {
  id:"plains", name:"Plains of Eidolon", planet:"Terre (Earth)", hub:"Cetus",
  faction:"Ostron · Quills (Eidolons)", vehicle:"Archwing / K-Drive",
  desc:{fr:"Première étendue ouverte (2017). Plaine de jour comme de nuit ; les Eidolons n'apparaissent que la NUIT.",
        en:"The first open landscape (2017). Day & night cycle; Eidolons only spawn at NIGHT."},
  zones:[
   {x:50,y:18,l:"Cetus",t:"hub"},{x:30,y:40,l:"Gara Toht Lake",t:"eidolon"},
   {x:68,y:35,l:"Hek's camps",t:"combat"},{x:24,y:68,l:"The Tomb",t:"cave"},
   {x:75,y:70,l:"Twin Horns",t:"mine"},{x:50,y:55,l:"Plains",t:"open"}
  ],
  missions:[
   {n:"Bounties (Konzu)",d:{fr:"5 paliers, rotations de récompenses (réputation Ostron, mods, pièces).",en:"5 tiers, reward rotations (Ostron standing, mods, parts)."}},
   {n:"Eidolon Hunts",d:{fr:"La NUIT : Teralyst → Gantulyst → Hydrolyst. Donne les Éclats (Shards) d'Eidolon.",en:"At NIGHT: Teralyst → Gantulyst → Hydrolyst. Drops Eidolon Shards."}},
   {n:"Fishing / Mining / Conservation",d:{fr:"Activités libres dans la plaine (poissons, minerais, animaux).",en:"Free activities across the plain (fish, ores, animals)."}},
   {n:"Ghoul Purge",d:{fr:"Bounties événementiels périodiques (Nakak).",en:"Periodic event bounties (Nakak)."}}
  ],
  resources:[
   {n:"Eidolon Shard (Intact/Brilliant/Radiant)",where:{fr:"Capture d'Eidolon (nuit)",en:"Eidolon capture (night)"},rar:"guaranteed",chance:{fr:"Garanti à la capture",en:"Guaranteed on capture"}},
   {n:"Cetus Wisp",where:{fr:"Bord des points d'eau, apparitions de surface (assez rare)",en:"Water edges, surface spawns (fairly rare)"},rar:"rare",chance:{fr:"Apparition de surface — rare",en:"Surface spawn — rare"}},
   {n:"Iradite",where:{fr:"Minage (roches rouges de surface)",en:"Mining (red surface rocks)"},rar:"uncommon",chance:{fr:"Minage",en:"Mining"}},
   {n:"Grokdrul",where:{fr:"Ennemis Grineer + conteneurs",en:"Grineer enemies + containers"},rar:"common",chance:{fr:"Drop ennemis",en:"Enemy drop"}},
   {n:"Maprico",where:{fr:"Arbres fruitiers de la plaine",en:"Fruit trees on the plain"},rar:"common",chance:{fr:"Récolte (plante)",en:"Plant harvest"}},
   {n:"Sentirum / Nyth (gemmes)",where:{fr:"Minage (filons rares)",en:"Mining (rare veins)"},rar:"rare",chance:{fr:"Minage — gemme rare",en:"Mining — rare gem"}}
  ],
  src:["https://wiki.warframe.com/w/Plains_of_Eidolon","https://wiki.warframe.com/w/Eidolon"]
 },
 {
  id:"vallis", name:"Orb Vallis", planet:"Vénus (Venus)", hub:"Fortuna",
  faction:"Solaris United · Vox Solaris", vehicle:"K-Drive / Archwing",
  desc:{fr:"Étendue glaciaire Corpus (2018). Cycle chaud/froid. Deux Orbes géantes à abattre.",
        en:"Corpus glacial landscape (2018). Warm/cold cycle. Two giant Orbs to take down."},
  zones:[
   {x:50,y:16,l:"Fortuna",t:"hub"},{x:30,y:38,l:"Temple of Profit",t:"toroid"},
   {x:70,y:34,l:"Enrichment Labs",t:"toroid"},{x:50,y:50,l:"Spaceport",t:"toroid"},
   {x:24,y:70,l:"Deck 12 (Exploiter)",t:"boss"},{x:76,y:68,l:"Orb caves ×17",t:"cave"}
  ],
  missions:[
   {n:"Bounties (Eudico)",d:{fr:"Paliers de bounties (réputation Solaris United).",en:"Bounty tiers (Solaris United standing)."}},
   {n:"Profit-Taker Orb (Heist)",d:{fr:"4 phases, requiert rang « Old Mate » (Vox Solaris). Donne le Crisma Toroid.",en:"4-phase Heist, requires 'Old Mate' rank (Vox Solaris). Drops the Crisma Toroid."}},
   {n:"Exploiter Orb",d:{fr:"Boss gratuit (Deck 12), pas de rang requis.",en:"Free boss fight (Deck 12), no rank required."}},
   {n:"Fishing (servofish) / Mining / Conservation",d:{fr:"Harpon Solaris + Oxylus pour la pêche ; minage filons rouges/bleus.",en:"Solaris spear + Oxylus for fishing; mine red/blue veins."}}
  ],
  resources:[
   {n:"Sola Toroid",where:{fr:"Temple of Profit (ennemis) · pickups grottes",en:"Temple of Profit enemies · cave pickups"},rar:"rare",chance:{fr:"~20% (Kyta Raknoid)",en:"~20% (Kyta Raknoid)"}},
   {n:"Calda Toroid",where:{fr:"Enrichment Labs (ennemis) · grottes",en:"Enrichment Labs enemies · caves"},rar:"rare",chance:{fr:"~20% (Scyto Raknoid)",en:"~20% (Scyto Raknoid)"}},
   {n:"Vega Toroid",where:{fr:"Spaceport (ennemis) · grottes",en:"Spaceport enemies · caves"},rar:"rare",chance:{fr:"~1% (Mite Raknoid)",en:"~1% (Mite Raknoid)"}},
   {n:"Crisma Toroid",where:{fr:"Profit-Taker (phase 4)",en:"Profit-Taker (phase 4)"},rar:"guaranteed",chance:{fr:"Récompense de Heist",en:"Heist reward"}},
   {n:"Thermal Sludge / Tepa Nodule",where:{fr:"Ennemis & conteneurs de la vallée",en:"Vallis enemies & containers"},rar:"common",chance:{fr:"Drop fréquent",en:"Frequent drop"}},
   {n:"Gorgaricus / Mytocardia Spore",where:{fr:"Plantes des grottes du Vallis",en:"Cave plants in the Vallis"},rar:"uncommon",chance:{fr:"Récolte (plante)",en:"Plant harvest"}}
  ],
  src:["https://wiki.warframe.com/w/Orb_Vallis","https://wiki.warframe.com/w/Toroid"]
 },
 {
  id:"deimos", name:"Cambion Drift", planet:"Deimos", hub:"Necralisk",
  faction:"Entrati · Necraloid", vehicle:"K-Drive / Necramech",
  desc:{fr:"Étendue Infestée/Orokin (2020). Cycle Fass/Vome. Coffres-forts d'Isolation pour les Necramechs.",
        en:"Infested/Orokin landscape (2020). Fass/Vome cycle. Isolation Vaults for Necramech parts."},
  zones:[
   {x:50,y:17,l:"Necralisk",t:"hub"},{x:32,y:40,l:"Isolation Vaults",t:"vault"},
   {x:70,y:38,l:"Cabuchu dens",t:"combat"},{x:28,y:68,l:"Mining veins",t:"mine"},
   {x:74,y:66,l:"Conservation",t:"open"},{x:50,y:54,l:"Drift",t:"open"}
  ],
  missions:[
   {n:"Bounties (Mother)",d:{fr:"5 paliers (réputation Entrati, jetons « Tokens »).",en:"5 tiers (Entrati standing, Tokens)."}},
   {n:"Isolation Vaults + Arcana",d:{fr:"3 niveaux ; pièces de Necramech endommagé & armes ; bounties Arcana.",en:"3 tiers; Damaged Necramech & weapon parts; Arcana bounties."}},
   {n:"Mining / Fishing / Conservation",d:{fr:"Minage filons ; pêche à l'appât (sans harpon) ; tranquillisant.",en:"Vein mining; bait fishing (no spear); tranq conservation."}}
  ],
  resources:[
   {n:"Damaged Necramech parts",where:{fr:"Coffres-forts d'Isolation (Vaults)",en:"Isolation Vaults"},rar:"rare",chance:{fr:"Butin de Vault (table DE)",en:"Vault drop (DE table)"}},
   {n:"Trapsidian / Heciphron (gemmes)",where:{fr:"Minage (filons)",en:"Mining (veins)"},rar:"rare",chance:{fr:"Minage — gemme",en:"Mining — gem"}},
   {n:"Thaumica / Adramalium",where:{fr:"Minage du Drift",en:"Drift mining"},rar:"uncommon",chance:{fr:"Minage — minerai",en:"Mining — ore"}},
   {n:"Necrathene",where:{fr:"Minage (filons profonds)",en:"Mining (deep veins)"},rar:"rare",chance:{fr:"Minage rare",en:"Rare mining"}},
   {n:"Mother/Father/Son/Daughter Tokens",where:{fr:"Échange de ressources auprès des Entrati",en:"Trade resources to the Entrati family"},rar:"uncommon",chance:{fr:"Échange (turn-in)",en:"Turn-in"}},
   {n:"Voidgel Orb / Ganglion",where:{fr:"Bounties & objectifs du Drift",en:"Drift bounties & objectives"},rar:"common",chance:{fr:"Récompense bounty",en:"Bounty reward"}}
  ],
  src:["https://wiki.warframe.com/w/Cambion_Drift","https://wiki.warframe.com/w/Isolation_Vault"]
 },
 {
  id:"duviri", name:"Duviri", planet:"Duviri (paradoxe)", hub:"Teshin's Cave",
  faction:"— (Pathos Clamps)", vehicle:"🐎 Kaithe (monture VOLANTE) + K-Drive",
  desc:{fr:"Royaume du Drifter (2023), cycle des humeurs (Spiral). La monture KAITHE peut VOLER. Source des adaptateurs Incarnon.",
        en:"The Drifter's realm (2023), Spiral of moods. The KAITHE mount can FLY. Source of Incarnon adapters."},
  zones:[
   {x:50,y:15,l:"Teshin's Cave",t:"hub"},{x:25,y:34,l:"Undercroft",t:"vault"},
   {x:73,y:33,l:"Orowyrm arena",t:"boss"},{x:19,y:60,l:"Archarbor",t:"open"},
   {x:50,y:47,l:"Amphitheater",t:"combat"},{x:81,y:58,l:"Kullervo's Hold",t:"combat"},
   {x:42,y:74,l:"The Circuit",t:"vault"}
  ],
  missions:[
   {n:"The Duviri Experience",d:{fr:"Spirale du moment avec objectifs principaux + secondaires (recommandé la 1re fois).",en:"Current mood spiral with main + side objectives (recommended for first-timers)."}},
   {n:"The Lone Story",d:{fr:"Juste l'histoire de la spirale — sans objectifs secondaires ni Décrets.",en:"Just the spiral's story — no side objectives, no Decrees."}},
   {n:"The Circuit",d:{fr:"Endless Warframe dans l'Undercroft ; rotation HEBDO d'adaptateurs Incarnon (paliers 5 & 10). Acier : ennemis +20 niv.",en:"Endless Warframe in the Undercroft; WEEKLY Incarnon adapter rotation (tiers 5 & 10). Steel Path: enemies +20 lvl."}},
   {n:"Orowyrm (boss)",d:{fr:"Combat final de spirale (aérien sur Kaithe) → Pathos Clamps, Intrinsics, Décret rare.",en:"Final spiral fight (aerial on Kaithe) → Pathos Clamps, Intrinsics, Rare Decree."}}
  ],
  resources:[
   {n:"Pathos Clamps",where:{fr:"Orowyrm (10) · portails Undercroft Acier (3) · Maw Feeding",en:"Orowyrm (10) · Steel Path Undercroft portals (3) · Maw Feeding"},rar:"rare",chance:{fr:"Garanti (Orowyrm)",en:"Guaranteed (Orowyrm)"}},
   {n:"Incarnon Genesis adapters",where:{fr:"The Circuit — rotation HEBDO (paliers 5 & 10)",en:"The Circuit — WEEKLY rotation (tiers 5 & 10)"},rar:"rare",chance:{fr:"Choix de rotation hebdo",en:"Weekly rotation pick"}},
   {n:"Temporal Dust",where:{fr:"Récompenses & coffres de la spirale",en:"Spiral rewards & chests"},rar:"uncommon",chance:{fr:"Butin de spirale",en:"Spiral loot"}},
   {n:"Scuttler Husk",where:{fr:"Ennemis & objectifs de Duviri",en:"Duviri enemies & objectives"},rar:"common",chance:{fr:"Drop fréquent",en:"Frequent drop"}},
   {n:"Kaithe (monture volante)",where:{fr:"Progression Duviri (Intrinsics)",en:"Duviri progression (Intrinsics)"},rar:"guaranteed",chance:{fr:"Déblocable",en:"Unlockable"}},
   {n:"Drifter Intrinsics",where:{fr:"Objectifs surface (2) · Undercroft (6) · conservation/pêche (3)",en:"Surface objectives (2) · Undercroft (6) · conservation/fishing (3)"},rar:"common",chance:{fr:"Par activité",en:"Per activity"}},
   {n:"Steel Essence",where:{fr:"The Circuit (palier 9) · Orowyrm Acier",en:"The Circuit (tier 9) · Steel Path Orowyrm"},rar:"uncommon",chance:{fr:"Paliers Acier",en:"Steel Path tiers"}}
  ],
  src:["https://wiki.warframe.com/w/Duviri","https://wiki.warframe.com/w/The_Circuit"]
 },
 {
  id:"hollvania", name:"Höllvania", planet:"Terre, 1999", hub:"Höllvania Central Mall",
  faction:"The Hex", vehicle:"🏍️ Atomicycle",
  desc:{fr:"Le monde ouvert le PLUS RÉCENT (Warframe 1999, déc. 2024). Zone urbaine ; structure différente : combat urbain plutôt que minage/pêche.",
        en:"The NEWEST open landscape (Warframe 1999, Dec 2024). Urban zone; structured differently: city combat rather than mining/fishing."},
  zones:[
   {x:50,y:18,l:"Central Mall",t:"hub"},{x:32,y:42,l:"Surface (Scaldra)",t:"combat"},
   {x:70,y:42,l:"Underground (Techrot)",t:"combat"},{x:50,y:66,l:"Techrot Safes",t:"cave"}
  ],
  missions:[
   {n:"Bounties (Kaya) & modes",d:{fr:"Faceoff, Hell-Scrub, Legacyte Harvest, Stage Defense, Exterminate, Assassinat (niveau 65-70).",en:"Faceoff, Hell-Scrub, Legacyte Harvest, Stage Defense, Exterminate, Assassination (level 65-70)."}},
   {n:"Techrot Safes",d:{fr:"Hors Exterminate : 100 000 crédits + Arcane + Hex Treasure (Biocode requis).",en:"Non-Exterminate: 100,000 credits + Arcane + Hex Treasure (Biocode required)."}},
   {n:"Scaldra Supply Caches",d:{fr:"En Exterminate : Arcanes (Charges Efervon requises).",en:"In Exterminate: Arcanes (Efervon Charges required)."}}
  ],
  resources:[
   {n:"Arcane Enhancements (1999)",where:{fr:"Techrot Safes & Scaldra Caches",en:"Techrot Safes & Scaldra Caches"},rar:"rare",chance:{fr:"Pools de coffres",en:"Cache pools"}},
   {n:"Hex Treasures",where:{fr:"Jusqu'à 8/mission + drops ennemis",en:"Up to 8/mission + enemy drops"},rar:"uncommon",chance:{fr:"Apparitions de mission",en:"Mission spawns"}},
   {n:"Crédits (100 000)",where:{fr:"Techrot Safe ouvert",en:"Opened Techrot Safe"},rar:"guaranteed",chance:{fr:"Garanti par coffre",en:"Guaranteed per safe"}}
  ],
  src:["https://wiki.warframe.com/w/H%C3%B6llvania","https://wiki.warframe.com/w/H%C3%B6llvania_Central_Mall"]
 }
];

/* ---- Pêche & minage détaillés par monde (sourcé Wiki). Bloc séparé pour ne pas
   alourdir OPEN_WORLDS. fish:{n,bait?,cycle?,where} · mine:{n,kind:ore|gem,where} ·
   zones: POI supplémentaires (pêche/minage) pour la carte. Vérifié 2026-06-14. */
const OW_FISHMINE={
 plains:{
  fish:[
   {n:"Murkray",bait:"Murkray Bait",where:{fr:"Océan & grands plans d'eau",en:"Ocean & large pools"}},
   {n:"Norg",bait:"Norg Bait",where:{fr:"Lacs",en:"Lakes"}},
   {n:"Cuthol",bait:"Cuthol Bait",cycle:"night",where:{fr:"Rivières — la NUIT",en:"Rivers — at NIGHT"}},
   {n:"Goopolla",where:{fr:"Mares peu profondes",en:"Shallow ponds"}}
  ],
  mine:[
   {n:"Ferros",kind:"ore",where:{fr:"Filons rouges (surface)",en:"Red veins (surface)"}},
   {n:"Auron",kind:"ore",where:{fr:"Filons rouges",en:"Red veins"}},
   {n:"Nyth",kind:"gem",where:{fr:"Filons bleus (gemme)",en:"Blue veins (gem)"}},
   {n:"Sentirum",kind:"gem",where:{fr:"Filons bleus rares",en:"Rare blue veins"}}
  ],
  zones:[{x:18,y:52,l:"Ocean (pêche)",t:"fish"},{x:82,y:48,l:"Ridge (minage)",t:"mine"}]
 },
 vallis:{
  fish:[
   {n:"Longwinder",where:{fr:"Lacs (servofish, harpon)",en:"Lakes (servofish, spear)"}},
   {n:"Tink",where:{fr:"Grottes",en:"Caves"}},
   {n:"Mirewinder",where:{fr:"Surface des lacs",en:"Lake surface"}},
   {n:"Synathid",where:{fr:"Hotspots lumineux (rare) — Oxylus aide",en:"Luminous hotspots (rare) — Oxylus helps"}}
  ],
  mine:[
   {n:"Hesperon",kind:"ore",where:{fr:"Filons rouges",en:"Red veins"}},
   {n:"Travoride",kind:"ore",where:{fr:"Filons rouges",en:"Red veins"}},
   {n:"Goblite",kind:"gem",where:{fr:"Filons bleus",en:"Blue veins"}},
   {n:"Marquise Thyst",kind:"gem",where:{fr:"Filons bleus rares",en:"Rare blue veins"}}
  ],
  zones:[{x:16,y:54,l:"Lakes (pêche)",t:"fish"},{x:84,y:50,l:"Veins (minage)",t:"mine"}]
 },
 deimos:{
  fish:[
   {n:"Glutinox · Ostimyr · Vitreospina",bait:"Fass Residue",cycle:"fass",where:{fr:"Cycle FASS (appât Fass)",en:"FASS cycle (Fass bait)"}},
   {n:"Condrichord · Duroid",bait:"Vome Residue",cycle:"vome",where:{fr:"Cycle VOME (appât Vome)",en:"VOME cycle (Vome bait)"}},
   {n:"Aquapulmo",bait:"Processed Fass Residue",where:{fr:"Appât Fass traité (rare)",en:"Processed Fass bait (rare)"}}
  ],
  mine:[
   {n:"Adramalium",kind:"ore",where:{fr:"Filons du Drift",en:"Drift veins"}},
   {n:"Trapsidian",kind:"gem",where:{fr:"Filons bleus",en:"Blue veins"}},
   {n:"Heciphron",kind:"gem",where:{fr:"Filons bleus",en:"Blue veins"}},
   {n:"Thaumica",kind:"gem",where:{fr:"Filons rares",en:"Rare veins"}}
  ],
  note:{fr:"⚠️ Pêche à l'APPÂT (pas de harpon) ; les poissons dépendent du cycle Fass/Vome.",en:"⚠️ BAIT fishing (no spear); fish depend on the Fass/Vome cycle."},
  zones:[{x:18,y:54,l:"Pools (pêche)",t:"fish"},{x:82,y:52,l:"Veins (minage)",t:"mine"}]
 },
 duviri:{
  fish:[
   {n:"Maw Feeding (Golden Maw)",where:{fr:"Transference Pads près de l'eau — contrôle un Maw doré ; ≥10 prises → ressources, 15 → aquarium vivant (1×/run)",en:"Transference Pads near water — control a Golden Maw; ≥10 catches → resources, 15 → live aquarium (1×/run)"}}
  ],
  mine:[
   {n:"Yao Shrub",kind:"ore",where:{fr:"Cueillette en zones enneigées (pas de minage classique)",en:"Harvested in snowy areas (no traditional mining)"}},
   {n:"Aggristone",kind:"ore",where:{fr:"Cueillette de Duviri",en:"Duviri gathering"}}
  ],
  note:{fr:"⚠️ Pêche = « Maw Feeding » (contrôler un Golden Maw), pas de harpon. Conservation : Krubie, Kexat, Tamm (à purifier).",en:"⚠️ Fishing = “Maw Feeding” (control a Golden Maw), no spear. Conservation: Krubie, Kexat, Tamm (purify them)."},
  zones:[{x:66,y:72,l:"Maw (pêche)",t:"fish"},{x:30,y:62,l:"Snowy gathering",t:"mine"}]
 }
};

/* ---- Contenu « Guide » détaillé par monde (reformulé d'après le Wiki Warframe,
   aucune copie de texte/images). Onglet Guide affiché si OW_DETAIL[id] existe.
   sections:[{ic,title{fr,en},body{fr,en},list?:[{fr,en}]}] · moods (Duviri). 2026-06-14. */
const OW_DETAIL={
 plains:{
  intro:{fr:"Première étendue ouverte (2017), reliée à Cetus (Ostron). Carte FIXE (~5 km²). Cycle JOUR (100 min) / NUIT (50 min) synchronisé entre joueurs ; la nuit fait apparaître les Sentients. Débloqué après « La Récompense de Vor ».",
       en:"The first open landscape (2017), tied to Cetus (Ostron). FIXED map (~5 km²). DAY (100 min) / NIGHT (50 min) cycle synced across players; night brings Sentients. Unlocked after Vor's Prize."},
  sections:[
   {ic:"🌙",title:{fr:"Chasse aux Eidolons (nuit)",en:"Eidolon Hunt (night)"},body:{fr:"La NUIT uniquement, sur l'eau. Difficulté croissante.",en:"NIGHT only, near water. Escalating difficulty."},list:[
    {fr:"<b>Teralyst → Gantulyst → Hydrolyst</b> ; le « <b>Tridolon</b> » = les 3 en une seule nuit.",en:"<b>Teralyst → Gantulyst → Hydrolyst</b>; the “<b>Tridolon</b>” = all 3 in one night."},
    {fr:"<b>Leurres d'Eidolon</b> (Eidolon Lures, max 8) requis pour endommager et capturer pendant les phases vulnérables.",en:"<b>Eidolon Lures</b> (max 8) needed to damage and capture during vulnerable phases."},
    {fr:"Récompenses : Éclats <b>Intact/Brillant/Radieux</b>, Arcanes (Energize, Guardian…) ; réputation Quills & Vox Solaris.",en:"Rewards: <b>Intact/Brilliant/Radiant</b> Shards, Arcanes (Energize, Guardian…); Quills & Vox Solaris standing."}
   ]},
   {ic:"🎯",title:{fr:"Primes de Konzu",en:"Konzu Bounties"},body:{fr:"5 paliers, missions multi-objectifs aléatoires (consoles radio ou Cetus).",en:"5 tiers, random multi-objective missions (radio consoles or Cetus)."},list:[
    {fr:"Récompenses : mods, Endo, ressources (Iradite, Oxium, Cryotic…), plans Gara/Revenant.",en:"Rewards: mods, Endo, resources (Iradite, Oxium, Cryotic…), Gara/Revenant blueprints."}
   ]},
   {ic:"🎣",title:{fr:"Pêche & minage",en:"Fishing & mining"},body:{fr:"Poissons différents le JOUR et la NUIT ; la météo augmente les apparitions.",en:"Different fish by DAY and NIGHT; weather boosts spawns."},list:[
    {fr:"Appâts par rareté ; minage de filons (minerai orange / gemmes bleues) → réputation Ostron (Suumbaat). Spot riche : grottes de Mount Nang.",en:"Rarity baits; mine veins (orange ore / blue gems) → Ostron standing (Suumbaat). Rich spot: Mount Nang caves."}
   ]},
   {ic:"💎",title:{fr:"Ressources clés & Tusk Grineer",en:"Key resources & Tusk Grineer"},body:{fr:"Le Cetus Wisp ne s'obtient que la NUIT (surface, près de l'eau).",en:"Cetus Wisp only appears at NIGHT (surface, near water)."},list:[
    {fr:"Cetus Wisp, Iradite, Grokdrul, + Ferrite/Rubedo/Neurodes.",en:"Cetus Wisp, Iradite, Grokdrul, + Ferrite/Rubedo/Neurodes."},
    {fr:"Tusk Grineer : bases (Hek's Stiletto, Er-Phryah's Vigil, Mount Nang…) ; la pluie réduit leur visibilité.",en:"Tusk Grineer: bases (Hek's Stiletto, Er-Phryah's Vigil, Mount Nang…); rain lowers their visibility."}
   ]}
  ],
  src:["https://wiki.warframe.com/w/Plains_of_Eidolon","https://wiki.warframe.com/w/Eidolon"]
 },
 vallis:{
  intro:{fr:"Étendue glaciaire CORPUS (2018), reliée à Fortuna (Solaris United). Cycle CHAUD (~6 min 40) / FROID (~4 min). Deux Orbes géantes à abattre. Débloqué après « Vox Solaris ».",
       en:"CORPUS glacial landscape (2018), tied to Fortuna (Solaris United). WARM (~6m40) / COLD (~4m) cycle. Two giant Orbs to take down. Unlocked after Vox Solaris."},
  sections:[
   {ic:"🕷️",title:{fr:"Profit-Taker Orb (Heist)",en:"Profit-Taker Orb (Heist)"},body:{fr:"Combat en 4 phases, requiert le rang « Old Mate » chez Vox Solaris.",en:"4-phase fight, requires the “Old Mate” rank at Vox Solaris."},list:[
    {fr:"Donne le <b>Crisma Toroid</b>, des Arcanes et ressources rares.",en:"Drops the <b>Crisma Toroid</b>, Arcanes and rare resources."}
   ]},
   {ic:"🔥",title:{fr:"Exploiter Orb & Thermia Fractures",en:"Exploiter Orb & Thermia Fractures"},body:{fr:"Boss GRATUIT (Deck 12), pas de rang requis. Lié au cycle FROID.",en:"FREE boss (Deck 12), no rank required. Tied to the COLD cycle."},list:[
    {fr:"Pendant le froid : Coolant Raknoids → Diluted Thermia (event Thermia Fractures) → combat de l'Exploiter.",en:"During cold: Coolant Raknoids → Diluted Thermia (Thermia Fractures event) → Exploiter fight."}
   ]},
   {ic:"🟡",title:{fr:"Toroïdes (par zone)",en:"Toroids (by zone)"},body:{fr:"Tombent d'ennemis de zones précises ; aussi ramassables dans les 17 grottes.",en:"Drop from specific-zone enemies; also pickups in the 17 caves."},list:[
    {fr:"<b>Sola</b> (Temple of Profit, ~20% Kyta Raknoid) · <b>Calda</b> (Enrichment Labs, ~20% Scyto) · <b>Vega</b> (Spaceport, ~1% Mite) · <b>Crisma</b> (Profit-Taker).",en:"<b>Sola</b> (Temple of Profit, ~20% Kyta Raknoid) · <b>Calda</b> (Enrichment Labs, ~20% Scyto) · <b>Vega</b> (Spaceport, ~1% Mite) · <b>Crisma</b> (Profit-Taker)."}
   ]},
   {ic:"🎯",title:{fr:"Primes d'Eudico & pêche/minage",en:"Eudico bounties & fishing/mining"},body:{fr:"Paliers de primes (réputation Solaris United → débloque Vox Solaris).",en:"Bounty tiers (Solaris United standing → unlocks Vox Solaris)."},list:[
    {fr:"Pêche : <b>servofish</b> au harpon (Oxylus aide, hotspots lumineux). Minage : filons rouges (minerai) / bleus (gemmes).",en:"Fishing: <b>servofish</b> with a spear (Oxylus helps, luminous hotspots). Mining: red veins (ore) / blue (gems)."}
   ]}
  ],
  src:["https://wiki.warframe.com/w/Orb_Vallis","https://wiki.warframe.com/w/Toroid"]
 },
 deimos:{
  intro:{fr:"Étendue Infestée/Orokin (2020), reliée au Necralisk (famille Entrati). Surface fixe + grottes générées. Cycle FASS (orange, 100 min) / VOME (bleu, 50 min) : ennemis, Necramechs, poissons & résidus changent. Débloqué après « Le Cœur de Deimos ».",
       en:"Infested/Orokin landscape (2020), tied to the Necralisk (Entrati family). Fixed surface + procedural caves. FASS (orange, 100 min) / VOME (blue, 50 min) cycle: enemies, Necramechs, fish & residues change. Unlocked after Heart of Deimos."},
  sections:[
   {ic:"🔒",title:{fr:"Coffres-forts d'Isolation (T1/T2/T3)",en:"Isolation Vaults (T1/T2/T3)"},body:{fr:"Lancés via les primes Mère / Loid. Percer les grottes, vaincre des Necramechs gardiens.",en:"Started via Mother / Loid bounties. Breach caves, defeat guardian Necramechs."},list:[
    {fr:"Pièces de <b>Necramech endommagé</b> (Barrel/Receiver/Stock) ; primes <b>Arcana</b> (tier étendu) ; mods Theorem/Residual.",en:"<b>Damaged Necramech</b> parts (Barrel/Receiver/Stock); <b>Arcana</b> bounties (extended tier); Theorem/Residual mods."}
   ]},
   {ic:"🤖",title:{fr:"Necramechs & Necraloid",en:"Necramechs & Necraloid"},body:{fr:"En FASS : unités inactives <b>pilotables par Transférence</b>. En VOME : Necramechs alliés autonomes.",en:"In FASS: inactive units <b>pilotable via Transference</b>. In VOME: autonomous allied Necramechs."},list:[
    {fr:"Réputation Necraloid (pièces de Necramech, Voidrig/Bonewidow).",en:"Necraloid standing (Necramech parts, Voidrig/Bonewidow)."}
   ]},
   {ic:"🎯",title:{fr:"Primes de Mère",en:"Mother Bounties"},body:{fr:"Jetons « Mother Tokens » par étape ; rafraîchies toutes les 2 h 30.",en:"“Mother Tokens” per stage; refresh every 2.5 h."},list:[
    {fr:"Mode endless (MR5+) : jetons croissants par tour. Objectifs bonus = jetons en plus.",en:"Endless mode (MR5+): tokens scale per round. Bonus objectives = extra tokens."}
   ]},
   {ic:"🎣",title:{fr:"Pêche, minage & conservation",en:"Fishing, mining & conservation"},body:{fr:"Tout passe par les Entrati (jetons par famille).",en:"Everything routes through the Entrati (per-family tokens)."},list:[
    {fr:"Pêche au harpon dans l'exocrine (poissons selon Fass/Vome) → jetons <b>Daughter</b> ; minage (minerai/gemmes) → jetons <b>Otak</b> ; conservation → jetons <b>Son</b>.",en:"Spear fishing in the exocrine (fish depend on Fass/Vome) → <b>Daughter</b> tokens; mining (ore/gems) → <b>Otak</b> tokens; conservation → <b>Son</b> tokens."},
    {fr:"Ressources : résidus Fass/Vome, Scintillant, Aya ; reliques Meso/Neo/Axi.",en:"Resources: Fass/Vome residues, Scintillant, Aya; Meso/Neo/Axi relics."}
   ]}
  ],
  src:["https://wiki.warframe.com/w/Cambion_Drift","https://wiki.warframe.com/w/Isolation_Vault"]
 },
 hollvania:{
  intro:{fr:"Le monde ouvert le PLUS RÉCENT (Update 38, déc. 2024) : Terre en 1999. Hub : Höllvania Central Mall (via le Pom-2, après la quête « The Hex »). Zone réservée au DRIFTER (pas d'Opérateur). Les crédits s'affichent en « Höllars ».",
       en:"The NEWEST open landscape (Update 38, Dec 2024): Earth in 1999. Hub: Höllvania Central Mall (via the Pom-2, after “The Hex” quest). DRIFTER-only zone (no Operator). Credits show as “Höllars”."},
  sections:[
   {ic:"🎸",title:{fr:"The Hex (syndicat)",en:"The Hex (syndicate)"},body:{fr:"Faction de réputation. Membres : Arthur, Aoi, Lettie, Eleanor, Quincy, Amir.",en:"Reputation faction. Members: Arthur, Aoi, Lettie, Eleanor, Quincy, Amir."},list:[
    {fr:"Monnaie : <b>Hex Treasures</b> (ramassées en mission). S'oppose à Scaldra, aide les victimes du Techrot. <i>Paliers détaillés peu documentés.</i>",en:"Currency: <b>Hex Treasures</b> (collected in missions). Opposes Scaldra, aids Techrot victims. <i>Standing thresholds not fully documented.</i>"}
   ]},
   {ic:"⚔️",title:{fr:"Factions : Scaldra & Techrot",en:"Factions: Scaldra & Techrot"},body:{fr:"Deux camps qui se partagent la ville.",en:"Two sides sharing the city."},list:[
    {fr:"<b>Scaldra</b> (militaire) tient les rues (surface) ; <b>Techrot</b> (IA infestée) domine le souterrain.",en:"<b>Scaldra</b> (military) holds the streets (surface); <b>Techrot</b> (infested AI) rules the underground."}
   ]},
   {ic:"🏍️",title:{fr:"Atomicycle",en:"Atomicycle"},body:{fr:"Monture/moto pour parcourir les rues (désactivée si tu portes un Biocode/Efervon).",en:"Motorcycle mount to roam the streets (disabled while carrying a Biocode/Efervon)."}},
   {ic:"🎯",title:{fr:"Activités & primes",en:"Activities & bounties"},body:{fr:"Niveau 65-70. Primes au panneau du Mall.",en:"Level 65-70. Bounties at the Mall board."},list:[
    {fr:"Faceoff, Hell-Scrub (extermination), Legacyte Harvest, Stage Defense, Assassinat (H-09 Efervon Tank).",en:"Faceoff, Hell-Scrub (exterminate), Legacyte Harvest, Stage Defense, Assassination (H-09 Efervon Tank)."}
   ]},
   {ic:"🎁",title:{fr:"Récompenses & Arcanes 1999",en:"Rewards & 1999 Arcanes"},body:{fr:"Pas de minerais/poissons classiques : récompenses urbaines.",en:"No classic ores/fish: urban rewards."},list:[
    {fr:"<b>Techrot Safes</b> (hors Exterminate : Biocode → Arcane + 100 000 crédits) · <b>Scaldra Caches</b> (Exterminate : Efervon).",en:"<b>Techrot Safes</b> (non-Exterminate: Biocode → Arcane + 100,000 credits) · <b>Scaldra Caches</b> (Exterminate: Efervon)."},
    {fr:"Arcanes 1999 (Bellicose, Truculence, Impetus, Camisado, Crepuscular, Primary Crux, Secondary Enervate, Melee Doughty), armes <b>Coda</b>, Hex Treasures.",en:"1999 Arcanes (Bellicose, Truculence, Impetus, Camisado, Crepuscular, Primary Crux, Secondary Enervate, Melee Doughty), <b>Coda</b> weapons, Hex Treasures."}
   ]},
   {ic:"📅",title:{fr:"Saisons",en:"Seasons"},body:{fr:"4 saisons (Hiver/Printemps/Été/Automne, ~3 mois ; avancent le lundi 00:00 UTC).",en:"4 seasons (Winter/Spring/Summer/Autumn, ~3 months; advance Monday 00:00 UTC)."},list:[
    {fr:"Bonus Eximus saisonniers ; le visuel du tileset change. Pas d'alertes/fissures/sorties classiques ici.",en:"Seasonal Eximus bonuses; tileset visuals shift. No classic alerts/fissures/sorties here."}
   ]}
  ],
  src:["https://wiki.warframe.com/w/H%C3%B6llvania","https://wiki.warframe.com/w/The_Hex"]
 },
 duviri:{
  intro:{fr:"Duviri est un royaume tiré du livre « Tales of Duviri » d'Euleria Entrati, rendu réel par le Drifter (Conceptual Embodiment) après un traumatisme du Vide. Dominus Thrax, vexé par ses tentatives de départ, le piège dans une BOUCLE TEMPOREL où il le réexécute. Débloqué après la quête (Update 33, 2023).",
       en:"Duviri is a realm from Euleria Entrati's storybook “Tales of Duviri”, made real by the Drifter (Conceptual Embodiment) after Void trauma. Dominus Thrax, insulted by escape attempts, traps them in a TIME LOOP, re-executing them. Unlocked after the quest (Update 33, 2023)."},
  sections:[
   {ic:"♾️",title:{fr:"Le Circuit (normal & Acier)",en:"The Circuit (normal & Steel Path)"},
    body:{fr:"Mode endless 100% Warframe dans l'Undercroft, à difficulté croissante. La grande source d'adaptateurs Incarnon Genesis.",en:"100% Warframe endless mode in the Undercroft, scaling difficulty. The main source of Incarnon Genesis adapters."},
    list:[
     {fr:"Adaptateur Incarnon Genesis aux <b>paliers 5 & 10</b> (rotation HEBDOMADAIRE d'armes).",en:"Incarnon Genesis adapter at <b>tiers 5 & 10</b> (WEEKLY weapon rotation)."},
     {fr:"25 Essence d'Acier au palier 9 ; aussi Exilus, plans de Forma, Rivens, Kuva, Endo, crédits, ressources Duviri.",en:"25 Steel Essence at tier 9; also Exilus, Forma BPs, Rivens, Kuva, Endo, credits, Duviri resources."},
     {fr:"<b>Steel Path</b> : ennemis +20 niveaux (PV/boucliers inchangés), Orowyrm gagne des mécaniques ; même rotation hebdo ; requiert d'avoir fini les 3 modes normaux.",en:"<b>Steel Path</b>: enemies +20 levels (health/shields unchanged), Orowyrm gains mechanics; same weekly rotation; requires finishing all 3 normal modes."}
    ]},
   {ic:"🐉",title:{fr:"L'Orowyrm",en:"The Orowyrm"},
    body:{fr:"Boss final d'une spirale, après 4 objectifs de surface + 2 missions Undercroft. Combat aérien à dos de Kaithe.",en:"A spiral's final boss, after 4 surface objectives + 2 Undercroft missions. Aerial fight on Kaithe."},
    list:[
     {fr:"Normal : <b>10 Pathos Clamps</b>, 15 Drifter Intrinsics, 1 Décret rare.",en:"Normal: <b>10 Pathos Clamps</b>, 15 Drifter Intrinsics, 1 Rare Decree."},
     {fr:"Acier : <b>15 Pathos Clamps</b>, 22 Intrinsics, 5 Essence d'Acier.",en:"Steel Path: <b>15 Pathos Clamps</b>, 22 Intrinsics, 5 Steel Essence."}
    ]},
   {ic:"🐎",title:{fr:"Le Kaithe (monture volante)",en:"The Kaithe (flying mount)"},
    body:{fr:"Monture invoquée (touche 1 par défaut) qui VOLE. Aucun dégât de chute.",en:"Summoned mount (default key 1) that FLIES. No fall damage."},
    list:[
     {fr:"4 capacités montées (dont Hoof Stomp, Steadfast Dismount). Démonte via capacité, mêlée ou dégâts subis.",en:"4 mounted abilities (incl. Hoof Stomp, Steadfast Dismount). Dismount via ability, melee or taking damage."},
     {fr:"Détection de butin au rang Riding 5 ; mini-jeu de course (objectif Anecdote).",en:"Loot detection at Riding rank 5; racing minigame (Anecdote objective)."}
    ]},
   {ic:"✨",title:{fr:"Les Décrets (Decrees)",en:"Decrees"},
    body:{fr:"Bonus TEMPORAIRES choisis après un objectif ; ils persistent jusqu'à l'extraction et se cumulent.",en:"TEMPORARY bonuses chosen after an objective; they persist until extraction and stack."},
    list:[
     {fr:"On choisit parmi 3 options (4 avec Opportunity rang 1). Objectifs principaux → Décrets communs ; Undercroft → Décrets rares.",en:"Pick from 3 options (4 with Opportunity rank 1). Main objectives → Common Decrees; Undercroft → Rare Decrees."},
     {fr:"Exemples : « +10% dégâts par Décret actif » (Combat rang 1), « +25 PV au Drifter par Décret » (Endurance rang 1).",en:"Examples: “+10% damage per active Decree” (Combat rank 1), “+25 Health to the Drifter per Decree” (Endurance rank 1)."}
    ]},
   {ic:"🕳️",title:{fr:"L'Undercroft",en:"The Undercroft"},
    body:{fr:"Zones souterraines 100% Warframe, accessibles par des portails. Types de mission de l'Origin System.",en:"Underground 100% Warframe areas via portals. Origin System mission types."},
    list:[
     {fr:"Défense (3 vagues), Survie (5 min), Excavation, Void Flood, Extermination, Assassinat, Alchimie.",en:"Defense (3 waves), Survival (5 min), Excavation, Void Flood, Exterminate, Assassination, Alchemy."},
     {fr:"Récompense DOUBLE vs surface (6 Drifter Intrinsics, Décret rare). Portails Acier : Arcanes + 3 Pathos Clamps.",en:"DOUBLE rewards vs surface (6 Drifter Intrinsics, Rare Decree). Steel Path portals: Arcanes + 3 Pathos Clamps."}
    ]},
   {ic:"🎣",title:{fr:"Ressources, pêche & conservation",en:"Resources, fishing & conservation"},
    body:{fr:"Pas de minage classique ni de harpon à Duviri.",en:"No traditional mining or spear fishing in Duviri."},
    list:[
     {fr:"Ressources : Pathos Clamp, Temporal Dust, Scuttler Husk, Kuva.",en:"Resources: Pathos Clamp, Temporal Dust, Scuttler Husk, Kuva."},
     {fr:"Pêche = <b>Maw Feeding</b> : contrôle un Golden Maw aux Transference Pads ; ≥10 prises → ressources, 15 → aquarium vivant (1×/visite).",en:"Fishing = <b>Maw Feeding</b>: control a Golden Maw at Transference Pads; ≥10 catches → resources, 15 → live aquarium (1×/visit)."},
     {fr:"Conservation : approcher en discrétion Krubie/Kexat/Tamm (corrompus du Vide), puis QTE de purification.",en:"Conservation: stealth-approach Krubie/Kexat/Tamm (Void-corrupted), then a purification QTE."}
    ]}
  ],
  moods:[
   {key:"joy",dmg:{fr:"Void",en:"Void"},sky:{fr:"Ciel vert",en:"Green sky"}},
   {key:"anger",dmg:{fr:"Chaleur",en:"Heat"},sky:{fr:"Ciel rouge",en:"Red sky"}},
   {key:"envy",dmg:{fr:"Toxine",en:"Toxin"},sky:{fr:"Paysage verdâtre",en:"Green landscape"}},
   {key:"sorrow",dmg:{fr:"Froid",en:"Cold"},sky:{fr:"Terrain altéré",en:"Altered terrain"}},
   {key:"fear",dmg:{fr:"Électricité",en:"Electricity"},sky:{fr:"Îles différentes",en:"Different islands"}}
  ],
  src:["https://wiki.warframe.com/w/Duviri","https://wiki.warframe.com/w/The_Circuit"]
 }
};
