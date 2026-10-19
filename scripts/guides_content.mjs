/* Contenu éditorial des guides VoidRelay (statique, FR, evergreen).
   Chaque guide : slug, title (<title>), h1, desc (meta), body (HTML).
   Liens internes vers /hub, /o/, /bons-plans, /faq pour le maillage. */
export const GUIDES = [
  {
    slug: "farmer-platine-gratuit",
    banner: "/assets/banners/fam-commerce.webp",
    title: "Farmer du platine gratuitement dans Warframe (guide 2026)",
    h1: "Comment farmer du platine gratuitement dans Warframe",
    desc: "Le guide complet pour gagner du platine sans payer dans Warframe : vendre des pièces Prime, des mods, des reliques et des arcanes sur le marché, et repérer ce qui vaut cher.",
    body: `
<p>Le <b>platine</b> est la monnaie premium de Warframe, mais tu n'as <b>pas besoin de l'acheter</b> : tu peux en gagner uniquement en jouant, puis en échangeant tes objets avec d'autres joueurs. Voici les méthodes les plus rentables, de la plus simple à la plus avancée.</p>

<h2>1. Vendre des pièces et sets Prime</h2>
<p>C'est la source de platine n°1. Les objets <b>Prime</b> s'obtiennent en ouvrant des <a href="/o/c/reliques">reliques du Vide</a> dans les missions Failles. Une fois les 3-4 pièces d'un set en main, tu peux vendre les pièces séparément ou le <a href="/o/c/sets">set complet</a>. Vérifie toujours le prix en direct avant de vendre — un set Prime récent ou « vaulté » peut valoir 100 à 300+ platine.</p>
<p>Astuce : compare systématiquement « pièces vs set » sur chaque <a href="/o/">page objet</a> de VoidRelay — parfois vendre les pièces séparément rapporte plus que le set entier.</p>

<h2>2. Vendre des mods rares</h2>
<p>Beaucoup de <a href="/o/c/mods">mods</a> se vendent bien : mods d'augmentation de syndicat, mods rares de Nightmare, mods de reliquaire (Primed), et mods de la Sortie. Garde un œil sur les mods rares que tu drops — certains valent 50 à 150+ platine.</p>
<p><b>Débutant ?</b> Commence par là : les reliques Axi arrivent tard, mais dès les premiers paliers tu drops des <b>mods qui partent à 10-20 platine pièce</b> (mods corrompus, mods d'événements, augments de syndicat) — et certains valent bien plus, comme le mod du Sobek chez Kela De Thaym (~40 pl non monté) ou les parts d'Imperator Vandal. C'est le vrai moteur des 100 premières platines — conclusion du Périple du Tenno de Pandaahh, compte neuf à l'appui.</p>
<p><b>Le farm « ancestral » : les voûtes Orokin de Deimos.</b> Fabrique les 4 <b>clés dragon</b> au laboratoire Orokin du dojo et équipe-les toutes (impossible de savoir d'avance laquelle ouvrira la porte cachée), puis enchaîne les missions autour de Deimos : chaque voûte donne un <b>mod corrompu</b>, et 99 % des builds en utilisent au moins un — ils se vendent tout seuls. Sur son compte neuf, Pandaahh en tirait <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">100 à 150 platine par jour</a>. Les mods des bounties de Fortuna (dès la 2e) se revendent aussi 10-20 pl pièce.</p>
<p><b>L'ordre de grandeur à viser</b> : pour Pandaahh, <a href="https://www.youtube.com/watch?v=5UOUgl0iDAg" target="_blank" rel="noopener">100 platine par jour te place dans le « 1 % » des joueurs</a> — assez pour financer slots, réacteurs et le Riven de tes rêves ; même 100 par semaine suffisent, juste plus lentement. Sa règle : partage ton temps entre progression et farm de platine, et choisis le farm que tu referas vraiment tous les jours — les mods restent son option « qui bouffe le moins la santé », les Rivens le haut du panier (des pièces à 5 000-15 000 pl, mais un vrai métier de négociant).</p>
<p><b>Et pour les fous du volume, son plan « 1 million en un an »</b> (<a href="https://www.youtube.com/watch?v=8_Mb0aU1Ofo" target="_blank" rel="noopener">détaillé en live</a>) : ne rien acheter, réserver ses <b>36 trades quotidiens</b> à la vente, viser ~80-100 pl de moyenne par trade (36 × 80 × 365 ≈ 1,05 million). La recette : de la <b>régularité</b> plutôt que des Rivens aléatoires — reliques à fond en groupes rapides, Prime Resurgence en farmant soi-même l'Aya (60-70 par jour), une session d'Apollo (Lua) pour les Axi, les 25 packs de reliques hebdomadaires contre l'essence d'acier, et une partie des primes cramée en ducats pour revendre armes et mods Primed de Baro (100-200 pl pièce). Preuve par l'inventaire : le sien est estimé à ~600 000 pl… sans ouvrir une seule relique.</p>

<h2>3. Les arcanes</h2>
<p>Les <a href="/o/c/arcanes">arcanes</a> (Eidolons, Profit-Taker, etc.) sont très demandés pour les builds end-game. Même non maxés, ils se revendent. C'est une source régulière une fois que tu fais les chasses aux Eidolons.</p>

<h2>4. Les rivens</h2>
<p>Les <a href="/o/c/rivens">mods Riven</a> ont des stats aléatoires : un riven bien roulé sur une arme populaire peut valoir des centaines, voire des milliers de platine. C'est plus aléatoire, mais c'est le plus haut plafond de gain.</p>

<h2>5. Vendre tes reliques en double</h2>
<p>Tu accumules des <a href="/o/c/reliques">reliques</a> ? Les reliques d'ères anciennes ou contenant des pièces vaultées s'échangent aussi contre du platine.</p>

<h2>Comment vendre concrètement</h2>
<ul>
<li>Liste tes objets sur Warframe Market au prix médian (ou un peu en dessous pour vendre vite) — l'<a href="/estimateur">estimateur de prix</a> te donne la valeur d'un objet en deux secondes.</li>
<li>Reste en ligne en jeu : les acheteurs t'envoient un message, tu les invites et vous échangez.</li>
<li>Surveille les <a href="/bons-plans">bons plans du jour</a> pour savoir quoi vendre quand les prix montent.</li>
</ul>

<p>Pour suivre les prix en temps réel et savoir quoi farmer, utilise le <a href="/hub">tableau de bord VoidRelay</a> et la <a href="/o/">recherche d'objets</a>. Plus de questions ? Vois la <a href="/faq">FAQ Warframe</a>.</p>
`,
  },
  {
    slug: "farmer-ducats",
    banner: "/assets/banners/fam-commerce.webp",
    title: "Ducats Warframe : comment en farmer vite (guide)",
    h1: "Comment farmer des ducats efficacement dans Warframe",
    desc: "Guide pour farmer un maximum de ducats dans Warframe : quelles pièces Prime donner à Baro Ki'Teer, le meilleur ratio ducats/platine, et comment optimiser tes reliques.",
    faq: [
      { q: "Combien rapporte une pièce Prime ?", a: "Les pièces Prime communes rapportent 15 ducats, les peu communes 45 ducats, et les rares de 65 à 100 ducats. Chaque page objet de VoidRelay affiche les ducats et le ratio ducats/platine de l'objet, l'indicateur clé pour décider de recycler ou vendre une pièce." },
      { q: "Quand dépenser ses ducats ?", a: "Garde tes ducats pour le retour de Baro Ki'Teer, qui revient tous les 14 jours pour 48 h. Vérifie son arrivée et son inventaire sur le tableau de bord VoidRelay." },
    ],
    body: `
<p>Les <b>ducats</b> servent à acheter les objets de <a href="/o/c/sets">Baro Ki'Teer</a>. On les obtient en « recyclant » des pièces Prime au kiosque du Vide (Void Relic Segment). Voici comment en farmer un maximum sans gaspiller — et pour compter ce que vaut ton stock, utilise le <a href="/ducats">convertisseur de ducats</a>.</p>

<h2>Combien rapporte une pièce Prime ?</h2>
<ul>
<li>Pièces Prime <b>communes</b> : 15 ducats</li>
<li>Pièces Prime <b>peu communes</b> : 45 ducats</li>
<li>Pièces Prime <b>rares</b> : 65 à 100 ducats</li>
</ul>
<p>Sur chaque <a href="/o/">page objet</a> de VoidRelay, on affiche les <b>ducats</b> de l'objet <b>et le ratio ducats/platine</b> : c'est l'indicateur clé pour décider si tu recycles une pièce ou si tu la vends contre du platine.</p>

<h2>La meilleure stratégie</h2>
<ol>
<li><b>Ouvre des reliques</b> en Failles du Vide : chaque relique donne une pièce Prime.</li>
<li><b>Garde pour le platine</b> les pièces qui valent cher sur le marché (bon ratio platine).</li>
<li><b>Recycle en ducats</b> les pièces communes qui ne valent presque rien en platine mais donnent 15 ducats : c'est « gratuit ».</li>
</ol>
<p><b>La méthode de tri de Pandaahh</b> pour purger un inventoire avant un passage de Baro (<a href="https://www.youtube.com/watch?v=kYE3I7ASyMs" target="_blank" rel="noopener">100 000+ ducats en live</a>) : il vérifie le <b>prix réel sur warframe.market</b> pièce par pièce plutôt que de se fier à sa mémoire — les prix bougent sans arrêt. Sa règle : toute pièce qui vaut <b>~10-15 platine ou moins</b> au prix courant part en ducats sans hésiter, quel que soit le surplus. À l'inverse, il garde toujours un <b>set complet intact</b> des armes et Warframes à forte demande — même en gros excédent — car leur valeur peut remonter (son exemple : les pièces de <a href="/builds/nautilus">Nautilus</a>, « le hack du jeu », ou d'une arme qui vient de sortir en Incarnon, dont le prix s'envole d'un coup). Les objets <b>tout juste sortis</b> gardent leurs sets complets tant que le marché n'a pas eu le temps de fixer un prix.</p>
<p><b>La technique du « stock plancher »</b>, complémentaire (<a href="https://www.youtube.com/watch?v=2PMZ8ue_edE" target="_blank" rel="noopener">326 000 ducats scrappés en une session par Patchoumio</a>) : trie ton inventoire <b>par nom</b> plutôt que par quantité possédée pour voir chaque set au complet, puis fixe-toi un <b>nombre plancher</b> par pièce (lui vise ~30-40 exemplaires des pièces courantes) et ne scrappe que le surplus au-dessus de ce seuil. Confirme la même règle que Pandaahh : jamais toucher aux frames/armes activement jouées ou très demandées (Rhino, Mesa, Trinity, Nidus…), et tout dégager sans pitié sur le reste — vaulté ou non, un objet qui « ne se vend pas » ou vaut ~20 platine ne vaut pas la peine d'être gardé.</p>

<h2>Optimiser ses ouvertures de reliques</h2>
<p>Joue en groupe (4 joueurs) sur des Failles : à la fin, vous choisissez parmi les 4 récompenses, ce qui multiplie tes chances d'avoir les pièces rares. Raffine tes reliques avec des Traces du Vide (jusqu'à Radiant) pour booster les chances de drop rare.</p>

<h2>Quand dépenser ses ducats ?</h2>
<p>Garde tes ducats pour le <b>retour de Baro Ki'Teer</b> (tous les 14 jours, 48 h). Regarde son arrivée et son inventaire sur le <a href="/hub">tableau de bord</a>, et lis notre <a href="/guides/baro-kiteer-guide">guide Baro Ki'Teer</a>.</p>

<p><b>Et pense au sens inverse</b> (<a href="https://www.youtube.com/watch?v=gOtusE3AWLk" target="_blank" rel="noopener">rappel de Pandaahh</a>) : à chaque venue de Baro, le chat d'échange se remplit de joueurs à court de ducats — beaucoup découvrent ce jour-là que le ticket TennoCon ne paie pas la boutique. Vendre ses pièces Prime « 45 ducats » à <b>4-5 platine l'unité</b> part tout seul pendant ces 48 h : garde un stock d'avance et profites-en.</p>

<p>Plus de questions sur les ducats ? Vois la <a href="/faq">FAQ</a>.</p>
`,
  },
  {
    slug: "baro-kiteer-guide",
    banner: "/assets/banners/fam-commerce.webp",
    title: "Baro Ki'Teer : quand revient-il et quoi acheter ?",
    h1: "Baro Ki'Teer : calendrier et quoi acheter",
    desc: "Tout sur Baro Ki'Teer dans Warframe : à quelle fréquence il revient, combien de temps il reste, et quels objets de son inventaire valent vraiment tes ducats.",
    faq: [
      { q: "Quand revient Baro Ki'Teer ?", a: "Baro arrive tous les 14 jours et reste 48 heures dans un relais. Passé ce délai, il repart avec son stock. Son prochain passage et son inventaire sont visibles en direct sur le tableau de bord VoidRelay." },
      { q: "Quoi acheter en priorité chez Baro Ki'Teer ?", a: "Les mods Primed (Primed Continuity, Primed Flow, etc.) sont les meilleurs achats sur le long terme, certains se revendant très cher en platine. Viennent ensuite les armes et cosmétiques exclusifs selon le goût et la revente ; mieux vaut éviter les décos si l'objectif est l'optimisation." },
    ],
    body: `
<p><b>Baro Ki'Teer</b>, le « Void Trader », est un marchand itinérant qui vend des objets exclusifs contre des <a href="/guides/farmer-ducats">ducats</a> et des crédits.</p>

<h2>Quand revient Baro Ki'Teer ?</h2>
<p>Baro arrive <b>tous les 14 jours</b> et reste <b>48 heures</b> dans un relais (Relay). Passé ce délai, il repart avec son stock. Tu peux voir <b>son prochain passage et son inventaire en direct</b> sur le <a href="/hub">tableau de bord VoidRelay</a> (compte à rebours inclus).</p>

<h2>Quoi acheter en priorité ?</h2>
<ul>
<li><b>Mods Primed</b> : versions améliorées de mods courants (Primed Continuity, Primed Flow, etc.). Ce sont les meilleurs achats sur le long terme — certains se revendent ensuite très cher en platine.</li>
<li><b>Armes et cosmétiques exclusifs</b> : selon ton goût et la revente.</li>
<li><b>Le tri de Pandaahh</b> (<a href="https://www.youtube.com/watch?v=lhBOA_XlgzY" target="_blank" rel="noopener">conseillé en live</a>) : mods Primed d'abord, puis les <b>60/60 électriques</b> — les 60/60 feu et glace, eux, se farment désormais en missions Spy. À sauter : les Primed de recul (« on s'en fout un peu ») et les mods anti-faction, que plus grand monde ne joue en 2026. Sa revue de l'inventaire de juillet (<a href="https://www.youtube.com/watch?v=1Arhdo8iH2U" target="_blank" rel="noopener">en live</a>) : <b>Fulmination accru</b> est indispensable (la version normale est un mod d'événement — obligatoire pour les secondaires explosives type Akarius), <b>À Bout Portant accru</b> et <b>Cartouche Chargée accrue</b> se prennent sans hésiter, <b>Traumatisme Lourd accru</b> se skippe hors niche Impact.</li>
<li><b>Évite</b> de claquer tes ducats sur des décos si tu vises l'optimisation.</li>
</ul>

<h3>La checklist complète de Pandaahh (<a href="https://www.youtube.com/watch?v=_GbK9rRsVs4" target="_blank" rel="noopener">Baro spécial TennoCon</a>)</h3>
<p>Toujours prendre, quel que soit ton style de jeu — ce sont des mods « evergreen » qui reviennent dans la majorité des builds :</p>
<ul>
<li><b>Fulmination accru</b> (+44 % de rayon d'explosion, <a href="https://www.youtube.com/watch?v=TmBZJi2u4dk" target="_blank" rel="noopener">chiffre confirmé par Nerd Bird</a>) — indispensable pour les armes explosives type Acarius, Angstrum, Ogris ; pas d'alternative correcte en jeu.</li>
<li><b>Continuité accrue</b> (+55 % de durée), <b>Atteinte accrue</b> (+3 m de portée de mêlée), <b>Ravage accru</b> (+110 % de dégâts critiques), <b>Tempête de Feu accrue</b> (+44 % de rayon, Acceltra, Bramma…) et <b>Frappe de Fièvre accrue</b> (builds spam/éviscération) — dans un nombre de builds trop grand pour s'en passer.</li>
<li><b>Mutation de Fusil / Fusil à Pompe / Sniper accrues</b> et <b>À Bout Portant accru</b> (+165 % de base de dégâts du fusil à pompe) — pour la tranquillité en munitions et en dégâts.</li>
<li><b>Instinct Animal accru</b> — le radar de loot passe de 30 m à 63 m (le radar d'ennemis, lui, est désormais inné à toutes les Warframes).</li>
</ul>
<p>Selon ton style :</p>
<ul>
<li><b>Mods anti-faction</b> (Fléau/Extermination de faction) : prix de groupe conseillé par Pandaahh — utiles pour un stuff dégâts-cap ou certaines synergies (l'explosif profite d'une instance de dégâts supplémentaire avec le Rugissement de Rhino), mais très peu joués en 2026 en usage courant. Nuance apportée par le créateur anglophone <a href="https://www.youtube.com/watch?v=TmBZJi2u4dk" target="_blank" rel="noopener">Nerd Bird</a> : leur +55 % est <b>multiplicatif</b>, pas additif, et <b>double-dip sur les statuts</b> — il s'applique au coup initial ET à chaque tick des dégâts sur la durée (saignement, feu, poison…), soit environ <b>+240 % de dégâts sur les ticks</b>. Change tout en Steel Path profond ou grosse Archimédée, même si jongler les mods à chaque mission reste une contrainte.</li>
<li><b>Nouveauté maj 43</b> : le Steel Path est arrivé en Railjack — le <b>Chargeur Vénimeux accru</b> (Toxine, archgun) redevient pertinent pour tenir la cadence de dégâts.</li>
</ul>
<p>À sauter sans regret : les mods de recul (Stabilisateur, Contrepoids, Main Stable), <b>Chef de Meute accru</b> (la version normale suffit très largement) et <b>Traumatisme Lourd accru</b> — plus grand monde ne le joue depuis la réduction du rayon des attaques au sol.</p>
<p>Côté armes de la boutique, un classique et une curiosité : le <b>Gotva Prime</b> garantit une <b>chance de critique fixe à 300 %</b> sur chaque tir (valeur non modifiable par les mods — crit rouge assuré), et le <b>Vastilok</b> reste la meilleure gunblade pour striper les défenses ennemies.</p>
<p><b>Astuce booster</b> : le <b>doubleur de mods</b> (1 an) vaut le coup à l'année — les mods et l'endo partagent la même table de butin, donc plus de mods signifie aussi plus d'endo ; en Steel Path, ça double aussi tes chances de récupérer des <a href="/arcanes/">arcanes</a>.</p>

<h3>Le tri de Patchoumio (<a href="https://www.youtube.com/watch?v=JlgclNYBkt4" target="_blank" rel="noopener">revue complète en vidéo</a>)</h3>
<p>Deux astuces qui font gagner de vrais ducats :</p>
<ul>
<li><b>Ignis Wraith</b> : ne l'achète <b>jamais</b> chez Baro (250 000 crédits + 550 ducats). Elle est gratuite dans ton <b>dojo de clan</b> pour quelques crédits — une des erreurs les plus courantes.</li>
<li><b>Chambre accrue</b> (1 000 000 crédits + 3 000 ducats) : achète-la en <b>platine</b> sur le marché plutôt qu'en ducats — elle s'y trouve souvent pour 50 à 100 platine, largement sous la valeur de revente de tes ducats.</li>
</ul>
<p>Mods qu'il ajoute à la liste « à prendre sans hésiter » : <b>Flux accru</b> (+275 % d'énergie max), <b>Point de Pression accru</b> (+165 % de dégâts d'attaque lourde) et <b>Craque Cible accrue</b> (+110 % de dégâts crit pistolet), <b>Manœuvre de Pistolet accrue</b> (+187 % de chance critique pistolet), <b>Commotion accrue</b> et <b>Coup Voltaïque accru</b> (60/60 électriques, introuvables en jeu — pourcentages confirmés par le créateur anglophone <a href="https://www.youtube.com/watch?v=TmBZJi2u4dk" target="_blank" rel="noopener">Nerd Bird</a>). Confirme aussi les choix de Pandaahh : Fulmination et À Bout Portant indispensables, Traumatisme Lourd et les mods anti-faction à sauter en 2026 en usage courant. Côté armes, en plus du Gotva Prime et du Vastilok : <b>Angstrum Prisma</b> (Incarnon, très forte), <b>Lex Prisma</b> (arc explosif solide), <b>Homa Prisma</b> et <b>Scana Prisma</b> (Incarnon, mêlée qui tape fort) valent la priorité sur le reste du stock d'armes, surtout cosmétique.</p>

<h2>Comment se préparer</h2>
<p>Avant son arrivée, farme un stock de <a href="/guides/farmer-ducats">ducats</a> en recyclant tes pièces Prime communes. Vise au moins 2 000-3 000 ducats pour pouvoir prendre plusieurs mods Primed — le <a href="/ducats">convertisseur de ducats</a> fait le compte à partir de tes pièces.</p>

<p>Astuce revente : certains mods Primed achetés chez Baro pour des ducats se revendent ensuite pour beaucoup de <a href="/guides/farmer-platine-gratuit">platine</a> sur le marché. Surveille les <a href="/bons-plans">bons plans</a>.</p>
`,
  },
  {
    slug: "trading-warframe-market",
    banner: "/assets/banners/fam-commerce.webp",
    title: "Débuter le trading sur Warframe Market (guide complet)",
    h1: "Trading Warframe : guide complet du débutant",
    desc: "Comment échanger dans Warframe : où trouver les prix, comment poster un ordre, la taxe d'échange, et les pièges à éviter pour vendre et acheter au bon prix.",
    body: `
<p>Le <b>trading</b> entre joueurs est le cœur de l'économie de Warframe. Voici comment t'y mettre proprement.</p>

<h2>1. Connaître le prix</h2>
<p>Avant tout, regarde le <b>prix réel</b> de l'objet : prix médian, vente la plus basse et volume. Cherche n'importe quel objet sur <a href="/o/">VoidRelay</a> — tu as le prix en direct, les ducats et (pour les Primes) le comparatif pièces/set.</p>

<h2>2. Poster un ordre</h2>
<p>Sur Warframe Market, crée un ordre de <b>vente</b> (au médian, ou un peu en dessous pour vendre vite) ou d'<b>achat</b> (un peu en dessous du marché). Reste connecté en jeu : l'acheteur/vendeur t'envoie un message, tu l'invites dans ton dojo ou un relais, et vous validez l'échange. Pour vérifier un prix avant de poster, passe par l'<a href="/estimateur">estimateur</a>, et le <a href="/trade">générateur de message de trade</a> écrit ton WTS/WTB proprement.</p>

<h2>3. La taxe d'échange</h2>
<p>Chaque échange coûte des <b>crédits</b> (taxe d'échange), proportionnelle à la valeur des objets. Garde toujours une réserve de crédits. Et fais tes échanges dans ton <b>dojo</b> plutôt qu'au bazar de Maroo : Maroo ajoute <b>10 % de taxe en plus</b> (1 M → 1,1 M de crédits sur un mod Primed). Tu as aussi un <b>nombre d'échanges quotidiens</b> limité par ton rang de maîtrise (MR).</p>

<h2>4. Pièges à éviter</h2>
<ul>
<li>Ne brade pas : vérifie le prix avant de vendre (beaucoup de débutants vendent 10× trop bas).</li>
<li>Méfie-toi des prix « trop beaux » à l'achat (arnaques rares mais possibles).</li>
<li>Pour les objets vaultés ou récents, les prix bougent vite — recheck juste avant l'échange.</li>
</ul>

<h2>5. Quoi vendre quand on débute</h2>
<p>Commence par les <a href="/o/c/sets">sets Prime</a> et les <a href="/o/c/mods">mods rares</a> que tu drops. Vois notre <a href="/guides/farmer-platine-gratuit">guide pour farmer du platine</a> pour la liste complète des sources.</p>

<p>Des questions ? La <a href="/faq">FAQ Warframe</a> répond aux plus courantes.</p>
`,
  },
  {
    slug: "prime-resurgence-reliques",
    banner: "/assets/banners/fam-reliques.webp",
    title: "Prime Resurgence & reliques : obtenir les Primes vaultés",
    h1: "Prime Resurgence et reliques : comment obtenir les Primes",
    desc: "Comment récupérer les Warframes et armes Prime vaultées via Prime Resurgence (Varzia) et le système de reliques du Vide dans Warframe.",
    body: `
<p>Tu veux un <b>Prime vaulté</b> qui n'est plus dans les drops normaux ? Deux voies : <b>Prime Resurgence</b> et le marché.</p>

<h2>Prime Resurgence (Varzia)</h2>
<p><b>Varzia</b>, au Bazar de Maroo, propose en rotation des Warframes et armes Prime vaultées contre de l'<b>Aya</b> et de l'<b>Aya régalien</b> (Regal Aya). C'est le moyen officiel de récupérer un ancien Prime sans passer par le marché. La rotation n'a <b>pas d'ordre prédéfini</b> : la résurgence suivante n'est révélée qu'en cours de cycle, environ deux semaines avant la fin. Les objets en rotation et le lieu sont affichés en direct sur le <a href="/hub">tableau de bord</a> et dans les <a href="/bons-plans">bons plans</a>.</p>

<h2>Les reliques du Vide</h2>
<p>Les <a href="/o/c/reliques">reliques</a> (Lith, Meso, Neo, Axi) contiennent les pièces Prime. Pour en ouvrir :</p>
<ol>
<li>Équipe une relique correspondant à la pièce voulue.</li>
<li>Lance une mission <b>Faille du Vide</b> (Void Fissure) de la bonne ère.</li>
<li>Récupère 10 Réactifs du Vide pendant la mission pour « activer » ta relique.</li>
<li>À la fin, choisis parmi les récompenses (en groupe : 4 choix).</li>
</ol>
<p>Raffine tes reliques (Traces du Vide) jusqu'à <b>Radiant</b> pour maximiser les chances de pièce rare.</p>

<h2>Acheter directement</h2>
<p>Pas envie de farmer ? Tu peux acheter les pièces ou le <a href="/o/c/sets">set complet</a> à d'autres joueurs. Compare toujours le prix des pièces vs le set sur la <a href="/o/">page objet</a> avant d'acheter.</p>

<p>Plus d'infos dans la <a href="/faq">FAQ</a> et le <a href="/guides/">centre de guides</a>.</p>
`,
  },
  {
    slug: "meilleures-warframes-debutant",
    banner: "/assets/banners/fam-progression.webp",
    title: "Meilleures Warframes pour débuter (guide 2026)",
    h1: "Les meilleures Warframes pour débuter dans Warframe",
    desc: "Quelles Warframes choisir quand on débute : faciles à jouer, polyvalentes et faciles à obtenir. Notre sélection pour bien démarrer et farmer efficacement.",
    body: `
<p>Au début de Warframe, certaines Warframes rendent l'aventure bien plus simple : survie facile, dégâts fiables et farm rapide. Voici nos recommandations pour débuter.</p>

<h2>Rhino — le char increvable</h2>
<p>Rhino est LE choix débutant : sa compétence <b>Carapace de fer</b> le rend quasi invincible un moment, et <b>Charge</b> inflige de gros dégâts. Facile à obtenir (boss Jackal sur Vénus). Son set Prime est aussi très accessible — vois le <a href="/o/rhino_prime_set">prix de Rhino Prime</a>.</p>

<h2>Excalibur — polyvalent et solide</h2>
<p>Disponible dès le début pour beaucoup de joueurs, Excalibur excelle au corps-à-corps avec son <b>Lame exaltée</b> et reste utile à tous les niveaux.</p>

<h2>Frost / Volt — contrôle et dégâts</h2>
<p>Volt offre vitesse et dégâts électriques (excellent en début/milieu de jeu), Frost protège avec sa <b>Bulle de givre</b> (idéal pour les missions de défense).</p>

<h2>Comment obtenir d'autres Warframes</h2>
<p>La plupart des Warframes se farment en battant des boss (leurs composants) puis en les fabriquant à la Foundry. Tu peux aussi acheter les <b>pièces Prime</b> à d'autres joueurs : compare les prix des <a href="/o/c/pieces-et-plans">pièces et plans</a> et des <a href="/o/c/sets">sets Prime</a>.</p>

<p><b>Le conseil du <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">SOS Bambi de Pandaahh</a></b> : la moitié des Warframes s'obtiennent très facilement — va les chercher, ne serait-ce que pour les paliers de maîtrise. Le <b>laboratoire Tenno d'un dojo</b> en vend six d'un coup contre des crédits (Banshee, Nezha, Nova, Volt, Wukong, Zephyr) ; Khora tombe dès les premières rotations de l'Assaut du Sanctuaire, Nekros chez Lephantis (Magnacidium, sur Deimos — prioritaire : sa Profanation double le butin de tout le groupe), Gara via la quête de Cetus et Garuda via celle de Fortuna.</p>
<p>Pour financer tes achats, lis notre guide <a href="/guides/farmer-platine-gratuit">farmer du platine gratuitement</a>.</p>
`,
  },
  {
    slug: "steel-path-debuter",
    banner: "/assets/banners/fam-endgame.webp",
    title: "Steel Path : guide pour bien débuter (Warframe)",
    h1: "Steel Path : par où commencer",
    desc: "Le mode Steel Path expliqué : à quoi il sert, quand s'y mettre, les récompenses (essences, Teshin) et les builds pour survivre au end-game de Warframe.",
    faq: [
      { q: "Quand se mettre au Steel Path ?", a: "Attends d'avoir fini la carte normale et d'avoir un build solide (Warframe et arme bien moddées, arcanes) : les ennemis du Steel Path ont énormément de vie et d'armure, inutile de t'y lancer trop tôt." },
    ],
    body: `
<p>Le <b>Steel Path</b> est le mode « new game + » de Warframe : la carte entière en plus difficile (ennemis niveau 100+). C'est l'étape end-game pour les récompenses et le défi.</p>

<h2>Quand s'y mettre ?</h2>
<p>Attends d'avoir <b>fini la carte normale</b> et un build solide (Warframe et arme bien moddées, arcanes). Inutile de t'y lancer trop tôt : les ennemis ont énormément de vie et d'armure.</p>

<h2>Les récompenses</h2>
<ul>
<li><b>Essences Steel</b> : monnaie échangée chez Teshin contre des objets exclusifs (arcanes, Kuva, etc.). La récompense hebdomadaire d'honneurs change chaque semaine — suis-la sur le <a href="/hub">tableau de bord</a>.</li>
<li><b>Nouveau (maj 43)</b> : le Steel Path existe aussi en <b>Railjack</b> — ennemis +50 niveaux, plus de ressources, Essence d'Acier sur les Eximus et fissures dédiées. Le détail est dans <a href="/guides/ombres-de-jade-constellations">notre récap de la mise à jour</a>.</li>
<li><b>+100 % de chance de drop de ressources et +100 % de chance de drop de mods</b> sur toutes les missions Steel Path (cumulable avec les boosters) : les vrais farms de ressources se font ici — <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">conseil répété par Pandaahh</a> à tout joueur qui débloque le mode.</li>
</ul>

<h2>Comment survivre</h2>
<p>Privilégie le <b>perçage d'armure</b> (mods Corrosive, Viral), des Warframes tanky ou de contrôle, et des arcanes de survie. Les <a href="/o/c/arcanes">arcanes</a> et <a href="/o/c/mods">mods</a> font toute la différence à ce niveau.</p>

<p>Besoin de platine pour t'équiper ? Vois <a href="/guides/farmer-platine-gratuit">comment en farmer</a>.</p>
`,
  },
  {
    slug: "chasse-eidolons",
    banner: "/assets/banners/fam-chasse.webp",
    title: "Chasse aux Eidolons : guide complet (Warframe)",
    h1: "Chasse aux Eidolons : guide complet",
    desc: "Comment chasser les Eidolons dans Warframe : prérequis, déroulé d'une nuit sur Cetus, équipement (amp, Warframe) et récompenses (arcanes, focus).",
    faq: [
      { q: "Quand chasser les Eidolons ?", a: "Uniquement pendant la nuit sur Cetus, sur un cycle d'environ 50 minutes de nuit pour 100 minutes de jour. Le compte à rebours jour/nuit est affiché en direct sur le tableau de bord VoidRelay." },
    ],
    body: `
<p>Les <b>Eidolons</b> sont d'immenses boss qui apparaissent <b>la nuit sur les Plaines d'Eidolon</b> (Cetus). Les chasser est l'une des meilleures sources d'<a href="/o/c/arcanes">arcanes</a>.</p>

<h2>Quand chasser ?</h2>
<p>Uniquement <b>pendant la nuit</b> sur Cetus (cycle ~50 min de nuit / 100 min de jour). Le compte à rebours jour/nuit est affiché en direct sur le <a href="/hub">tableau de bord</a>.</p>

<h2>Prérequis</h2>
<ul>
<li>Avoir terminé la quête « Saya's Vigil » pour accéder aux Plaines.</li>
<li>Un <b>Amp</b> (arme d'Opérateur) correct pour casser les boucliers de l'Eidolon — la recette validée par <a href="https://www.youtube.com/watch?v=L62i1HUAa7I" target="_blank" rel="noopener">Pandaahh (SOS Bambi)</a> : l'ampli « 123 » (prisme <b>Raplak</b>, échafaud <b>Shraksun</b>, entretoise <b>Lohrin</b> — chez les Quills à Cetus, rangs 1 à 3), « tu pourrais faire tout le jeu avec ». Ajoute l'arcane <b>Éradication Éternelle</b> (+60 % de dégâts d'ampli pendant 8 s après un pouvoir d'Opérateur — ~20 pl sur le marché, ou chez Cavalero au Zariman).</li>
<li>Une Warframe de soutien (Trinity, Volt, Harrow…) et des armes à fort piquant.</li>
</ul>

<h2>Récompenses</h2>
<p>Les Eidolons donnent des <b>arcanes</b> (très recherchés et revendables), du <b>focus</b> et des éclats. Les arcanes Eidolon sont une excellente source de <a href="/guides/farmer-platine-gratuit">platine</a> à la revente.</p>
`,
  },
  {
    slug: "nightwave-explication",
    banner: "/assets/banners/fam-progression.webp",
    title: "Nightwave Warframe : tout comprendre (guide)",
    h1: "Nightwave : comment ça marche",
    desc: "Le système Nightwave de Warframe expliqué : défis, rangs, récompenses (crédits Aya, potatoes, cosmétiques) et la boutique de Nora. Comment ne rien rater.",
    body: `
<p><b>Nightwave</b> est le « battle pass » gratuit de Warframe : tu accomplis des défis pour gagner du <b>standing</b>, monter des rangs et débloquer des récompenses.</p>

<h2>Les défis</h2>
<p>Chaque jour et chaque semaine, de nouveaux défis apparaissent (quotidiens, hebdomadaires, et « élites » plus durs). Le nombre de défis actifs est visible sur le <a href="/hub">tableau de bord</a>. Fais-en le maximum chaque semaine pour ne pas prendre de retard.</p>

<h2>Les récompenses</h2>
<ul>
<li><b>Crédits Aura, réacteurs/catalyseurs (potatoes)</b>, cosmétiques exclusifs.</li>
<li><b>Crédits Nightwave</b> à dépenser dans la boutique de Nora (slots d'armes/Warframe, Kuva, Nitain, etc.).</li>
</ul>

<h2>Conseil</h2>
<p>Les <b>slots</b> et <b>potatoes</b> gratuits de Nightwave t'économisent beaucoup de <a href="/guides/farmer-platine-gratuit">platine</a> — priorise-les. Garde aussi un œil sur <a href="/bons-plans">les bons plans</a> du marché.</p>
`,
  },
  {
    slug: "monter-rang-maitrise",
    banner: "/assets/banners/fam-progression.webp",
    title: "Monter son rang de maîtrise (MR) vite — Warframe",
    h1: "Comment monter son rang de maîtrise rapidement",
    desc: "Le rang de maîtrise (MR) dans Warframe : à quoi il sert, comment gagner de l'XP de maîtrise vite (nouvelles armes et Warframes) et réussir les tests.",
    body: `
<p>Le <b>rang de maîtrise</b> (MR) débloque des armes, augmente ta capacité d'échanges quotidiens et tes plafonds. Le monter vite ouvre tout le jeu.</p>

<h2>Comment gagner de l'XP de maîtrise</h2>
<ul>
<li><b>Monter chaque arme et Warframe au rang 30</b> donne de l'XP de maîtrise — une seule fois par objet. La clé : <b>fabriquer et leveler un maximum d'objets différents</b>.</li>
<li>Leveler efficacement sur des missions adaptées (Hydron sur Sedna, Elite Sanctuary Onslaught…).</li>
<li>À chaque nouveau palier, <b>purge le marché du vaisseau des armes en crédits</b> et garde ta fonderie toujours pleine — le réflexe détaillé dans <a href="/guides/orbiter-guide-complet">le guide de l'Orbiter</a>.</li>
</ul>

<h2>Astuce achat</h2>
<p>Acheter des armes et composants à d'autres joueurs te permet de leveler des objets que tu n'as pas encore farmés → MR plus rapide. Compare les prix sur <a href="/o/">VoidRelay</a> (la maîtrise requise est aussi indiquée sur warframe.market).</p>

<h2>Les tests de maîtrise</h2>
<p>À chaque palier, un <b>test</b> t'attend. Entraîne-toi au Relais (auprès de Cephalon Simaris) avant de le passer. Si tu rates, tu peux réessayer le lendemain.</p>

<p>Pour financer tes achats d'armes, vois <a href="/guides/farmer-platine-gratuit">comment farmer du platine</a> et <a href="/guides/trading-warframe-market">débuter le trading</a>.</p>
`,
  },
  {
    slug: "tier-list-warframes",
    banner: "/assets/banners/fam-progression.webp",
    title: "Tier list Warframe 2026 : les meilleures Warframes",
    h1: "Les meilleures Warframes en 2026 (tier list)",
    desc: "Notre tier list des Warframes en 2026 : les frames les plus fortes par rôle (DPS, tank, soutien, furtivité), pourquoi elles dominent, et par quoi commencer selon ton style.",
    faq: [
      { q: "Quelle est la meilleure Warframe en 2026 ?", a: "Il n'y a pas une seule « meilleure » Warframe : tout dépend du rôle. Saryn domine le nettoyage de salles, Mesa le DPS monocible, Wisp le soutien, Rhino et Nekros restent des valeurs sûres pour tanker et farmer. Le meilleur choix est la frame la plus forte dans TON style de jeu." },
      { q: "Quelle Warframe pour le Steel Path ?", a: "Privilégie les frames qui survivent et suppriment l'armure : Saryn, Wisp, Octavia ou Khora s'en sortent très bien au Steel Path avec un build correct. L'équipement (mods, arcanes) compte autant que la frame elle-même." },
    ],
    body: `
<p>Les <b>meilleures Warframes en 2026</b>, en un coup d'œil : <b>Saryn</b> (AoE), <b>Mesa</b> (DPS), <b>Wisp</b> (soutien), <b>Octavia</b> (polyvalence), <b>Khora</b> (farm) dominent le haut du panier, et <b>Rhino</b> reste le meilleur point d'entrée. Le détail par rôle ci-dessous — avec, pour chacune, un <a href="/builds/">build prêt à jouer</a>.</p>

<p class="muted">Classement éditorial VoidRelay : il reflète l'efficacité en jeu constatée sur les contenus qui comptent (missions courantes, farm, <a href="/guides/steel-path-debuter">Steel Path</a>), pas un chiffre officiel. Toute tier list est un instantané — les équilibrages bougent.</p>

<h2>🥇 Le sommet (S) — dominantes partout</h2>
<ul>
<li><b><a href="/builds/saryn">Saryn</a></b> — la reine de l'AoE : ses spores nettoient des salles entières et son efficacité grimpe encore avec la taille du groupe d'ennemis. Imbattable en survie et défense.</li>
<li><b><a href="/builds/mesa">Mesa</a></b> — le DPS monocible le plus direct du jeu : ses régulateurs verrouillent et fondent tout ce qui s'approche. Simple, brutal, efficace.</li>
<li><b><a href="/builds/wisp">Wisp</a></b> — le meilleur soutien : vitesse d'attaque, soin et vie bonus pour toute l'équipe, avec une vraie capacité offensive. Bienvenue dans chaque escouade.</li>
<li><b><a href="/builds/octavia">Octavia</a></b> — polyvalence extrême : dégâts qui suivent le niveau des ennemis, invisibilité pour l'équipe, jouable partout jusqu'au très haut niveau.</li>
</ul>

<h2>🥈 Très fortes (A) — spécialistes redoutables</h2>
<ul>
<li><b><a href="/builds/khora">Khora</a></b> — dégâts métalliques massifs et <b>meilleure frame de farm</b> avec sa Strangledome + Pilfering. Incontournable en survie de ressources.</li>
<li><b><a href="/builds/nova">Nova</a></b> — contrôle de foule et accélération/ralentissement des ennemis : elle dicte le rythme de la mission entière.</li>
<li><b><a href="/builds/nekros">Nekros</a></b> — le fermier : Désécration double le butin. Pas le plus flashy, mais ton stock de ressources le remercie.</li>
<li><b><a href="/builds/volt">Volt</a></b> — vitesse pour tout le monde, gros burst électrique et bouclier utile : excellent du début à la fin du jeu.</li>
</ul>

<h2>🥉 Valeurs sûres (B) — solides et accessibles</h2>
<ul>
<li><b><a href="/builds/rhino">Rhino</a></b> — le tank increvable : Peau de Fer pardonne toutes les erreurs. <b>Le meilleur premier choix</b> pour débuter (vois <a href="/guides/meilleures-warframes-debutant">notre guide débutant</a>).</li>
<li><b><a href="/builds/frost">Frost</a></b> — le spécialiste défense : son Globe de Neige protège n'importe quel objectif.</li>
<li><b><a href="/builds/loki">Loki</a></b> — furtivité pure : invisibilité longue durée pour l'espionnage et les captures sans se battre.</li>
<li><b><a href="/builds/ember">Ember</a></b> — nettoyage incendiaire des niveaux bas et moyens, très agréable à jouer en mission rapide.</li>
</ul>

<h2>Comment choisir TA meilleure Warframe</h2>
<ol>
<li><b>Ton style d'abord</b> : gros dégâts (Saryn, Mesa), jouer utile en équipe (Wisp, Trinity), farmer efficace (Khora, Nekros), tranquillité (Rhino, Loki).</li>
<li><b>Le build fait la moitié du travail</b> : une frame S mal moddée perd contre une frame B bien équipée — nos <a href="/builds/">builds</a> donnent la configuration exacte.</li>
<li><b>Le prix compte</b> : beaucoup de ces frames s'obtiennent en farmant leurs composants, et leurs versions Prime s'échangent — compare sur les <a href="/o/c/sets">sets Prime</a> avant d'acheter quoi que ce soit.</li>
</ol>

<p>Pour t'équiper sans payer, lis <a href="/guides/farmer-platine-gratuit">comment farmer du platine</a> ; pour le end-game, <a href="/guides/steel-path-debuter">par où commencer le Steel Path</a>.</p>
`,
  },
  {
    slug: "liche-kuva",
    banner: "/assets/banners/fam-progression.webp",
    title: "Liche Kuva Warframe : arme, élément, comment la battre",
    h1: "Liche Kuva : arme, élément et comment s'en débarrasser",
    desc: "Comment naît une Liche Kuva, comment trouver son élément et la bonne combinaison de mods Requiem, et le choix entre l'exécuter ou la convertir.",
    faq: [
      { q: "Comment obtenir une Liche Kuva ?", a: "En mission, un ennemi Grineer normal peut se transformer en Larve (annoncée par un message à l'écran). Blesse-la sans l'achever : elle s'enfuit et devient ta Liche Kuva personnelle, avec une arme et un élément aléatoires." },
      { q: "Comment connaître l'élément de sa Liche ?", a: "L'élément (et les mods Requiem à écarter) s'affiche directement sur la fiche de la Liche dans le menu Traque, déduit automatiquement à partir des indices récoltés sur ses Sbires — pas besoin de deviner à l'aveugle." },
      { q: "Tuer ou convertir sa Liche ?", a: "L'exécuter donne une chance de récupérer son éphémère (effet visuel cosmétique) et récupère l'arme immédiatement. La convertir en transforme l'arme en allié combattant à tes côtés en mission, sans éphémère ni arme utilisable tout de suite." },
      { q: "Peut-on choisir l'élément de sa Liche à l'avance ?", a: "Oui, indirectement : l'élément par défaut dépend de la Warframe utilisée pour le coup de grâce sur la Larve. Chaque Warframe est rattachée à l'un des 7 éléments — vise la bonne frame avant de blesser la Larve pour orienter le tirage." },
    ],
    body: `
<p>Une <b>Liche Kuva</b> naît quand tu blesses une Larve (un ennemi Grineer transformé en cours de mission) sans l'achever : elle s'enfuit et devient ton ennemi personnel, avec une <b>arme Kuva</b> et un <b>élément</b> tirés au hasard. La bonne nouvelle : tu n'as pas besoin de deviner son point faible à l'aveugle — et tu peux même orienter le tirage dès le départ.</p>

<h2>Choisir l'élément dès la naissance de la Liche</h2>
<p>Ce n'est pas totalement aléatoire : l'élément par défaut de l'arme (et le thème de l'éphémère, si tu exécutes) dépend de la <b>Warframe équipée au moment du coup de grâce</b> sur la Larve. Chaque Warframe est rattachée à l'un des 7 éléments suivants :</p>
<ul>
<li><b>Impact</b> : Baruuk, Dante, Gauss, Grendel, Rhino, Sevagoth, Sirius &amp; Orion, Wukong, Zephyr.</li>
<li><b>Chaleur</b> : Chroma, Ember, Inaros, Jade, Kullervo, Nezha, Protea, Temple, Uriel, Vauban, Wisp.</li>
<li><b>Froid</b> : Frost, Gara, Hildryn, Koumei, Revenant, Styanax, Titania, Trinity.</li>
<li><b>Électricité</b> : Banshee, Caliban, Excalibur, Follie, Gyre, Limbo, Nova, Valkyr, Volt.</li>
<li><b>Toxine</b> : Atlas, Dagath, Ivara, Khora, Nekros, Nidus, Nokko, Oberon, Oraxia, Saryn.</li>
<li><b>Magnétique</b> : Citrine, Cyte-09, Harrow, Hydroid, Lavos, Mag, Mesa, Xaku, Yareli.</li>
<li><b>Radiation</b> : Ash, Equinox, Garuda, Loki, Mirage, Nyx, Octavia, Qorvex, Voruna.</li>
</ul>
<p class="muted">La version Primed ou Umbra d'une Warframe garde le même élément que sa version de base. Table vérifiée le 10/07/2026 sur le module de données du wiki officiel Warframe (wiki.warframe.com), recoupée avec un second guide indépendant : 2 entrées récentes (Sirius &amp; Orion, Follie) n'apparaissent que dans une des deux sources, vraisemblablement parce que le guide tiers n'a pas encore été mis à jour depuis leur sortie.</p>

<h2>Trouver l'élément et les mods à écarter</h2>
<p>Chaque mission de <b>Vestige Kuva</b> (Siphon) ou <b>Déferlante Kuva</b> (Flood) te fait tuer des <b>Sbires</b> de ta Liche : chacun révèle un indice qui élimine un mod Requiem candidat. Après assez d'indices, ta fiche de Traque affiche directement l'élément de la Liche et les mods à ne PAS utiliser — plus qu'à trouver le bon ordre des 3 mods restants par élimination lors de la confrontation finale.</p>

<h2>Les mods Requiem</h2>
<p>Il existe <b>8 mods Requiem</b> (Netra, Ris, Vome, Khra, Xata, Jahu, Oull, Lohk), obtenus en ouvrant des <a href="/o/c/reliques">reliques Requiem</a>. Chaque Liche est vulnérable à exactement 3 d'entre eux, dans un ordre précis, équipés sur le Parazon. <b>Oull</b> fait exception : c'est un joker qui remplace n'importe lequel des 8 symboles, pratique si ta collection est incomplète.</p>

<h2>Pendant le combat : évite SON élément</h2>
<p>L'arme de ta Liche porte l'un des <b>éléments de dégâts</b> classiques. Utiliser ce même élément sur elle la soigne au lieu de la blesser — vérifie l'élément affiché sur sa fiche et adapte ton arme (ou retire temporairement le mod élémentaire correspondant) avant l'affrontement.</p>

<h2>Exécuter ou convertir ?</h2>
<ul>
<li><b>Exécuter</b> : tu récupères l'arme immédiatement, avec une chance d'obtenir l'<b>éphémère</b> de la Liche (effet cosmétique propre à chaque thème).</li>
<li><b>Convertir</b> : la Liche devient une alliée qui t'accompagne en mission sur demande. Pas d'éphémère, et l'arme n'est pas récupérable tout de suite.</li>
</ul>
<p>Rate la combinaison de mods et la Liche s'enfuit avec un bonus de vie/dégâts supplémentaire (et un symbole Requiem définitivement écarté pour elle) — pas grave, retente une mission de Vestige/Déferlante pour continuer à réduire les possibilités.</p>

<h2>Et les Sœurs de Parvos ?</h2>
<p>Le système des <b>Sœurs de Parvos</b> (Corpus) fonctionne à l'identique, mais donne des <b>armes Tenet</b> au lieu de Kuva. Tout ce qui précède (indices, mods Requiem, exécuter/convertir) s'applique pareil. À ne pas confondre avec les <a href="/guides/armes-coda">armes Coda</a> : malgré le nom qui y ressemble parfois dans les recherches, ce n'est PAS une Liche — elles s'achètent directement chez une marchande, sans traque.</p>

<p>Pour équiper l'arme Kuva que tu récupères, vois nos <a href="/builds/kuva-nukor">builds d'armes</a>. Pour financer tes reliques Requiem et le reste de ton stuff, <a href="/guides/farmer-platine-gratuit">farme du platine</a> et compare les prix sur <a href="/o/">nos pages objets</a>.</p>
`,
  },
  {
    slug: "farmer-endo-aya",
    banner: "/assets/banners/fam-progression.webp",
    title: "Farmer l'Endo et l'Aya efficacement dans Warframe (guide 2026)",
    h1: "Farmer de l'Endo et de l'Aya efficacement",
    desc: "Les meilleures sources d'Endo (Arbitrations, sculptures Ayatan, reliques) et d'Aya (Netracells) dans Warframe, avec les combos qui rapportent le plus par heure.",
    faq: [
      { q: "Quelle est la meilleure façon de farmer de l'Endo ?", a: "Les Arbitrations donnent le meilleur rendement passif sur la durée (Endo en rotation régulière). Pour un gros apport ponctuel, écrase des sculptures Ayatan remplies d'étoiles chez Cephalon Simaris — souvent plusieurs milliers d'Endo d'un coup." },
      { q: "Comment farmer de l'Aya rapidement ?", a: "Les Netracells (exclusivement en Steel Path) sont la source principale d'Aya, avec un bonus garanti sur le premier Netracell complété chaque jour. L'Onslaught du Sanctuaire (classique ou Elite) en donne aussi, en plus petite quantité." },
    ],
    body: `
<p>L'<b>Endo</b> sert à faire monter le rang de tes mods, et l'<b>Aya</b> à acheter les objets vaultés de <b>Prime Resurgence</b> chez Varzia. Deux monnaies de fin de partie, deux façons très différentes de les farmer — voici les meilleures.</p>

<h2>Farmer l'Endo</h2>
<ul>
<li><b>Arbitrations</b> : le meilleur rendement passif — chaque rotation a une chance de donner de l'Endo en bonne quantité, sur n'importe quelle mission d'Arbitration.</li>
<li><b>Sculptures Ayatan</b> : ramasse-les en mission (surtout Spy et Cave), insère des étoiles Ayatan dans leurs emplacements, puis va les écraser chez <b>Cephalon Simaris</b> au Relais — souvent plusieurs milliers d'Endo d'un coup pour une sculpture bien remplie.</li>
<li><b>Reliques du Vide</b> : une petite quantité d'Endo apparaît régulièrement parmi les récompenses de Failles, en plus des pièces Prime.</li>
<li><b>Vendre tes mods en trop</b> : depuis l'écran de gestion des mods, convertis en Endo les doublons et mods inutiles qui traînent — rendement faible mais gratuit.</li>
</ul>
<p><a href="/builds/nekros">Nekros</a> et sa Désécration augmentent tes chances de drop de sculptures et de reliques sur la mission — utile si tu enchaînes les farms d'Endo en groupe.</p>

<h2>Farmer l'Aya</h2>
<p>Les <b>Netracells</b> (missions exclusivement en <a href="/guides/steel-path-debuter">Steel Path</a>) sont la source principale d'Aya, avec un <b>bonus garanti sur le premier Netracell complété chaque jour</b> — enchaîne-les quotidiennement pour un flux régulier. L'<b>Onslaught du Sanctuaire</b> (classique ou Elite) en donne aussi, en quantité plus modeste, si tu préfères une mission sans fin plutôt qu'un Netracell.</p>
<p>Une fois ton stock constitué, dépense ton Aya chez <b>Varzia</b> pendant une fenêtre de <a href="/guides/prime-resurgence-reliques">Prime Resurgence</a> — vois notre guide dédié pour savoir quoi prendre en priorité.</p>

<p>Pour suivre l'état du monde (Netracells, Prime Resurgence en cours) en direct, utilise le <a href="/hub">tableau de bord VoidRelay</a>.</p>
`,
  },
  {
    slug: "armes-coda",
    banner: "/assets/banners/fam-endgame.webp",
    title: "Armes Coda Warframe : comment les obtenir (ce n'est PAS une Liche)",
    h1: "Armes Coda : comment les obtenir",
    desc: "Les armes Coda ne s'obtiennent pas via une Liche : voici le vrai système (Eleanor, Live Heartcell, bonus Progéniteur) et la liste des 14 armes disponibles.",
    faq: [
      { q: "Les armes Coda sont-elles liées aux Liches ?", a: "Non. Contrairement aux armes Kuva (Liches Kuva) ou Tenet (Sœurs de Parvos), les armes Coda s'achètent directement chez Eleanor, une marchande du syndicat The Hex, sans traque ni mods à deviner." },
      { q: "Comment obtenir des Live Heartcell ?", a: "En vainquant un Technocyte Coda, un ennemi rencontré à Höllvania. Chaque arme Coda coûte 10 Live Heartcell chez Eleanor." },
      { q: "Peut-on changer le bonus élémentaire d'une arme Coda ?", a: "Oui : le bonus de dégâts (« bonus Progéniteur ») est attribué aléatoirement à l'achat et se renouvelle tous les 4 jours chez Eleanor — pas besoin de reliques ni de farm supplémentaire pour en tenter un autre." },
    ],
    body: `
<p>Les <b>armes Coda</b> ne s'obtiennent PAS via un système de Liche : pas de traque, pas de mods Requiem à deviner. Elles s'achètent directement chez <b>Eleanor</b>, marchande du syndicat <b>The Hex</b> à Höllvania, contre des <b>Live Heartcell</b>.</p>

<h2>Comment les obtenir</h2>
<ol>
<li><b>Vaincs un Technocyte Coda</b> (un ennemi infesté rencontré à Höllvania) : il laisse tomber des <b>Live Heartcell</b>.</li>
<li><b>Va voir Eleanor</b> (The Hex, Höllvania Central Mall) : chaque arme Coda coûte <b>10 Live Heartcell</b>.</li>
<li>Aucune relique, aucun mod à rechercher — le prix se paie uniquement en Heartcell.</li>
</ol>

<h2>Le bonus Progéniteur</h2>
<p>Chaque arme Coda porte un <b>bonus de dégâts élémentaire aléatoire</b> (le « bonus Progéniteur »), attribué au moment de l'achat. Il ne te plaît pas ? Pas besoin de tout refarmer : l'offre d'Eleanor <b>se renouvelle tous les 4 jours</b>, avec un nouveau tirage à chaque fois.</p>

<h2>Les 14 armes Coda</h2>
<p>Bassocyst (fusil à pompe), Bubonico (fusil), Catabolyst (pistolet), Caustacyst (mêlée), Hema (fusil), Hirudo (mêlée), Mire (mêlée), Motovore (mêlée), Pathocyst (mêlée), Pox (pistolet), Sporothrix (sniper), Synapse (fusil), Tysis (pistolet) et Dual Coda Torxica (pistolet). Toutes introduites avec la mise à jour 42.0 (« The Shadowgrapher »).</p>

<p>Pour les autres systèmes à récompense aléatoire de Warframe, vois notre guide <a href="/guides/liche-kuva">Liche Kuva</a> (armes Kuva, mods Requiem) — un mécanisme différent, à ne pas confondre.</p>
`,
  },
];

