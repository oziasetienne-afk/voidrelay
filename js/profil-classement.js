/* Les cinq classements. UN calcul par profil, aucun mélangé.

   Toutes les fonctions sont PURES : elles prennent les données du marché et
   rendent des lignes triées. C'est ce qui permet à scripts/verifier_profils.mjs
   de les vérifier sans navigateur — et donc de vérifier des chiffres, pas des
   captures d'écran.

   Un parti pris traverse le fichier : on ne fabrique jamais un score composite
   opaque. Chaque profil est trié par LA grandeur qui répond à sa question, et
   les grandeurs qui nuancent (concurrence, liquidité, second prix) sont
   affichées à côté au lieu d'être fondues dedans. Un chiffre qu'on ne peut pas
   expliquer ne sert à personne. */
(function (g) {
  "use strict";

  var nb = function (v) { return typeof v === "number" && isFinite(v) ? v : null; };

  /* v71 — LE « DEUXIÈME ORDRE » NE SUFFIT PAS. Prendre le deuxième prix au lieu
     du premier protège d'UN ordre isolé, pas d'un groupe. Mesuré le 04/09/2026
     sur Arcane Steadfast : les demandes d'achat étaient 900, 840, 600, puis
     150 — trois valeurs absurdes d'affilée avant le vrai marché. Le profil
     débutant annonçait donc « un acheteur donne 467 % de la médiane ».

     La règle qui tient, elle, ne dépend pas du NOMBRE d'ordres douteux :
     personne ne paie durablement plus que la médiane. On plafonne donc la
     demande retenue à la médiane. Aucune quantité d'ordres gonflés ne peut
     franchir ce plafond, là où « prendre le deuxième » cède au troisième. */
  function demandeSure(achat, achat2, median) {
    var v = achat2 === null ? achat : achat2;
    if (v === null) return null;
    return median === null ? v : Math.min(v, median);
  }

  /* ---- 🎯 LE FARMEUR ------------------------------------------------------
     Il a la pièce ; il veut savoir ce qu'elle rapporte. Le classement se fait
     sur la VENTE LA PLUS BASSE, pas sur la médiane, et c'est le point de tout
     le tableau : pour vendre aujourd'hui il faut s'aligner sur le moins cher,
     pas sur le milieu. Trier sur la médiane flatterait le chiffre et mentirait
     sur la recette. La médiane reste affichée — comme un plafond, pas comme une
     promesse. */
  function farmeur(items) {
    return items
      .map(function (it) {
        var bas = nb(it.minSellPlat), med = nb(it.median);
        if (bas === null) return null;
        return { slug: it.slug, valeur: bas, median: med, ordres: nb(it.sellOrders) || 0,
                 ducats: nb(it.ducats), tendance: nb(it.change24h),
                 // Peu de vendeurs = tu n'as pas trente concurrents à casser.
                 rare: (nb(it.sellOrders) || 0) <= 12,
                 // La médiane bien au-dessus du plus bas = le marché est cassé
                 // vers le bas aujourd'hui ; attendre paie souvent.
                 ecrase: med !== null && bas > 0 && med / bas >= 1.35 };
      })
      .filter(Boolean)
      .sort(function (a, b) { return b.valeur - a.valeur; });
  }

  /* ---- 🧩 LE MONTEUR DE SET -----------------------------------------------
     Il achète les morceaux et revend l'ensemble. Le coût du montage doit
     compter le NOMBRE de chaque pièce (Akbolto Prime : deux canons, deux
     récepteurs) — sinon le coût est sous-évalué et un set perdant passe pour
     une affaire.
     Une pièce sans prix rend le total FAUX, pas approximatif : le set est écarté
     et la raison est dite, jamais complété par une estimation.

     TROIS écarts, et le classement se fait sur celui du milieu. Acheter les
     pièces au plus bas puis comparer à la MÉDIANE du set serait tricher avec
     soi-même : on achèterait au prix du marché et on revendrait au prix rêvé.
     L'écart « aligné » compare au prix auquel le set part vraiment aujourd'hui
     (la vente la plus basse) — c'est celui qui trie. */
  function monteur(items, recette, prixPieces) {
    var parSlug = {};
    items.forEach(function (it) { parSlug[it.slug] = it; });
    var lignes = [], incomplets = [];

    Object.keys(recette || {}).forEach(function (slugSet) {
      var set = parSlug[slugSet], def = recette[slugSet];
      if (!set || !def || !def.pieces || !def.pieces.length) return;
      var cout = 0, trades = 0, manque = null, detail = [];
      for (var i = 0; i < def.pieces.length; i++) {
        var p = def.pieces[i];
        // Une pièce peut être un set imbriqué (Aklex Prime = 2 Lex Prime
        // entières) : son prix vient alors du marché principal, pas du fichier
        // des pièces. On cherche dans les deux.
        var src = (prixPieces && prixPieces[p.slug]) || parSlug[p.slug];
        var u = src ? nb(src.minSellPlat) : null;
        if (u === null) { manque = p.nom || p.slug; break; }
        cout += u * (p.n || 1);
        trades += (p.n || 1);
        detail.push({ slug: p.slug, nom: p.nom, n: p.n || 1, unite: u,
                      total: u * (p.n || 1), imbrique: !!p.imbrique });
      }
      if (manque) { incomplets.push({ slug: slugSet, piece: manque }); return; }

      var patient = nb(set.median), rapide = nb(set.maxBuyPlat), aligne = nb(set.minSellPlat);
      var moins = function (v) { return v === null ? null : Math.round((v - cout) * 10) / 10; };
      lignes.push({
        slug: slugSet, nom: def.nom, cout: Math.round(cout * 10) / 10,
        reventePatiente: patient, reventeRapide: rapide, reventeAlignee: aligne,
        ecartPatient: moins(patient), ecartRapide: moins(rapide), ecartAligne: moins(aligne),
        // Le vrai coût caché du métier : autant de rendez-vous en jeu que
        // d'achats, plus un pour la vente.
        trades: trades + 1,
        pieces: detail
      });
    });

    lignes.sort(function (a, b) {
      return (b.ecartAligne === null ? -1e9 : b.ecartAligne) -
             (a.ecartAligne === null ? -1e9 : a.ecartAligne);
    });
    return { lignes: lignes, incomplets: incomplets };
  }

  /* ---- ⚡ LE FLIPPER -------------------------------------------------------
     Il achète bas et revend haut. Trois marges, et le CLASSEMENT se fait sur la
     patiente — pour une raison que la mesure a imposée, pas le raisonnement.

       immédiate = meilleur achat − vente la plus basse. Le chiffre que tout le
                   monde regarde, et le plus trompeur : il additionne les deux
                   ordres les plus extrêmes du carnet.
       instant   = deuxième achat − deuxième vente. Le vrai aller-retour, les
                   extrêmes écartés. Le 03/09/2026 il était NÉGATIF sur les 124
                   objets suivis, sans exception. Un marché liquide ne laisse
                   pas d'argent par terre : acheter et revendre dans la minute
                   ne paie pas, et un classement trié là-dessus n'aurait proposé
                   que des pertes.
       patiente  = médiane − deuxième vente. Acheter l'offre basse, remettre au
                   prix du marché, attendre. Positive sur 94 objets sur 124.
                   C'est là qu'est le métier, et c'est donc elle qui trie.

     Les deux prix retenus sont les DEUXIÈMES, jamais les extrêmes. Le même jour,
     Arcane Steadfast (rang 5) se vendait 180 platine avec une demande à 840, la
     suivante à 150 : un seul ordre isolé fabriquait 660 platine de marge
     imaginaire, et un tri sur l'extrême l'aurait mis en tête — exactement là où
     l'œil se pose. On écarte, et on MARQUE au lieu de cacher. */
  function flipper(items) {
    return items
      .map(function (it) {
        var bas = nb(it.minSellPlat), med = nb(it.median), ach = nb(it.maxBuyPlat);
        if (bas === null || bas <= 0) return null;
        var second = nb((it.low5SellPlat || [])[1]);
        var ach2 = nb((it.high5BuyPlat || [])[1]);
        var basP = second === null ? bas : second;     // acheter, prudemment
        var achP = demandeSure(ach, ach2, med);        // revendre, prudemment
        return {
          slug: it.slug, bas: bas, second: second, median: med, achat: ach, achat2: ach2,
          rang: it.rang === undefined ? null : it.rang,
          margeImmediate: ach === null ? null : ach - bas,
          margeInstant: achP === null ? null : Math.round((achP - basP) * 10) / 10,
          margePatiente: med === null ? null : Math.round((med - basP) * 10) / 10,
          ordres: nb(it.sellOrders) || 0,
          // Le premier prix décroche de plus d'un tiers du second : suspect.
          fantome: second !== null && second > 0 && bas / second <= 0.66,
          // La meilleure demande dépasse la suivante de moitié : suspecte aussi.
          achatDouteux: ach !== null && ach2 !== null && ach2 > 0 && ach / ach2 >= 1.5
        };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return (b.margePatiente === null ? -1e9 : b.margePatiente) -
               (a.margePatiente === null ? -1e9 : a.margePatiente);
      });
  }

  /* Le verdict du jour sur l'aller-retour immédiat. Une page qui classe des
     marges doit dire quand il n'y en a pas : c'est l'information la plus utile
     que le tableau puisse porter, et la seule qu'un « top 40 » ne montre pas. */
  function verdictFlip(lignes) {
    var instant = 0, patient = 0;
    lignes.forEach(function (l) {
      if (l.margeInstant !== null && l.margeInstant > 0) instant++;
      if (l.margePatiente !== null && l.margePatiente > 0) patient++;
    });
    return { total: lignes.length, instant: instant, patient: patient,
             meilleurPatient: lignes.length ? lignes[0].margePatiente : null };
  }

  /* ---- 💎 LE DUCATIER -----------------------------------------------------
     Ducats obtenus par platine dépensé, au prix MÉDIAN des cinq offres les plus
     basses — pas à la vente la plus basse. Mesuré le 20/10/2026 : Lex Prime Set
     avait UNE offre à 3 p (la deuxième à 5, la troisième à 9) et prenait la tête
     à 18,3 ducats/platine ; trois heures plus tard l'offre avait disparu (11,0).
     Le ducatier achète plusieurs sets : il paie la médiane, pas l'offre isolée.
     Même chiffre que ducatsPerPlat de market.json (/bons-plans, /hub).
     Repère de métier : au-dessus de 10 ducats/platine, l'affaire est bonne ;
     en dessous de 5, autant vendre la pièce. */
  function ducatier(items) {
    return items
      .map(function (it) {
        var bas = nb(it.median), duc = nb(it.ducats);
        if (bas === null || bas <= 0 || !duc) return null;
        var r = duc / bas;
        return { slug: it.slug, bas: bas, ducats: duc,
                 ratio: Math.round(r * 100) / 100, ordres: nb(it.sellOrders) || 0,
                 bon: r >= 10, faible: r < 5 };
      })
      .filter(Boolean)
      .sort(function (a, b) { return b.ratio - a.ratio; });
  }

  /* ---- 🌱 LE DÉBUTANT -----------------------------------------------------
     Il n'a rien à investir et personne ne répond à ses annonces. Sa vraie
     question n'est pas « qu'est-ce qui vaut cher », c'est « qu'est-ce qui part
     TOUT DE SUITE ». Un ordre d'achat existe déjà : il vend en un message.
     On classe donc sur le RATIO entre ce qu'un acheteur donne maintenant et la
     médiane — c'est-à-dire là où la vente immédiate coûte le moins. Classer sur
     le prix lui montrerait des objets qu'il n'a pas.

     La demande retenue est la DEUXIÈME, pas la meilleure : c'est le profil qui
     a le moins de moyens de flairer un ordre isolé, et lui promettre 840
     platine parce qu'un joueur a mal tapé serait la pire des tromperies. */
  function debutant(items) {
    return items
      .map(function (it) {
        var ach = nb(it.maxBuyPlat), ach2 = nb((it.high5BuyPlat || [])[1]), med = nb(it.median);
        if (med === null || med <= 0) return null;
        var sur = demandeSure(ach, ach2, med);
        if (sur === null) return null;
        return { slug: it.slug, achat: sur, meilleur: ach, median: med,
                 seul: ach2 === null,
                 // Le plafond a mordu : la meilleure demande dépassait la
                 // médiane, donc on ne l'a pas crue. Le dire vaut mieux que
                 // laisser croire à une offre exceptionnelle.
                 plafonne: ach !== null && ach > med,
                 part: Math.round((sur / med) * 100),
                 perte: Math.round((med - sur) * 10) / 10,
                 ordres: nb(it.sellOrders) || 0 };
      })
      .filter(Boolean)
      .sort(function (a, b) { return (b.part - a.part) || (b.achat - a.achat); });
  }

  g.VRClass = { farmeur: farmeur, monteur: monteur, flipper: flipper,
                verdictFlip: verdictFlip, ducatier: ducatier, debutant: debutant };
})(window);
