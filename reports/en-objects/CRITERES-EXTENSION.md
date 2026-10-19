# Critères d'extension du lot EN (250 → 3834 pages)

Écrit le 2026-07-10, **avant toute donnée réelle** (le lot EN vient d'être construit,
aucun rapport hebdo n'a encore tourné). But explicite : fixer les seuils maintenant
pour ne pas les ajuster après coup en fonction du résultat qu'on aurait envie de voir.

Fenêtre de mesure convenue : **4 à 6 semaines** après la mise en prod du lot de 250
pages, avant toute décision d'extension.

---

## 1. Ce qui justifierait d'étendre aux 3834 pages

Tous les seuils ci-dessous portent sur les **totaux cumulés** `/en/o/` + `/en/guides/`
sur la fenêtre de 4-6 semaines, pas sur un pic isolé d'une seule semaine.

| Signal | Seuil | Pourquoi ce chiffre |
|---|---|---|
| Impressions cumulées (Search Console) | ≥ 500 | Condition minimale : Google indexe et montre les pages. En dessous, il n'y a même pas encore de quoi juger la demande. |
| Tendance des impressions | Croissance sur au moins 3 des 6 semaines | Un pic isolé suivi d'un creux ne prouve rien ; une tendance sur plusieurs semaines si. |
| Clics cumulés (Search Console) | ≥ 20 | Volontairement bas : 250 pages neuves mettent du temps à se positionner. Le seuil sert à distinguer "ça démarre" de "zéro absolu". |
| CTR moyen | ≥ 1% | En dessous, signal de mauvais titre/snippet plutôt que de manque de demande réelle (voir section 3). |
| Position moyenne | < 50, ou en amélioration continue | Au-delà de la page 5, le volume d'impressions ne se traduit quasiment jamais en clics, peu importe le volume. |
| Pageviews réels (Cloudflare) | Cohérents avec les clics Search Console (± ordre de grandeur) | Vérifie que les clics mesurés par Google correspondent à du trafic réel arrivé sur le site, pas un artefact de mesure. |
| RPM (revenu pour mille pages) EN vs FR | Dans une fourchette de ±30% du RPM FR historique | **Non mesurable automatiquement pour l'instant** — voir section 4. |

**Si la majorité de ces signaux est au vert de façon cohérente** (pas un seul chiffre isolé) →
extension aux 3834 objets justifiée.

---

## 2. Ce qui justifierait d'attendre encore (pas d'extension, pas d'abandon)

- **0 impression après 3 semaines complètes** : ce n'est PAS un verdict "pas de demande" —
  c'est un signal d'un problème d'indexation (sitemap bien soumis ? `hreflang` correct ?
  pages bien crawlables ?). Dans ce cas, la bonne action est de diagnostiquer avant de
  conclure quoi que ce soit sur la demande.
- **Décroissance continue** sur les 6 semaines (impressions ET clics) : signal négatif
  franc, à distinguer d'une simple variance semaine à semaine.

---

## 3. Ce qui justifierait d'ajuster le contenu plutôt que d'étendre ou d'abandonner

- **Impressions correctes mais CTR quasi nul** (< 0,3%) avec une position moyenne
  raisonnable (< 30) : Google montre les pages, les gens ne cliquent pas. C'est un
  problème de titre/méta-description (traduction trop littérale ? pas assez incitatif ?),
  pas un manque de demande. Action : retravailler les titres du template EN, pas
  renoncer au lot de 250.

---

## 4. Le point non résolu : RPM (revenu pour mille pages) EN vs FR

Mesurer un vrai RPM par langue nécessite soit :
- **Des canaux personnalisés AdSense** (URL channels) sur `/en/o/` et `/en/guides/`,
  configurés côté AdSense (pas encore fait) — mesure directe, fiable.
- **Une estimation proxy** : RPM global du site (AdSense) × pageviews EN (Cloudflare) —
  approximatif, à ne présenter QUE comme une estimation explicitement signalée comme
  telle (le CTR publicitaire et la demande annonceur peuvent différer entre FR et EN,
  donc cette estimation peut se tromper dans les deux sens).

Sans configuration AdSense supplémentaire de sa part, le rapport hebdo ne pourra
produire que l'estimation proxy, clairement marquée comme telle — pas un vrai chiffre
RPM par langue.

---

## Règle de méthode

Ce document ne doit être modifié qu'en cas de découverte d'une erreur de raisonnement
(ex. un seuil clairement mal calibré), jamais pour faire coller les critères au
résultat observé après coup. Toute modification après le début de la mesure doit être
justifiée par écrit ici, datée, avec la raison.