/* Versions anglaises (marché de recherche EN, bien plus large). Chaque guide EN
   est apparié à son équivalent FR via "fr" pour le hreflang. */
export const GUIDES_EN = [
  {
    slug: "farm-platinum-free", fr: "farmer-platine-gratuit",
    title: "How to Farm Platinum for Free in Warframe (2026 Guide)",
    h1: "How to Farm Platinum for Free in Warframe",
    desc: "The complete guide to earning platinum without paying in Warframe: sell Prime parts, mods, relics and arcanes on the market, and learn what's worth the most.",
    body: `
<p><b>Platinum</b> is Warframe's premium currency, but you don't have to <b>buy it</b> — you can earn it all just by playing, then trading your items with other players. Here are the most profitable methods, from easiest to most advanced.</p>
<h2>1. Sell Prime parts and sets</h2>
<p>This is the #1 platinum source. <b>Prime</b> items come from opening <a href="/o/c/reliques">Void relics</a> in Fissure missions. Once you have a full set's parts, sell them individually or as a <a href="/o/c/sets">complete set</a>. Always check the live price first — a recent or vaulted Prime set can be worth 100–300+ platinum.</p>
<p>Tip: on every <a href="/o/">item page</a>, compare "parts vs set" — sometimes selling parts separately earns more than the full set.</p>
<h2>2. Sell rare mods</h2>
<p>Many <a href="/o/c/mods">mods</a> sell well: syndicate augment mods, rare Nightmare mods, Primed mods and Sortie rewards. Keep an eye on rare drops — some are worth 50–150+ platinum.</p>
<h2>3. Arcanes</h2>
<p><a href="/o/c/arcanes">Arcanes</a> (Eidolons, Profit-Taker, etc.) are in high demand for end-game builds and resell well, even un-maxed.</p>
<h2>4. Rivens</h2>
<p><a href="/o/c/rivens">Riven mods</a> have random stats: a well-rolled riven on a popular weapon can be worth hundreds or thousands of platinum — the highest ceiling.</p>
<h2>How to actually sell</h2>
<ul><li>List your items on Warframe Market at the median price (or slightly below to sell fast).</li><li>Stay online in-game; buyers message you, you invite them and trade.</li><li>Watch the <a href="/bons-plans">daily deals</a> to know what to sell when prices spike.</li></ul>
<p>Track live prices with the <a href="/hub">VoidRelay dashboard</a> and <a href="/o/">item search</a>.</p>
`,
  },
  {
    slug: "farm-ducats", fr: "farmer-ducats",
    title: "Ducats in Warframe: How to Farm Them Fast (Guide)",
    h1: "How to Farm Ducats Efficiently in Warframe",
    desc: "Guide to farming ducats in Warframe: which Prime parts to give Baro Ki'Teer, the best ducats-per-platinum ratio, and how to optimize your relics.",
    body: `
<p><b>Ducats</b> are used to buy <a href="/o/c/sets">Baro Ki'Teer</a>'s items. You earn them by "recycling" Prime parts at the Void Relic kiosk. Here's how to farm a lot without wasting value.</p>
<h2>How much is a Prime part worth?</h2>
<ul><li><b>Common</b> Prime parts: 15 ducats</li><li><b>Uncommon</b>: 45 ducats</li><li><b>Rare</b>: 65 to 100 ducats</li></ul>
<p>Every <a href="/o/">item page</a> on VoidRelay shows the item's <b>ducats and the ducats/platinum ratio</b> — the key number to decide whether to recycle a part or sell it for platinum.</p>
<h2>The best strategy</h2>
<ol><li><b>Open relics</b> in Void Fissures: each relic gives a Prime part.</li><li><b>Keep for platinum</b> the parts worth a lot on the market.</li><li><b>Recycle into ducats</b> the common parts that are nearly worthless in platinum but give 15 ducats — basically free.</li></ol>
<h2>Optimize relic runs</h2>
<p>Play in a 4-player squad on Fissures: you pick from 4 rewards at the end, multiplying your chances at rare parts. Refine relics with Void Traces (up to Radiant) to boost rare drop odds.</p>
<h2>When to spend ducats</h2>
<p>Save them for <b>Baro Ki'Teer</b> (every 14 days, 48h). See his arrival and inventory on the <a href="/hub">dashboard</a> and read our <a href="/en/guides/baro-kiteer">Baro Ki'Teer guide</a>.</p>
`,
  },
  {
    slug: "baro-kiteer", fr: "baro-kiteer-guide",
    title: "Baro Ki'Teer: When Does He Return and What to Buy?",
    h1: "Baro Ki'Teer: Schedule and What to Buy",
    desc: "Everything about Baro Ki'Teer in Warframe: how often he returns, how long he stays, and which items in his inventory are actually worth your ducats.",
    body: `
<p><b>Baro Ki'Teer</b>, the Void Trader, is a travelling merchant who sells exclusive items for <a href="/en/guides/farm-ducats">ducats</a> and credits.</p>
<h2>When does Baro Ki'Teer return?</h2>
<p>Baro arrives <b>every 14 days</b> and stays <b>48 hours</b> in a Relay, then leaves with his stock. You can see <b>his next visit and live inventory</b> on the <a href="/hub">VoidRelay dashboard</a> (countdown included).</p>
<h2>What to buy first</h2>
<ul><li><b>Primed mods</b> (Primed Continuity, Primed Flow, etc.): the best long-term buys — some later resell for a lot of platinum.</li><li><b>Exclusive weapons and cosmetics</b>, depending on taste and resale.</li><li><b>Avoid</b> spending ducats on decorations if you're optimizing.</li></ul>
<h2>How to prepare</h2>
<p>Before he arrives, stock up on <a href="/en/guides/farm-ducats">ducats</a> by recycling common Prime parts. Aim for 2,000–3,000 ducats to grab several Primed mods.</p>
<p>Resale tip: some Primed mods bought from Baro resell for lots of <a href="/en/guides/farm-platinum-free">platinum</a> later. Watch the <a href="/bons-plans">deals</a>.</p>
`,
  },
  {
    slug: "warframe-market-trading", fr: "trading-warframe-market",
    title: "Trading on Warframe Market: Complete Beginner Guide",
    h1: "Warframe Trading: Complete Beginner Guide",
    desc: "How to trade in Warframe: where to find prices, how to post an order, the trade tax, and the mistakes to avoid so you buy and sell at the right price.",
    body: `
<p><b>Trading</b> between players is the heart of Warframe's economy. Here's how to start the right way.</p>
<h2>1. Know the price</h2>
<p>First, check the <b>real price</b>: median, lowest sell and volume. Search any item on <a href="/o/">VoidRelay</a> for the live price, ducats and (for Primes) the parts-vs-set comparison — or use our <a href="/en/price-check">price checker</a> for an instant lookup with a 90-day history chart.</p>
<h2>2. Post an order</h2>
<p>On Warframe Market, create a <b>sell</b> order (at median, or slightly below to sell fast) or a <b>buy</b> order. Stay online in-game; the other player messages you, you invite them to your dojo or a relay, and confirm the trade.</p>
<h2>3. The trade tax</h2>
<p>Each trade costs <b>credits</b> (a trade tax) proportional to item value. Always keep a credit reserve. You also have a <b>daily trade limit</b> based on your Mastery Rank.</p>
<h2>4. Mistakes to avoid</h2>
<ul><li>Don't undersell: check the price first (many beginners sell 10× too low).</li><li>Be wary of "too good" buy prices.</li><li>For vaulted or recent items, prices move fast — recheck right before trading.</li></ul>
<h2>5. What to sell as a beginner</h2>
<p>Start with <a href="/o/c/sets">Prime sets</a> and the <a href="/o/c/mods">rare mods</a> you drop. See our <a href="/en/guides/farm-platinum-free">platinum farming guide</a> for the full list.</p>
`,
  },
  {
    slug: "best-starter-warframes", fr: "meilleures-warframes-debutant",
    title: "Best Starter Warframes (2026 Guide)",
    h1: "The Best Warframes for Beginners",
    desc: "Which Warframes to pick as a beginner: easy to play, versatile and easy to get. Our picks to start strong and farm efficiently in Warframe.",
    body: `
<p>Early in Warframe, some Warframes make the journey much easier: easy survival, reliable damage and fast farming. Here are our beginner picks.</p>
<h2>Rhino — the unkillable tank</h2>
<p>Rhino is THE beginner pick: <b>Iron Skin</b> makes him nearly invincible for a while, and <b>Rhino Charge</b> deals big damage. Easy to get (Jackal boss on Venus). His Prime set is also very accessible — see the <a href="/o/rhino_prime_set">Rhino Prime price</a>.</p>
<h2>Excalibur — versatile and solid</h2>
<p>Available early for many players, Excalibur excels in melee with his <b>Exalted Blade</b> and stays useful at all levels.</p>
<h2>Frost / Volt — control and damage</h2>
<p>Volt brings speed and electric damage (great early/mid game); Frost protects with his <b>Snow Globe</b> (ideal for Defense missions).</p>
<h2>How to get more Warframes</h2>
<p>Most Warframes are farmed by beating bosses (their components) then crafting them. You can also buy <b>Prime parts</b> from other players: compare prices on the <a href="/o/c/pieces-et-plans">parts &amp; blueprints</a> and <a href="/o/c/sets">Prime sets</a> pages.</p>
<p>To fund your purchases, read our <a href="/en/guides/farm-platinum-free">free platinum farming guide</a>.</p>
`,
  },
  {
    slug: "kuva-lich", fr: "liche-kuva",
    title: "Kuva Lich Guide: Weapon, Element, How to Beat It",
    h1: "Kuva Lich: weapon, element, and how to get rid of it",
    desc: "How a Kuva Lich spawns, how to find its element and the right Requiem mod combo, and whether to kill it or convert it.",
    faq: [
      { q: "How do you get a Kuva Lich?", a: "During a mission, a regular Grineer enemy can turn into a Larvling (a screen message announces it). Damage it without finishing it off: it flees and becomes your personal Kuva Lich, with a random weapon and element." },
      { q: "How do you find your Lich's element?", a: "The element (and the Requiem mods to avoid) shows directly on the Lich's card in the Vanquish menu, deduced automatically from clues gathered from its Thralls — no need to guess blind." },
      { q: "Should you kill or convert your Lich?", a: "Killing it gives a chance at its ephemera (a cosmetic visual effect) and gets you the weapon immediately. Converting turns it into an ally who fights alongside you on request, with no ephemera and no usable weapon right away." },
      { q: "Can you choose your Lich's element in advance?", a: "Yes, indirectly: the default element depends on the Warframe equipped for the mercy kill on the Larvling. Each Warframe is tied to one of 7 elements — bring the right frame before finishing the Larvling to steer the roll." },
    ],
    body: `
<p>A <b>Kuva Lich</b> spawns when you damage a Larvling (a Grineer enemy that transforms mid-mission) without finishing it off: it flees and becomes your personal nemesis, with a random <b>Kuva weapon</b> and <b>element</b>. Good news: you don't need to guess its weakness blind — and you can even steer the roll from the start.</p>

<h2>Choosing the element at the Lich's birth</h2>
<p>It's not entirely random: the weapon's default element (and the ephemera's theme, if you kill it) depends on the <b>Warframe equipped for the mercy kill</b> on the Larvling. Each Warframe is tied to one of 7 elements:</p>
<ul>
<li><b>Impact</b>: Baruuk, Dante, Gauss, Grendel, Rhino, Sevagoth, Sirius &amp; Orion, Wukong, Zephyr.</li>
<li><b>Heat</b>: Chroma, Ember, Inaros, Jade, Kullervo, Nezha, Protea, Temple, Uriel, Vauban, Wisp.</li>
<li><b>Cold</b>: Frost, Gara, Hildryn, Koumei, Revenant, Styanax, Titania, Trinity.</li>
<li><b>Electricity</b>: Banshee, Caliban, Excalibur, Follie, Gyre, Limbo, Nova, Valkyr, Volt.</li>
<li><b>Toxin</b>: Atlas, Dagath, Ivara, Khora, Nekros, Nidus, Nokko, Oberon, Oraxia, Saryn.</li>
<li><b>Magnetic</b>: Citrine, Cyte-09, Harrow, Hydroid, Lavos, Mag, Mesa, Xaku, Yareli.</li>
<li><b>Radiation</b>: Ash, Equinox, Garuda, Loki, Mirage, Nyx, Octavia, Qorvex, Voruna.</li>
</ul>
<p class="muted">A Warframe's Primed or Umbra version keeps the same element as its base version. Table verified 2026-07-10 against the official Warframe wiki's data module (wiki.warframe.com), cross-checked with an independent second guide: 2 recent entries (Sirius &amp; Orion, Follie) only appear in one of the two sources, most likely because the third-party guide hasn't been updated since their release yet.</p>

<h2>Finding the element and mods to avoid</h2>
<p>Every <b>Kuva Siphon</b> or <b>Kuva Flood</b> mission has you kill your Lich's <b>Thralls</b>: each one reveals a clue that rules out one candidate Requiem mod. After enough clues, your Vanquish card directly shows the Lich's element and which mods NOT to use — you just need to find the right order of the remaining 3 mods by elimination during the final showdown.</p>

<h2>The Requiem mods</h2>
<p>There are <b>8 Requiem mods</b> (Netra, Ris, Vome, Khra, Xata, Jahu, Oull, Lohk), obtained by opening <a href="/o/c/reliques">Requiem relics</a>. Each Lich is vulnerable to exactly 3 of them, in a specific order, equipped on your Parazon. <b>Oull</b> is the exception: it's a wildcard that replaces any of the 8 symbols — handy if your collection is incomplete.</p>

<h2>During the fight: avoid its element</h2>
<p>Your Lich's weapon carries one of the classic <b>damage elements</b>. Using that same element on it heals it instead of hurting it — check the element shown on its card and adjust your weapon (or temporarily remove the matching elemental mod) before the confrontation.</p>

<h2>Kill or convert?</h2>
<ul>
<li><b>Killing</b> gets you the weapon immediately, with a chance at the Lich's <b>ephemera</b> (a cosmetic effect unique to each theme).</li>
<li><b>Converting</b> turns the Lich into an ally who joins you on request in missions. No ephemera, and the weapon isn't usable right away.</li>
</ul>
<p>Get the mod combo wrong and the Lich flees with extra health/damage (and permanently rules out one Requiem symbol for itself) — no big deal, just run another Siphon/Flood mission to keep narrowing it down.</p>

<h2>What about Sisters of Parvos?</h2>
<p>The <b>Sisters of Parvos</b> system (Corpus) works identically, but grants <b>Tenet weapons</b> instead of Kuva ones. Everything above (clues, Requiem mods, kill/convert) applies the same way. Don't confuse this with <a href="/en/guides/coda-weapons">Coda weapons</a>: despite the similar-sounding searches, it's NOT a Lich system — they're bought directly from a merchant, no hunting involved.</p>

<p>To build the Kuva weapon you get, check our <a href="/builds/kuva-nukor">weapon builds</a>. To fund your Requiem relics and the rest of your gear, <a href="/en/guides/farm-platinum-free">farm platinum</a> and compare prices on <a href="/o/">our item pages</a>.</p>
`,
  },
  {
    slug: "warframe-tier-list", fr: "tier-list-warframes",
    title: "Warframe Tier List 2026: Best Warframes by Role",
    h1: "Best Warframes in 2026 (tier list)",
    desc: "Our 2026 Warframe tier list: the strongest frames by role (AoE, single-target DPS, support, stealth), why they dominate, and where to start based on your playstyle.",
    faq: [
      { q: "What is the best Warframe in 2026?", a: "There's no single \"best\" Warframe — it depends on the role. Saryn dominates room clear, Mesa leads single-target DPS, Wisp is the top support pick, and Rhino/Nekros remain safe bets for tanking and farming. The best choice is whichever frame is strongest for YOUR playstyle." },
      { q: "Which Warframe is best for Steel Path?", a: "Prioritize frames that survive and strip armor: Saryn, Wisp, Octavia or Khora all perform very well in Steel Path with a solid build. Gear (mods, arcanes) matters as much as the frame itself." },
    ],
    body: `
<p>The <b>best Warframes in 2026</b>, at a glance: <b>Saryn</b> (AoE), <b>Mesa</b> (DPS), <b>Wisp</b> (support), <b>Octavia</b> (versatility), <b>Khora</b> (farming) top the list, with <b>Rhino</b> as the best entry point. Full breakdown by role below — each with a <a href="/builds/">ready-to-play build</a>.</p>

<p class="muted">This is VoidRelay's editorial ranking: it reflects real in-game efficiency on content that matters (bounties, farming, <a href="/guides/steel-path-debuter">Steel Path</a>), not an official number. Any tier list is a snapshot — balance changes over time.</p>

<h2>🥇 S-Tier — dominant everywhere</h2>
<ul>
<li><b><a href="/builds/saryn">Saryn</a></b> — the queen of AoE: her spores wipe entire rooms, and her efficiency only grows with enemy density. Unmatched in survival and defense.</li>
<li><b><a href="/builds/mesa">Mesa</a></b> — the most direct single-target DPS in the game: her Regulators lock on and melt anything that gets close. Simple, brutal, effective.</li>
<li><b><a href="/builds/wisp">Wisp</a></b> — the best support: attack speed, healing and bonus health for the whole team, plus real offensive capability. Welcome in every squad.</li>
<li><b><a href="/builds/octavia">Octavia</a></b> — extreme versatility: damage that scales with enemy level, team invisibility, playable everywhere up to very high level.</li>
</ul>

<h2>🥈 A-Tier — fearsome specialists</h2>
<ul>
<li><b><a href="/builds/khora">Khora</a></b> — massive slash damage and the <b>best farming frame</b> with Strangledome + Pilfering. A must for resource survival missions.</li>
<li><b><a href="/builds/nova">Nova</a></b> — crowd control that speeds up or slows down enemies: she dictates the pace of the entire mission.</li>
<li><b><a href="/builds/nekros">Nekros</a></b> — the farmer: Desecrate doubles loot. Not flashy, but your resource stockpile will thank you.</li>
<li><b><a href="/builds/volt">Volt</a></b> — speed for everyone, a strong electric burst and a useful shield: excellent from early to late game.</li>
</ul>

<h2>🥉 B-Tier — reliable and accessible</h2>
<ul>
<li><b><a href="/builds/rhino">Rhino</a></b> — the unkillable tank: Iron Skin forgives every mistake. <b>The best first pick</b> for beginners (see our <a href="/en/guides/best-starter-warframes">beginner guide</a>).</li>
<li><b><a href="/builds/frost">Frost</a></b> — the defense specialist: his Snow Globe protects any objective.</li>
<li><b><a href="/builds/loki">Loki</a></b> — pure stealth: long-duration invisibility for spy and capture missions without fighting.</li>
<li><b><a href="/builds/ember">Ember</a></b> — fiery clear speed at low-to-mid levels, very satisfying to play in quick missions.</li>
</ul>

<h2>How to pick YOUR best Warframe</h2>
<ol>
<li><b>Playstyle first</b>: big damage (Saryn, Mesa), team utility (Wisp, Trinity), efficient farming (Khora, Nekros), low-stress play (Rhino, Loki).</li>
<li><b>The build does half the work</b>: a poorly modded S-tier frame loses to a well-equipped B-tier one — our <a href="/builds/">builds</a> give the exact setup.</li>
<li><b>Price matters</b>: many of these frames are farmed from their components, and their Prime versions are tradeable — check the <a href="/o/c/sets">Prime sets</a> pages before buying anything.</li>
</ol>

<p>To gear up for free, read <a href="/en/guides/farm-platinum-free">how to farm platinum</a>; for end-game, see <a href="/guides/steel-path-debuter">where to start with Steel Path</a>.</p>
`,
  },
  {
    slug: "coda-weapons", fr: "armes-coda",
    title: "Warframe Coda Weapons: How to Get Them (NOT a Lich System)",
    h1: "Coda weapons: how to get them",
    desc: "Coda weapons aren't a Lich system: here's the real mechanic (Eleanor, Live Heartcell, Progenitor bonus) and the full list of 14 available weapons.",
    faq: [
      { q: "Are Coda weapons related to Liches?", a: "No. Unlike Kuva weapons (Kuva Liches) or Tenet weapons (Sisters of Parvos), Coda weapons are bought directly from Eleanor, a merchant of The Hex syndicate, with no hunt and no mods to guess." },
      { q: "How do you get Live Heartcell?", a: "By defeating a Technocyte Coda, an enemy found in Höllvania. Each Coda weapon costs 10 Live Heartcell at Eleanor's." },
      { q: "Can you reroll a Coda weapon's elemental bonus?", a: "Yes: the damage bonus (the \"Progenitor bonus\") is randomly assigned on purchase and Eleanor's stock refreshes every 4 days — no relics or extra farming needed to try for a different one." },
    ],
    body: `
<p><b>Coda weapons</b> are NOT a Lich system: no hunting, no Requiem mods to guess. They're bought directly from <b>Eleanor</b>, a merchant of <b>The Hex</b> syndicate in Höllvania, using <b>Live Heartcell</b>.</p>

<h2>How to get them</h2>
<ol>
<li><b>Defeat a Technocyte Coda</b> (an Infested enemy found in Höllvania): it drops <b>Live Heartcell</b>.</li>
<li><b>Visit Eleanor</b> (The Hex, Höllvania Central Mall): each Coda weapon costs <b>10 Live Heartcell</b>.</li>
<li>No relics, no mods to hunt for — the price is paid entirely in Heartcell.</li>
</ol>

<h2>The Progenitor bonus</h2>
<p>Every Coda weapon carries a <b>random elemental damage bonus</b> (the "Progenitor bonus"), assigned at the moment of purchase. Don't like the roll? No need to farm from scratch — Eleanor's offer <b>refreshes every 4 days</b>, with a fresh roll each time.</p>

<h2>The 14 Coda weapons</h2>
<p>Bassocyst (shotgun), Bubonico (rifle), Catabolyst (pistol), Caustacyst (melee), Hema (rifle), Hirudo (melee), Mire (melee), Motovore (melee), Pathocyst (melee), Pox (pistol), Sporothrix (sniper), Synapse (rifle), Tysis (pistol) and Dual Coda Torxica (pistol). All introduced with Update 42.0 ("The Shadowgrapher").</p>

<p>For Warframe's other random-reward systems, see our <a href="/en/guides/kuva-lich">Kuva Lich guide</a> (Kuva weapons, Requiem mods) — a different mechanic, don't mix them up.</p>
`,
  },
  {
    slug: "steel-path-guide", fr: "steel-path-debuter",
    title: "Steel Path Guide: Where to Start (Warframe)",
    h1: "Steel Path: where to start",
    desc: "The Steel Path mode explained: what it's for, when to jump in, the rewards (Steel Essence, Teshin) and builds to survive Warframe's end-game.",
    faq: [
      { q: "When should you start Steel Path?", a: "Wait until you've finished the star chart and have a solid build (well-modded Warframe and weapon, arcanes): Steel Path enemies have massively more health and armor, so there's no rush to jump in too early." },
    ],
    body: `
<p><b>Steel Path</b> is Warframe's "new game+" mode: the entire star chart, much harder (level 100+ enemies). It's the end-game step for rewards and challenge.</p>

<h2>When should you start?</h2>
<p>Wait until you've <b>finished the star chart</b> and have a solid build (well-modded Warframe and weapon, arcanes). No need to jump in too early: enemies have massively more health and armor.</p>

<h2>The rewards</h2>
<ul>
<li><b>Steel Essence</b>: currency traded with Teshin for exclusive items (arcanes, Kuva, etc.). The weekly Honors reward rotates every week — track it on our <a href="/hub">dashboard</a>.</li>
<li>More drops and a loot bonus on certain missions.</li>
</ul>

<h2>How to survive</h2>
<p>Prioritize <b>armor stripping</b> (Corrosive, Viral mods), tanky or crowd-control Warframes, and survival arcanes. <a href="/o/c/arcanes">Arcanes</a> and <a href="/o/c/mods">mods</a> make all the difference at this level.</p>

<p>Need platinum to gear up? See <a href="/en/guides/farm-platinum-free">how to farm it</a>.</p>
`,
  },
  {
    slug: "eidolon-hunting", fr: "chasse-eidolons",
    title: "Eidolon Hunting Guide (Warframe)",
    h1: "Eidolon hunting: complete guide",
    desc: "How to hunt Eidolons in Warframe: prerequisites, what a night on Cetus looks like, gear (amp, Warframe) and rewards (arcanes, focus).",
    faq: [
      { q: "When can you hunt Eidolons?", a: "Only during the night on Cetus, on a roughly 50-minute night / 100-minute day cycle. The live day/night countdown is shown on the VoidRelay dashboard." },
    ],
    body: `
<p><b>Eidolons</b> are massive bosses that appear <b>at night on the Plains of Eidolon</b> (Cetus). Hunting them is one of the best sources of <a href="/o/c/arcanes">arcanes</a>.</p>

<h2>When to hunt</h2>
<p>Only <b>at night</b> on Cetus (roughly a 50-minute night / 100-minute day cycle). The live day/night countdown is shown on the <a href="/hub">dashboard</a>.</p>

<h2>Prerequisites</h2>
<ul>
<li>Completed the "Saya's Vigil" quest to access the Plains.</li>
<li>A decent <b>Amp</b> (Operator weapon) to break the Eidolon's shields.</li>
<li>A support Warframe (Trinity, Volt, Harrow…) and high-punchthrough weapons.</li>
</ul>

<h2>Rewards</h2>
<p>Eidolons drop <b>arcanes</b> (highly sought-after and tradeable), <b>focus</b>, and shards. Eidolon arcanes are an excellent source of <a href="/en/guides/farm-platinum-free">platinum</a> when resold.</p>
`,
  },
  {
    slug: "farm-endo-aya", fr: "farmer-endo-aya",
    banner: "/assets/banners/guide-maitrise.svg",
    title: "How to Farm Endo and Aya Efficiently in Warframe (2026 Guide)",
    h1: "Farming Endo and Aya efficiently",
    desc: "The best Endo sources (Arbitrations, Ayatan sculptures, relics) and Aya sources (Netracells) in Warframe, with the combos that pay the most per hour.",
    faq: [
      { q: "What is the best way to farm Endo?", a: "Arbitrations give the best passive yield over time (Endo on a regular rotation). For a big one-off boost, dissolve Ayatan sculptures filled with stars at Cephalon Simaris — often several thousand Endo at once." },
      { q: "How do I farm Aya fast?", a: "Netracells (Steel Path only) are the main Aya source, with a guaranteed bonus on the first Netracell completed each day. Sanctuary Onslaught (regular or Elite) also drops some, in smaller amounts." },
    ],
    body: `
<p><b>Endo</b> ranks up your mods, and <b>Aya</b> buys vaulted <b>Prime Resurgence</b> items from Varzia. Two end-game currencies, two very different ways to farm them — here are the best.</p>

<h2>Farming Endo</h2>
<ul>
<li><b>Arbitrations</b>: the best passive yield — every rotation has a chance to drop a solid chunk of Endo, on any Arbitration mission.</li>
<li><b>Ayatan sculptures</b>: pick them up in missions (especially Spy and caves), slot Ayatan stars into them, then dissolve them at <b>Cephalon Simaris</b> in a Relay — often several thousand Endo at once for a well-filled sculpture.</li>
<li><b>Void relics</b>: a small amount of Endo shows up regularly among Fissure rewards, alongside Prime parts.</li>
<li><b>Sell your spare mods</b>: from the mod management screen, convert duplicates and junk mods into Endo — low yield, but free.</li>
</ul>
<p><a href="/en/builds/nekros">Nekros</a> and his Desecrate boost your sculpture and relic drop chances on the mission — useful if you chain Endo farms in a squad.</p>

<h2>Farming Aya</h2>
<p><b>Netracells</b> (missions exclusive to the <a href="/en/guides/steel-path-guide">Steel Path</a>) are the main Aya source, with a <b>guaranteed bonus on the first Netracell completed each day</b> — run them daily for a steady flow. <b>Sanctuary Onslaught</b> (regular or Elite) also drops some, in more modest amounts, if you prefer an endless mission over a Netracell.</p>
<p>Once your stock is built up, spend your Aya at <b>Varzia</b> during a <a href="/en/guides/prime-resurgence-relics">Prime Resurgence</a> window — see our dedicated guide for what to grab first.</p>

<p>To track the world state (Netracells, current Prime Resurgence) live, use the <a href="/hub">VoidRelay dashboard</a>.</p>
`,
  },
  {
    slug: "mastery-rank-fast", fr: "monter-rang-maitrise",
    banner: "/assets/banners/guide-maitrise.svg",
    title: "How to Level Mastery Rank (MR) Fast — Warframe",
    h1: "How to raise your Mastery Rank quickly",
    desc: "Mastery Rank (MR) in Warframe: what it unlocks, how to earn mastery XP fast (new weapons and Warframes) and how to pass the tests.",
    body: `
<p><b>Mastery Rank</b> (MR) unlocks weapons, raises your daily trade count and your caps. Levelling it fast opens up the whole game.</p>

<h2>How to earn mastery XP</h2>
<ul>
<li><b>Levelling each weapon and Warframe to rank 30</b> grants mastery XP — once per item. The key: <b>build and level as many different items as possible</b>.</li>
<li>Level efficiently on the right missions (Hydron on Sedna, Elite Sanctuary Onslaught…).</li>
<li>At every new rank, <b>clear out the in-ship market's credit weapons</b> and keep your foundry always busy — the routine detailed in <a href="/guides/orbiter-guide-complet">the Orbiter guide (French)</a>.</li>
</ul>

<h2>Buying tip</h2>
<p>Buying weapons and components from other players lets you level items you haven't farmed yet → faster MR. Compare prices on <a href="/en/o/">VoidRelay</a> (the required mastery is also shown on warframe.market).</p>

<h2>Mastery tests</h2>
<p>At each rank, a <b>test</b> awaits. Practice it in a Relay (at Cephalon Simaris) before taking it. If you fail, you can retry the next day.</p>

<p>To fund your weapon purchases, see <a href="/en/guides/farm-platinum-free">how to farm platinum</a> and <a href="/en/guides/warframe-market-trading">getting started with trading</a>.</p>
`,
  },
  {
    slug: "nightwave-explained", fr: "nightwave-explication",
    banner: "/assets/banners/guide-nightwave.svg",
    title: "Warframe Nightwave Explained (Guide)",
    h1: "Nightwave: how it works",
    desc: "Warframe's Nightwave system explained: challenges, ranks, rewards (Aura credits, potatoes, cosmetics) and Nora's shop. How to miss nothing.",
    body: `
<p><b>Nightwave</b> is Warframe's free "battle pass": you complete challenges to earn <b>standing</b>, climb ranks and unlock rewards.</p>

<h2>The challenges</h2>
<p>New challenges appear daily and weekly (dailies, weeklies, and harder "elite" ones). The number of active challenges is shown on the <a href="/hub">dashboard</a>. Do as many as you can each week so you never fall behind.</p>

<h2>The rewards</h2>
<ul>
<li><b>Aura credits, reactors/catalysts (potatoes)</b>, exclusive cosmetics.</li>
<li><b>Nightwave credits</b> to spend in Nora's shop (weapon/Warframe slots, Kuva, Nitain, etc.).</li>
</ul>

<h2>Advice</h2>
<p>Nightwave's free <b>slots</b> and <b>potatoes</b> save you a lot of <a href="/en/guides/farm-platinum-free">platinum</a> — prioritise them. Also keep an eye on the market's <a href="/bons-plans">daily deals (French)</a>.</p>
`,
  },
  {
    slug: "prime-resurgence-relics", fr: "prime-resurgence-reliques",
    banner: "/assets/banners/guide-reliques.svg",
    title: "Prime Resurgence & Relics: Getting Vaulted Primes",
    h1: "Prime Resurgence and relics: how to get Primes",
    desc: "How to get vaulted Prime Warframes and weapons through Prime Resurgence (Varzia) and Warframe's Void relic system.",
    body: `
<p>Want a <b>vaulted Prime</b> that no longer appears in normal drops? Two routes: <b>Prime Resurgence</b> and the market.</p>

<h2>Prime Resurgence (Varzia)</h2>
<p><b>Varzia</b>, at Maroo's Bazaar, offers a rotation of vaulted Prime Warframes and weapons for <b>Aya</b> and <b>Regal Aya</b>. It is the official way to get an old Prime without going through the market. The rotation has <b>no predefined order</b>: the next resurgence is only revealed mid-cycle, about two weeks before the end. The current rotation and location are shown live on the <a href="/hub">dashboard</a>.</p>

<h2>Void relics</h2>
<p><a href="/o/c/reliques">Relics</a> (Lith, Meso, Neo, Axi) contain the Prime parts. To open them:</p>
<ol>
<li>Equip a relic matching the part you want.</li>
<li>Run a <b>Void Fissure</b> mission of the right era.</li>
<li>Collect 10 Void Reactant during the mission to "crack" your relic.</li>
<li>At the end, pick among the rewards (in a squad: 4 choices).</li>
</ol>
<p>Refine your relics (Void Traces) up to <b>Radiant</b> to maximise your rare-part chances — our <a href="/en/relic-calc">relic calculator</a> gives you the exact odds, and <a href="/en/relics-tonight">Relics tonight</a> tells you which relics to open right now.</p>

<h2>Buying directly</h2>
<p>Don't feel like farming? You can buy the parts or the <a href="/o/c/sets">full set</a> from other players. Always compare parts vs set prices on the <a href="/en/o/">item page</a> before buying.</p>

<p>More in the <a href="/faq-en">FAQ</a> and the <a href="/en/guides/">guide hub</a>.</p>
`,
  },

];

