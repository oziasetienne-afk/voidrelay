/* ============================================================================
   VoidRelay — SYNCHRONISATION PAR CODE (03/09/2026).

   LE BESOIN N'EST PAS UNE IDENTITÉ. Le visiteur ne veut pas un compte : il
   veut retrouver ses affaires sur son téléphone ET son PC, et ne pas tout
   perdre en vidant son navigateur. C'est de la synchronisation, pas de
   l'identité — d'où un CODE, et ni e-mail ni mot de passe. Conséquence
   assumée : pas de données personnelles, donc quasi aucune empreinte RGPD,
   et rien à réinitialiser pour personne.

   TROIS RÈGLES QUI TIENNENT TOUT LE RESTE :

   1. LISTE BLANCHE. On ne synchronise QUE les clefs nommées ici. Le stockage
      local contient aussi « wmuser » (un compte warframe.market) et
      « wfproxy » (une URL de proxy) : synchroniser tout en bloc les aurait
      emportés. Une liste noire aurait laissé passer la prochaine clef ajoutée
      par mégarde ; une liste blanche, non.

   2. CHIFFRÉ CHEZ LE VISITEUR. Le serveur ne reçoit que du texte chiffré : la
      clef est dérivée du code, et le code ne quitte jamais le navigateur. Une
      base qui fuite ne révèle donc rien. Les données ne sont pas personnelles,
      mais ce n'est pas une raison d'être négligent.

   3. CODE PERDU = DONNÉES PERDUES, par construction. Le serveur ne peut pas
      déchiffrer, donc il ne peut pas dépanner. C'est le prix de ne demander
      aucune information personnelle, et l'interface le dit avant d'agir.

   Le code est une CLEF, pas un compte : qui l'a, a les données.
   ========================================================================== */
