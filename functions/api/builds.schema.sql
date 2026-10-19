-- VoidRelay — bibliothèque publique de builds (Cloudflare D1).
--
-- CE FICHIER N'EST PLUS OBLIGATOIRE (v77). Les mêmes ordres vivent dans
-- functions/api/builds.js (constante SCHEMA) et sont posés automatiquement au
-- premier appel qui trouve une table absente. Le coller dans la console SQL de
-- la base « voidrelay » reste possible : c'est simplement plus rapide.
-- Il reste la version LISIBLE du schéma (commentaires, requêtes d'entretien) ;
-- verifier_api_builds.mjs interdit aux deux de diverger.
-- Marche à suivre complète en tête de functions/api/builds.js.

CREATE TABLE IF NOT EXISTS builds (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  arme    TEXT NOT NULL,                   -- uniqueName de l'arme (clef de regroupement)
  titre   TEXT NOT NULL,
  auteur  TEXT,
  notes   TEXT,
  lien    TEXT NOT NULL,                   -- lien d'Arsenal contenant le build (#z= / #b=)
  emp     TEXT NOT NULL,                   -- empreinte SALEE de l'IP, jamais l'IP
  statut  TEXT NOT NULL DEFAULT 'attente', -- attente | ok | refuse
  votes   INTEGER NOT NULL DEFAULT 0,
  cree    TEXT NOT NULL
);

-- La requete de la bibliotheque est toujours « cette arme, triee par votes ».
CREATE INDEX IF NOT EXISTS idx_builds_arme ON builds (statut, arme, votes DESC);
CREATE INDEX IF NOT EXISTS idx_builds_date ON builds (statut, cree DESC);
-- Le debit se mesure par empreinte sur la derniere heure.
CREATE INDEX IF NOT EXISTS idx_builds_emp  ON builds (emp, cree);

-- Un vote par empreinte et par build : c'est la contrainte d'unicite qui fait
-- foi, pas une lecture prealable (deux requetes simultanees passeraient).
CREATE TABLE IF NOT EXISTS votes (
  build_id INTEGER NOT NULL,
  emp      TEXT NOT NULL,
  PRIMARY KEY (build_id, emp)
);

-- Signalements (05/09/2026, publication automatique). Un signalement par
-- empreinte et par build : meme contrainte d'unicite que les votes, sinon une
-- seule personne masquerait n'importe quoi en cliquant deux fois.
CREATE TABLE IF NOT EXISTS signalements (
  build_id INTEGER NOT NULL,
  emp      TEXT NOT NULL,
  PRIMARY KEY (build_id, emp)
);

-- ---------------------------------------------------------------------------
-- Synchronisation par code (functions/api/sync.js).
-- Le serveur ne range que du CHIFFRE : il ne connait ni le code ni le contenu.
CREATE TABLE IF NOT EXISTS sync (
  id     TEXT PRIMARY KEY,   -- empreinte du code, produite par le navigateur
  paquet TEXT NOT NULL,      -- <base64 vecteur>.<base64 contenu chiffre>
  maj    TEXT NOT NULL
);
-- Debit des envois, par empreinte d'IP salee (jamais l'IP).
CREATE TABLE IF NOT EXISTS sync_debit (
  emp   TEXT NOT NULL,
  quand TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_debit ON sync_debit (emp, quand);

-- Entretien, a lancer de temps en temps dans la console SQL :
--   DELETE FROM sync_debit WHERE quand < datetime('now','-2 hours');
--   DELETE FROM sync       WHERE maj   < datetime('now','-2 years');