/* Guides écrits À LA MAIN (fichier HTML directement dans guides/, hors génération).
   Le générateur ne réécrit jamais leur page (cf. writeDir qui préserve les fichiers
   étrangers), mais il doit connaître leur carte pour l'ANNUAIRE guides/index.html :
   sans cette liste, chaque régénération faisait disparaître leur carte de l'index
   (piège constaté le 09/07/2026 avec fragments-archontes). `apres` = slug du guide
   généré après lequel insérer la carte, pour garder l'ordre actuel de l'annuaire. */
export const GUIDES_FAITS_MAIN = [
  {
    slug: "bien-modder",
    banner: "/assets/banners/fam-progression.webp",
    h1: "Bien modder ses armes : la logique de build",
    desc: "La recette universelle pour builder n'importe quelle arme : ordre des mods, seuils crit/statut, éléments par faction et pièges à éviter — à tester en direct dans le simulateur d'arsenal.",
    apres: "",
  },
  {
    slug: "ombres-de-jade-constellations",
    banner: "/assets/banners/fam-reliques.webp",
    h1: "Les Ombres de Jade : Constellations — tout ce qu'apporte la mise à jour",
    desc: "Mise à jour 43 (17 juin 2026) : Sirius & Orion la Warframe double, Styanax Prime, le retour du Railjack avec Steel Path, 5 Incarnons, arcanes, augments et quality of life.",
    apres: "farmer-platine-gratuit",
  },
  {
    slug: "tennocon-2026-annonces",
    banner: "/assets/banners/fam-orbiter.webp",
    h1: "TennoCon 2026 : toutes les annonces (Brysko, Narin, Système Tau, Citrine Prime)",
    desc: "Le récap complet des annonces de la TennoCon 2026 : la nouvelle Warframe Brysko, l'Iceblade of Narin, le nouveau Système Tau et son hub-casino Fornax, Citrine Prime, le rework de Banshee et le calendrier à venir.",
    apres: "ombres-de-jade-constellations",
  },
  {
    slug: "iceblade-de-narin",
    banner: "/assets/banners/fam-chasse.webp",
    h1: "Iceblade of Narin (mise à jour 44) — tout ce qu'apporte la mise à jour",
    desc: "Mise à jour 44 (23 septembre 2026) : la Warframe Narin et ses armes, la refonte de Banshee offerte jusqu'au 7 octobre, Citrine Prime, le verrouillage des Rivens, le Zariman et les points faibles.",
    apres: "tennocon-2026-annonces",
  },
  {
    slug: "orbiter-guide-complet",
    banner: "/assets/banners/fam-orbiter.webp",
    h1: "L'Orbiter, ton quartier général : le guide complet",
    desc: "Visite guidée console par console : navigation, arsenal, fonderie, mods, marché, quêtes, syndicats, incubateur, reliques — et les 10 réflexes à prendre dès le début.",
    apres: "meilleures-warframes-debutant",
  },
  {
    slug: "farmer-vitus-arbitrage",
    banner: "/assets/banners/fam-endgame.webp",
    h1: "Arbitrages : farmer le Vitus efficacement (et le transformer en platine)",
    desc: "Interception rallongée, Ogris Kuva + Napalm Nocturne, boosters et bénédictions (6 % → 12 % de drop), et quoi acheter chez les Arbitres pour revendre — 700 Vitus en 1h27, méthode prouvée.",
    apres: "farmer-endo-aya",
  },
  {
    slug: "fragments-archontes",
    banner: "/assets/banners/fam-progression.webp",
    h1: "Fragments Archontes : couleurs, effets, Tauforgés",
    desc: "Guide complet des Fragments Archontes : les 6 couleurs et leurs effets, la version Tauforgée, la fusion et où les obtenir.",
    apres: "chasse-eidolons",
  },
  {
    slug: "rotation-incarnon",
    banner: "/assets/banners/fam-reliques.webp",
    h1: "Rotation Incarnon de la semaine (Circuit Steel Path)",
    desc: "Les 5 armes Incarnon du Circuit Steel Path cette semaine, mises à jour automatiquement, et comment fonctionne la rotation hebdomadaire du lundi.",
    apres: "steel-path-debuter",
    changefreq: "weekly", // la rotation tourne chaque lundi 00:00 UTC
  },
];