(function (global) {
  "use strict";

  // 32 caractères, sans I, L, O, 0 ni 1 : un code se recopie à la main d'un
  // appareil à l'autre, les confusions de lecture coûtent cher.
  var ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  var LONGUEUR = 20;                 // 20 x ~5 bits = ~99 bits d'entropie
  var GROUPE = 5;

  /* Les seules clefs synchronisées. Ajouter une ligne est un choix explicite ;
     c'est exactement ce qu'on veut pour une décision de ce genre. */
  var CLEFS = [
    "vr-arsenal-v1",      // l'état courant du simulateur d'Arsenal
    "vr-arsenal-builds",  // les builds enregistrés
    "favs",               // favoris du marché
    "vr-fav-objets",      // objets favoris
    "cart",               // liste de courses
    "tasks",              // tâches quotidiennes et hebdomadaires
    "foundry",            // fonderie
    "mr",                 // rang de maîtrise
    "vaultSeen",          // reliques vues
    "vr_prefs",           // préférences du tableau de bord
    "vr-theme",           // thème
    "lang",               // langue
    "vr_profil",          // profil de marché (un mot parmi cinq, aucune donnée personnelle)
  ];
  /* NE JAMAIS AJOUTER ICI : « wmuser » (compte warframe.market) et
     « wfproxy » (URL de proxy personnelle). Ce ne sont pas des progrès de jeu,
     et ils n'ont rien à faire sur un serveur. */

  function alea(n) {
    var t = new Uint8Array(n);
    (global.crypto || {}).getRandomValues(t);
    return t;
  }
  function genereCode() {
    var t = alea(LONGUEUR), s = "";
    for (var i = 0; i < LONGUEUR; i++) {
      if (i && i % GROUPE === 0) s += "-";
      s += ALPHABET[t[i] % ALPHABET.length];
    }
    return s;
  }
  // Un code se recopie : on tolère minuscules, espaces et tirets manquants.
  function normalise(code) {
    return String(code || "").toUpperCase().replace(/[^A-Z2-9]/g, "");
  }
  function codeValide(code) {
    var c = normalise(code);
    if (c.length !== LONGUEUR) return false;
    for (var i = 0; i < c.length; i++) if (ALPHABET.indexOf(c[i]) === -1) return false;
    return true;
  }

  function octets(s) { return new TextEncoder().encode(s); }
  function hex(buf) {
    return [].slice.call(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function b64(buf) {
    var bin = "", t = new Uint8Array(buf);
    for (var i = 0; i < t.length; i++) bin += String.fromCharCode(t[i]);
    return global.btoa(bin);
  }
  function deB64(s) {
    var bin = global.atob(s), t = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) t[i] = bin.charCodeAt(i);
    return t;
  }

  /* L'IDENTIFIANT envoyé au serveur n'est PAS le code : c'est une empreinte.
     Le serveur peut donc retrouver la ligne sans jamais connaître la clef qui
     la déchiffre. */
  function identifiant(code) {
    return crypto.subtle.digest("SHA-256", octets("vr-sync-id|" + normalise(code)))
      .then(function (b) { return hex(b).slice(0, 32); });
  }
  function clefDe(code) {
    var c = normalise(code);
    return crypto.subtle.importKey("raw", octets(c), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          // Sel déterministe dérivé du code : il n'y a pas de compte où ranger
          // un sel aléatoire. C'est acceptable ICI parce que le code porte
          // déjà ~99 bits d'entropie — il n'y a rien à deviner par force brute.
          { name: "PBKDF2", salt: octets("vr-sync-sel|" + c), iterations: 120000, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
  }

  function litLocal() {
    var out = {};
    CLEFS.forEach(function (k) {
      try { var v = localStorage.getItem(k); if (v !== null) out[k] = v; } catch (e) {}
    });
    return out;
  }
  function ecritLocal(obj) {
    var n = 0;
    CLEFS.forEach(function (k) {
      if (!obj || typeof obj[k] !== "string") return;
      try { localStorage.setItem(k, obj[k]); n++; } catch (e) {}
    });
    return n;
  }

  function chiffre(code, obj) {
    var iv = alea(12);
    return clefDe(code).then(function (k) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, octets(JSON.stringify(obj)));
    }).then(function (buf) { return b64(iv) + "." + b64(buf); });
  }
  function dechiffre(code, paquet) {
    var m = String(paquet || "").split(".");
    if (m.length !== 2) return Promise.reject(new Error("paquet illisible"));
    return clefDe(code).then(function (k) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(m[0]) }, k, deB64(m[1]));
    }).then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }

  function api(chemin, options) {
    return fetch("/api/sync" + (chemin || ""), options)
      .then(function (r) {
        return r.json().catch(function () { return { ok: false, error: "réponse illisible" }; })
          .then(function (j) { return { statut: r.status, corps: j }; });
      })
      .catch(function (e) { return { statut: 0, corps: { ok: false, error: String((e && e.message) || e) } }; });
  }

  function envoie(code) {
    return Promise.all([identifiant(code), chiffre(code, litLocal())]).then(function (r) {
      return api("", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r[0], paquet: r[1] }) });
    });
  }
  function recupere(code) {
    return identifiant(code).then(function (id) {
      return api("?id=" + encodeURIComponent(id));
    }).then(function (rep) {
      if (!rep.corps || rep.corps.ok !== true) return rep;
      return dechiffre(code, rep.corps.paquet).then(function (obj) {
        return { statut: rep.statut, corps: { ok: true, restaurees: ecritLocal(obj) } };
      }).catch(function () {
        // Déchiffrement raté = le code ne correspond pas à ces données. On ne
        // dit pas « code invalide » (il l'est peut-être), on dit ce qu'on sait.
        return { statut: rep.statut, corps: { ok: false, error: "ces données ne s'ouvrent pas avec ce code" } };
      });
    });
  }

  global.VRSync = {
    CLEFS: CLEFS, genereCode: genereCode, codeValide: codeValide, normalise: normalise,
    litLocal: litLocal, ecritLocal: ecritLocal, chiffre: chiffre, dechiffre: dechiffre,
    envoie: envoie, recupere: recupere, identifiant: identifiant,
  };
})(typeof window !== "undefined" ? window : globalThis);
