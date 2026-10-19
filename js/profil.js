/* Profil de marché — une seule question posée au visiteur, et tout le site s'y range.

   Pourquoi un profil plutôt qu'un réglage par page : les gens ne jouent pas le
   marché de la même façon, et la MÊME donnée ne les intéresse pas de la même
   manière. Celui qui farme veut savoir ce que ça vaut ; celui qui revend veut
   savoir de combien c'est écarté. Leur servir le même classement, c'est en
   perdre quatre sur cinq.

   Le profil vit dans localStorage sous « vr_profil » — clef déjà présente dans
   la liste blanche de js/sync.js, donc il suit le visiteur d'un appareil à
   l'autre s'il synchronise. Aucun compte, aucune donnée personnelle : c'est un
   mot parmi cinq. */
(function (g) {
  "use strict";
  var CLEF = "vr_profil";
  /* Même bascule que le simulateur d'Arsenal : la langue vient de l'attribut
     lang de la page, jamais d'un réglage à part. Une page anglaise sert de
     l'anglais, point — rien à choisir, rien à désynchroniser. */
  var EST_EN = (typeof document !== "undefined" && document.documentElement &&
                document.documentElement.lang === "en");
  function T(fr, en) { return EST_EN ? en : fr; }

  var LISTE = [
    { id: "farmeur",  ico: "🎯",
      nom:   T("Le farmeur", "The farmer"),
      court: T("Je farme, je vends.", "I farm it, I sell it."),
      quoi:  T("Tu ouvres des reliques et tu revends ce qui en sort. Ce qui compte pour toi : combien vaut une pièce, et combien de vendeurs sont déjà devant toi.",
               "You crack relics and sell what comes out. What matters to you: what a part is worth, and how many sellers are already ahead of you.") },
    { id: "monteur",  ico: "🧩",
      nom:   T("Le monteur de set", "The set builder"),
      court: T("J'achète les pièces, je revends le set entier.", "I buy the parts, I sell the whole set."),
      quoi:  T("Tu rachètes les morceaux un par un et tu revends l'ensemble monté. Ce qui compte pour toi : l'écart entre le coût des pièces et le prix du set.",
               "You buy the pieces one by one and sell the assembled set. What matters to you: the gap between what the parts cost and what the set sells for.") },
    { id: "flipper",  ico: "⚡",
      nom:   T("Le flipper", "The flipper"),
      court: T("J'achète au plus bas, je revends plus haut.", "I buy low, I sell higher."),
      quoi:  T("Tu ne farmes rien : tu achètes ce qui est mal placé et tu le remets au prix. Ce qui compte pour toi : l'écart entre la vente la plus basse et l'achat le plus haut.",
               "You farm nothing: you buy what is mispriced and put it back at market price. What matters to you: the gap between the lowest sell and the highest buy.") },
    { id: "ducatier", ico: "💎",
      nom:   T("Le ducatier", "The ducat hunter"),
      court: T("J'achète pas cher, je recycle en ducats.", "I buy cheap, I recycle into ducats."),
      quoi:  T("Tu convertis des pièces Prime bon marché en ducats pour Baro. Ce qui compte pour toi : les ducats obtenus par platine dépensé.",
               "You turn cheap Prime parts into ducats for Baro. What matters to you: ducats gained per platinum spent.") },
    { id: "debutant", ico: "🌱",
      nom:   T("Le débutant", "The newcomer"),
      court: T("Je n'ai pas de platine à investir.", "I have no platinum to invest."),
      quoi:  T("Tu pars de zéro : pas de mise de départ, pas d'annonce à faire vivre. Ce qui compte pour toi : ce qui se vend TOUT DE SUITE, parce qu'un acheteur attend déjà.",
               "You start from nothing: no stake, no listing to keep alive. What matters to you: what sells RIGHT NOW, because a buyer is already waiting.") }
  ];

  function get() {
    try {
      var v = localStorage.getItem(CLEF) || "";
      return LISTE.some(function (p) { return p.id === v; }) ? v : "";
    } catch (e) { return ""; }
  }
  function set(v) {
    try { v ? localStorage.setItem(CLEF, v) : localStorage.removeItem(CLEF); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent("vr:profil", { detail: v || "" })); } catch (e) {}
  }
  function fiche(id) {
    for (var i = 0; i < LISTE.length; i++) if (LISTE[i].id === id) return LISTE[i];
    return null;
  }

  /* Bandeau discret posé en haut d'une page de marché. Deux états seulement :
     profil choisi (on le rappelle et on renvoie à SON classement) ou pas encore
     (une invitation, jamais un blocage — le site marche sans profil). */
  function banniere(hote) {
    if (!hote) return;
    var p = fiche(get());
    var a = document.createElement("a");
    a.className = "vr-profil-bandeau";
    a.href = EST_EN ? "/en/market-profiles" : "/marche-profils";
    a.innerHTML = p
      ? '<span class="ico">' + p.ico + '</span><span><b>' + p.nom + '</b> — ' + p.court +
        '</span><span class="go">' + T("Ton classement →", "Your ranking →") + '</span>'
      : '<span class="ico">🧭</span><span>' +
        T("On ne joue pas tous le marché pareil. <b>Dis comment tu joues</b>, le site classe pour toi.",
          "We do not all play the market the same way. <b>Say how you play</b>, the site ranks for you.") +
        '</span><span class="go">' + T("Choisir →", "Choose →") + '</span>';
    hote.appendChild(a);
  }

  /* /outils et /en/tools : « tes outils » plutôt qu'une liste de dix-sept.

     La correspondance outil → profils est écrite SUR LA CARTE (`data-pf`), jamais
     ici : une carte ajoutée demain porte ses profils avec elle, et il n'y a pas de
     liste tenue à part qui puisse se désynchroniser de la page. Même parti pris que
     le nombre d'outils, compté sur la page plutôt que recopié.

     Deux temps, et les deux PENDANT l'analyse de la page : `banniere()` pose une
     boîte vide au-dessus de la grille, `outils()` la remplit une fois les cartes
     lues. La boîte réserve sa hauteur dès le premier rendu — la remplir ne décale
     donc rien, ce que le garde-fou CLS vérifie.

     Les cartes retenues ne changent PAS de contenu : un simple `outline` les
     souligne. Ajouter un badge dedans en changerait la hauteur, donc la mise en
     page de toute la grille. */
  function boite(hote) {
    if (!hote || !get()) return null;
    var d = document.createElement("p");
    d.className = "vr-profil-outils";
    hote.appendChild(d);
    return d;
  }
  function outils(boiteEl) {
    var id = get(), p = fiche(id);
    if (!boiteEl || !p) return 0;
    var miens = [].slice.call(document.querySelectorAll(".tool-card[data-pf]"))
      .filter(function (c) {
        return (" " + (c.getAttribute("data-pf") || "") + " ").indexOf(" " + id + " ") >= 0;
      });
    if (!miens.length) { boiteEl.parentNode.removeChild(boiteEl); return 0; }
    var liens = miens.map(function (c) {
      var h = c.querySelector("h2");
      c.className += " pf-mien";
      return '<a href="' + c.getAttribute("href") + '">' +
             (h ? h.textContent : c.getAttribute("href")) + "</a>";
    }).join(" · ");
    boiteEl.innerHTML = "<b>" + p.ico + " " + T("Tes outils", "Your tools") + "</b> " + liens;
    return miens.length;
  }

  g.VRProfil = { CLEF: CLEF, LISTE: LISTE, get: get, set: set, fiche: fiche,
                 banniere: banniere, boite: boite, outils: outils, EST_EN: EST_EN, T: T };
})(window);