/* Équivalent EN de GUIDES_FAITS_MAIN (même piège, même remède : sans ça, la carte
   archon-shards disparaît de l'annuaire en/guides/ à chaque régénération). */
export const GUIDES_FAITS_MAIN_EN = [
  {
    slug: "modding-guide",
    banner: "/assets/banners/fam-progression.webp",
    h1: "Weapon modding guide: the build logic",
    desc: "The universal recipe to build any weapon: mod order, crit/status thresholds, elements per faction and traps to avoid — try it live in the arsenal simulator.",
    apres: "",
  },
  {
    slug: "jade-shadows-constellations",
    banner: "/assets/banners/guide-jade-constellations.svg",
    h1: "Jade Shadows: Constellations — everything the update brings",
    desc: "Update 43 (June 17, 2026): Sirius & Orion the dual Warframe, Styanax Prime, the Railjack comeback with Steel Path, 5 Incarnons, arcanes, augments and quality of life.",
    apres: "farm-platinum-free",
  },
  {
    slug: "tennocon-2026-announcements",
    banner: "/assets/banners/tennocon-2026.svg",
    h1: "TennoCon 2026: all the announcements (Brysko, Narin, Tau System, Citrine Prime)",
    desc: "The complete recap of the TennoCon 2026 announcements: the new Warframe Brysko, the Iceblade of Narin, the new Tau System and its casino hub Fornax, Citrine Prime, the Banshee rework and the upcoming calendar.",
    apres: "jade-shadows-constellations",
  },
  {
    slug: "iceblade-of-narin",
    banner: "/assets/banners/fam-chasse.webp",
    h1: "Iceblade of Narin (Update 44) — everything the update brings",
    desc: "Update 44 (September 23, 2026): the Narin Warframe and her weapons, the Banshee rework free until October 7, Citrine Prime, Riven trait locking, the Zariman and Weak Points.",
    apres: "tennocon-2026-announcements",
  },
  {
    slug: "orbiter-complete-guide",
    banner: "/assets/banners/guide-orbiter.svg",
    h1: "The Orbiter, your headquarters: the complete guide",
    desc: "Guided tour console by console: navigation, arsenal, foundry, mods, market, quests, syndicates, incubator, relics — and the 10 habits to build from the start.",
    apres: "best-starter-warframes",
  },
  {
    slug: "farm-vitus-arbitrations",
    banner: "/assets/banners/guide-arbitrage.svg",
    h1: "Arbitrations: farm Vitus Essence efficiently (and turn it into platinum)",
    desc: "Stretched Interception, Kuva Ogris + Nightwatch Napalm, boosters and blessings (6% → 12% drop), and what to buy from the Arbiters to resell — 700 Vitus in 1h27, proven method.",
    apres: "farm-endo-aya",
  },
  {
    slug: "archon-shards",
    banner: "/assets/banners/guide-archon-shards.svg",
    h1: "Archon Shards: colors, effects, Tauforged",
    desc: "Complete Archon Shards guide: the 6 colors and their effects, the Tauforged version, fusion, and where to get them (Archon Hunts, Netracells, Archimedea).",
    apres: "eidolon-hunting",
  },
  {
    slug: "incarnon-rotation",
    banner: "/assets/banners/guide-incarnon.svg",
    h1: "This week's Incarnon rotation (Steel Path Circuit)",
    desc: "The 5 Incarnon weapons in the Steel Path Circuit this week, updated automatically, and how the weekly Monday rotation works.",
    apres: "steel-path-guide",
    changefreq: "weekly", // la rotation tourne chaque lundi 00:00 UTC
  },
];
