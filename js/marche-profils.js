/* Page « Comment tu joues le marché » : le choix du profil et son tableau.

   Le rendu ne calcule rien — tout vient de js/profil-classement.js, vérifié
   hors navigateur par scripts/verifier_profils.mjs. Ici on ne fait que choisir
   les colonnes qui répondent à la question du profil, et dire à voix haute les
   pièges que les chiffres cachent. */
(function () {
  "use strict";
  var P = window.VRProfil, C = window.VRClass;
  if (!P || !C) return;
  var T = P.T;                      // bascule FR/EN portée par js/profil.js

  var N = 40;                       // lignes affichées : de quoi choisir, pas de quoi noyer
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var joli = function (u) {
    return String(u).replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  };
  /* Nom affiché : celui du catalogue, posé sur chaque objet de market.json par le
     pipeline (nomFr sur la page FR, nom EN sur /en/). Le slug mis en forme n'est
     qu'un repli pour un objet hors catalogue — jamais un nom inventé. */
  var NOMS = {};
  var lien = function (slug, nom) {
    return '<a href="' + (P.EST_EN ? "/en/o/" : "/o/") + esc(slug) + '">' +
           esc(nom || NOMS[slug] || joli(slug)) + "</a>";
  };
  var p = function (v) { return v === null || v === undefined ? "—" : v + " p"; };
  var signe = function (v) {
    if (v === null || v === undefined) return "—";
    return '<span class="' + (v < 0 ? "neg" : "gros") + '">' + (v > 0 ? "+" : "") + v + " p</span>";
  };
  var tag = function (cls, txt) { return ' <span class="pf-tag ' + cls + '">' + txt + "</span>"; };

  var $ = function (id) { return document.getElementById(id); };
  var donnees = { marche: null, recette: null, pieces: null };

  function json(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " : " + r.status);
      return r.json();
    });
  }

  /* ---------------------------------------------------------- les tableaux */
  var VUES = {
    farmeur: {
      titre: T("Ce que ta pièce rapporte vraiment", "What your part actually pays"),
      sous: T("Classé sur la <b>vente la plus basse</b>, pas sur la médiane : pour vendre aujourd'hui, tu dois t'aligner sur le moins cher. La médiane est un plafond, pas une recette.",
              "Ranked on the <b>lowest sell order</b>, not the median: to sell today you have to match the cheapest. The median is a ceiling, not a payout."),
      cols: T(["Objet", "Tu toucheras", "Médiane", "Vendeurs devant toi", "Ducats"],
                 ["Item", "You will get", "Median", "Sellers ahead of you", "Ducats"]),
      note: T("« Peu de concurrence » = 12 vendeurs ou moins : ton annonce reste visible. « Marché écrasé » = la médiane dépasse le prix bas d'un tiers ; attendre quelques jours paie souvent plus que brader.",
              "“Few sellers” = 12 or fewer: your listing stays visible. “Squeezed” = the median is a third above the low price; waiting a few days often pays more than undercutting."),
      lignes: function () { return C.farmeur(donnees.marche.items); },
      rendu: function (r) {
        return "<tr><td>" + lien(r.slug) +
          (r.rare ? tag("ok", T("peu de concurrence", "few sellers")) : "") +
          (r.ecrase ? tag("warn", T("marché écrasé", "squeezed")) : "") +
          '</td><td class="gros">' + p(r.valeur) + "</td><td>" + p(r.median) +
          "</td><td>" + r.ordres + "</td><td>" + (r.ducats || "—") + "</td></tr>";
      }
    },

    monteur: {
      titre: T("Monter le set coûte-t-il moins cher que l'acheter ?", "Is building the set cheaper than buying it?"),
      sous: T("Coût des pièces au prix d'achat réel, <b>en comptant les doubles</b> (Akbolto Prime demande deux canons et deux récepteurs). Classé sur l'écart <b>aligné</b> : ce que tu gagnes en revendant au prix où le set part vraiment aujourd'hui.",
              "Parts cost at the real buying price, <b>counting duplicates</b> (Akbolto Prime needs two barrels and two receivers). Ranked on the <b>matched</b> gap: what you make reselling at the price the set actually goes for today."),
      cols: T(["Set", "Coût des pièces", "Set au plus bas", "Écart aligné", "Écart patient", "Vente immédiate", "Trades"],
                 ["Set", "Parts cost", "Set lowest", "Matched gap", "Patient gap", "Instant sale", "Trades"]),
      note: T("L'écart <b>patient</b> vise la médiane : plus large, mais il faut trouver l'acheteur. La <b>vente immédiate</b> est ce qu'un acheteur donne déjà — souvent négative, et c'est normal : le métier se paie en patience. La colonne <b>Trades</b> est le coût caché : autant de rendez-vous en jeu que d'achats, plus un pour la vente.",
              "The <b>patient</b> gap aims at the median: wider, but you have to find the buyer. <b>Instant sale</b> is what a buyer already offers — often negative, and that is normal: this trade is paid in patience. The <b>Trades</b> column is the hidden cost: one in-game meeting per purchase, plus one for the sale."),
      lignes: function () {
        var r = C.monteur(donnees.marche.items, donnees.recette.sets, donnees.pieces.items);
        VUES.monteur._incomplets = r.incomplets;
        return r.lignes;
      },
      rendu: function (r) {
        var det = r.pieces.map(function (x) {
          return x.n + "× " + (x.nom || joli(x.slug)) + T(" à ", " at ") + x.unite + " p";
        }).join(" · ");
        return '<tr><td>' + lien(r.slug, r.nom) +
          '<div class="pf-piv">' + esc(det) + "</div></td>" +
          "<td>" + p(r.cout) + "</td><td>" + p(r.reventeAlignee) + "</td><td>" +
          signe(r.ecartAligne) + "</td><td>" + signe(r.ecartPatient) + "</td><td>" +
          signe(r.ecartRapide) + "</td><td>" + r.trades + "</td></tr>";
      },
      apres: function () {
        var inc = VUES.monteur._incomplets || [];
        if (!inc.length) return "";
        var noms = inc.slice(0, 3).map(function (x) {
          return esc(joli(x.slug)) + " : " + esc(x.piece);
        }).join(", ");
        return "<br>" + T(inc.length + " set" + (inc.length > 1 ? "s sont écartés" : " est écarté") +
                          " faute de prix sur une pièce (" + noms + ") — un coût partiel serait un coût faux.",
                          inc.length + " set" + (inc.length > 1 ? "s are set aside" : " is set aside") +
                          " because one part has no price (" + noms + ") — a partial cost would be a wrong cost.");
      }
    },

    flipper: {
      titre: T("Où l'écart paie encore", "Where the gap still pays"),
      sous: T("Classé sur la <b>marge patiente</b> : tu achètes la deuxième offre la plus basse et tu remets l'objet au prix du marché. Les deux prix retenus sont les <b>deuxièmes</b>, jamais les extrêmes — un ordre isolé fabrique des marges qui n'existent pas.",
              "Ranked on the <b>patient margin</b>: you buy the second-lowest offer and put the item back at market price. Both prices used are the <b>second</b> ones, never the extremes — a lone order invents margins that do not exist."),
      cols: T(["Objet", "Plus bas", "2ᵉ vente", "Médiane", "2ᵉ achat", "Marge patiente", "Aller-retour", "Marge affichée", "Vendeurs"],
                 ["Item", "Lowest", "2nd sell", "Median", "2nd buy", "Patient margin", "Round trip", "Headline margin", "Sellers"]),
      note: T("La colonne <b>Aller-retour</b> est l'achat-revente dans la minute, extrêmes écartés. La <b>marge affichée</b> est celle que montrent les carnets d'ordres bruts : elle additionne les deux extrêmes et se trompe presque toujours. « fantôme ? » signale une vente décrochée, « demande isolée » un achat décroché.",
              "The <b>Round trip</b> column is buy-and-resell within the minute, extremes removed. The <b>headline margin</b> is what raw order books show: it adds up both extremes and is almost always wrong. “ghost?” flags a detached sell order, “lone bid” a detached buy order."),
      lignes: function () {
        var r = C.flipper(donnees.marche.items);
        VUES.flipper._verdict = C.verdictFlip(r);
        return r;
      },
      rendu: function (r) {
        return "<tr><td>" + lien(r.slug) +
          (r.rang !== null ? tag("ok", "rang " + r.rang) : "") +
          (r.fantome ? tag("bad", T("fantôme ?", "ghost?")) : "") +
          (r.achatDouteux ? tag("bad", T("demande isolée", "lone bid")) : "") +
          "</td><td>" + p(r.bas) + "</td><td>" + p(r.second) + "</td><td>" + p(r.median) +
          "</td><td>" + p(r.achat2) + "</td><td>" + signe(r.margePatiente) +
          "</td><td>" + signe(r.margeInstant) + "</td><td>" + signe(r.margeImmediate) +
          "</td><td>" + r.ordres + "</td></tr>";
      },
      apres: function () {
        var v = VUES.flipper._verdict;
        if (!v) return "";
        var mieux = v.meilleurPatient !== null ? v.meilleurPatient : null;
        var fr = "<br><b>Le verdict d'aujourd'hui</b> : sur " + v.total + " objets suivis, " +
          (v.instant === 0
            ? "<b>aucun</b> aller-retour immédiat n'est rentable"
            : "seulement " + v.instant + " aller-retour" + (v.instant > 1 ? "s sont rentables" : " est rentable")) +
          ". Un marché liquide ne laisse pas d'argent par terre : acheter et revendre dans la minute ne paie pas. " +
          v.patient + " objets ont en revanche une marge patiente positive" +
          (mieux !== null ? ", la meilleure à +" + mieux + " p" : "") +
          " — l'écart est dans l'attente, pas dans la vitesse.";
        var en = "<br><b>Today's verdict</b>: of " + v.total + " tracked items, " +
          (v.instant === 0
            ? "<b>no</b> immediate round trip is profitable"
            : "only " + v.instant + " round trip" + (v.instant > 1 ? "s are profitable" : " is profitable")) +
          ". A liquid market leaves no money on the floor: buying and reselling within the minute does not pay. " +
          v.patient + " items do have a positive patient margin" +
          (mieux !== null ? ", the best at +" + mieux + " p" : "") +
          " — the gap is in the waiting, not in the speed.";
        return T(fr, en);
      }
    },

    ducatier: {
      titre: T("Le plus de ducats par platine dépensé", "Most ducats per platinum spent"),
      sous: T("Ducats obtenus divisés par le prix <b>médian</b> des cinq offres les plus basses (tu achètes plusieurs sets : une offre isolée ne fait pas ton prix). Au-dessus de <b>10</b>, l'affaire est bonne ; en dessous de <b>5</b>, autant revendre la pièce en platine.",
              "Ducats gained divided by the <b>median</b> of the five lowest offers (you buy several sets: one lone offer is not your price). Above <b>10</b> it is a good deal; below <b>5</b> you may as well sell the part for platinum."),
      cols: T(["Objet", "Prix médian", "Ducats", "Ducats / platine", "Vendeurs"],
                 ["Item", "Median price", "Ducats", "Ducats / platinum", "Sellers"]),
      note: T("Baro Ki'Teer revient tous les 14 jours et le plafond est de 350 000 ducats. Le <a href=\"/ducats\">convertisseur</a> calcule ce que valent tes pièces déjà en poche.",
              "Baro Ki'Teer returns every 14 days and the cap is 350,000 ducats. The <a href=\"/en/ducats\">converter</a> works out what the parts you already hold are worth."),
      lignes: function () { return C.ducatier(donnees.marche.items); },
      rendu: function (r) {
        return "<tr><td>" + lien(r.slug) +
          (r.bon ? tag("ok", T("bon rendement", "good rate")) : "") + (r.faible ? tag("warn", T("faible", "weak")) : "") +
          "</td><td>" + p(r.bas) + "</td><td>" + r.ducats +
          '</td><td class="gros">' + r.ratio + "</td><td>" + r.ordres + "</td></tr>";
      }
    },

    debutant: {
      titre: T("Ce qui se vend tout de suite", "What sells right now"),
      sous: T("Un acheteur attend <b>déjà</b> sur ces objets : tu vends en un message, sans annonce, sans attendre. Classé sur la part de la médiane qu'il donne — c'est-à-dire là où vendre vite te coûte le moins.",
              "A buyer is <b>already</b> waiting on these items: one message and it is sold, no listing, no waiting. Ranked on the share of the median they offer — that is, where selling fast costs you the least."),
      cols: T(["Objet", "Un acheteur donne", "Médiane", "Part obtenue", "Ce que la vitesse coûte"],
                 ["Item", "A buyer offers", "Median", "Share obtained", "What speed costs you"]),
      note: T("La demande retenue est plafonnée à la médiane : personne ne paie durablement plus, et aucun nombre d'ordres gonflés ne peut franchir ce plafond — là où « prendre le deuxième » cède au troisième. C'est le seul classement qui ne cherche pas le prix le plus haut. Quand on part de zéro, dix platine encaissés ce soir valent mieux qu'une annonce à trente qui dort trois semaines. Une fois lancé, le profil <b>farmeur</b> paie mieux.",
              "The retained bid is capped at the median: nobody pays more than that for long, and no number of inflated orders can cross that cap — where “take the second one” gives way to the third. This is the only ranking that does not chase the highest price. Starting from nothing, ten platinum in hand tonight beats a thirty-platinum listing that sleeps for three weeks. Once you are going, the <b>farmer</b> profile pays better."),
      lignes: function () { return C.debutant(donnees.marche.items); },
      rendu: function (r) {
        return "<tr><td>" + lien(r.slug) +
          (r.seul ? tag("warn", T("une seule demande", "single bid")) : "") +
          (r.plafonne ? tag("warn", T("demande gonflée ignorée", "inflated bid ignored")) : "") +
          "</td><td class=\"gros\">" + p(r.achat) +
          "</td><td>" + p(r.median) + "</td><td>" + r.part + " %</td><td>" +
          (r.perte > 0 ? "−" + r.perte + " p" : "—") + "</td></tr>";
      }
    }
  };

  /* ------------------------------------------------------------- interface */
  function cartes() {
    var actif = P.get();
    $("pfChoix").innerHTML = P.LISTE.map(function (x) {
      return '<button type="button" class="pf-card" data-id="' + x.id + '" aria-pressed="' +
        (x.id === actif) + '"><span class="ico">' + x.ico + '</span><div class="nom">' +
        esc(x.nom) + '</div><div class="crt">' + esc(x.court) +
        '</div><div class="mien">' + T("✓ ton profil", "✓ your profile") + '</div></button>';
    }).join("");
    Array.prototype.forEach.call($("pfChoix").querySelectorAll(".pf-card"), function (b) {
      b.addEventListener("click", function () {
        // Recliquer sur son propre profil le retire : on ne piège personne
        // dans un choix fait une fois.
        P.set(P.get() === b.dataset.id ? "" : b.dataset.id);
        cartes(); montre();
      });
    });
  }

  function age(iso) {
    if (!iso) return "";
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!isFinite(m)) return "";
    return m < 60 ? T("il y a " + m + " min", m + " min ago")
         : m < 1440 ? T("il y a " + Math.round(m / 60) + " h", Math.round(m / 60) + "h ago")
         : T("il y a " + Math.round(m / 1440) + " j", Math.round(m / 1440) + "d ago");
  }

  function montre() {
    var id = P.get(), f = P.fiche(id);
    $("pfQuoi").innerHTML = f
      ? esc(f.quoi)
      : T("Aucun profil choisi — le tableau ci-dessous montre le classement du <b>farmeur</b>, le plus courant. Choisis le tien et il te suivra sur les autres pages du marché.",
          "No profile chosen — the table below shows the <b>farmer</b> ranking, the most common one. Pick yours and it will follow you on the other market pages.");
    var vue = VUES[id] || VUES.farmeur;
    $("pfTitre").textContent = (f ? f.ico + " " : "🎯 ") + vue.titre;
    $("pfSous").innerHTML = vue.sous;

    var tbl = $("pfTbl");
    if (!donnees.marche) { tbl.querySelector("tbody").innerHTML = "<tr><td>" + T("Chargement…", "Loading…") + "</td></tr>"; return; }
    if (id === "monteur" && !(donnees.recette && donnees.pieces)) {
      tbl.querySelector("tbody").innerHTML = "<tr><td>" + T("Chargement du prix des pièces…", "Loading part prices…") + "</td></tr>";
      Promise.all([json("/data/set_pieces.json"), json("/data/market_pieces.json")])
        .then(function (r) { donnees.recette = r[0]; donnees.pieces = r[1]; montre(); })
        .catch(function () {
          tbl.querySelector("tbody").innerHTML =
            "<tr><td>" + T("Le prix des pièces n'a pas pu être chargé — réessaie plus tard.",
                            "Part prices could not be loaded — try again later.") + "</td></tr>";
        });
      return;
    }

    var lignes = vue.lignes().slice(0, N);
    tbl.querySelector("thead").innerHTML =
      "<tr>" + vue.cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr>";
    tbl.querySelector("tbody").innerHTML = lignes.length
      ? lignes.map(vue.rendu).join("")
      : '<tr><td colspan="' + vue.cols.length + '">' +
        T("Aucune ligne exploitable pour l'instant.", "No usable row right now.") + '</td></tr>';

    var frais = donnees.marche.generated;
    var src = (id === "monteur" && donnees.pieces && donnees.pieces.generated)
      ? T(" · prix des pièces ", " · part prices ") + age(donnees.pieces.generated) : "";
    $("pfNote").innerHTML = vue.note + (vue.apres ? vue.apres() : "") +
      '<br><span class="pf-piv">' + lignes.length + T(" lignes · prix ", " rows · prices ") + age(frais) + src + "</span>";
  }

  function demarre() {
    cartes(); montre();
    json("/data/market.json").then(function (d) {
        (d.items || []).forEach(function (it) {
          var n = P.EST_EN ? it.nom : (it.nomFr || it.nom);
          if (it.slug && n) NOMS[it.slug] = n;
        });
        donnees.marche = d; montre();
      })
      .catch(function () {
        $("pfTbl").querySelector("tbody").innerHTML =
          "<tr><td>" + T("Les prix n'ont pas pu être chargés. Réessaie dans un moment.",
                          "Prices could not be loaded. Try again in a moment.") + "</td></tr>";
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarre);
  else demarre();
})();
