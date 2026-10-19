/* ============================================================================
   VoidRelay — LE FIL D'ARIANE, LU SUR LA PAGE.

   Un seul endroit sait transformer un « <nav class="bc"> » en BreadcrumbList
   schema.org, et il est partagé par le générateur (qui pose la déclaration) et
   par le garde-fou (qui la vérifie). Sans ce partage, les deux finiraient par
   ne plus dire la même chose — et c'est précisément la panne que le garde-fou
   est censé détecter.

   Le principe tient en une phrase : CE QUE LE VISITEUR LIT EST CE QUE GOOGLE
   REÇOIT. Rien n'est rédigé à côté, donc rien ne peut se désynchroniser.
   ========================================================================== */

export const SITE = "https://voidrelay.fr";

/* Le sélecteur de langue vit DANS le <nav class="bc"> (à droite, flottant) —
   c'est un choix de mise en page, pas une étape du chemin. Il porte toujours
   hreflang : c'est ce qui le distingue, plutôt qu'une liste de libellés qui
   rouillerait à la première langue ajoutée. */
const EST_LIEN_DE_LANGUE = /hreflang=/;

const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", laquo: "«", raquo: "»" };
export function texteNu(html) {
  return String(html)
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (t, e) => (e in ENTITES ? ENTITES[e] : (/^#\d+$/.test(e) ? String.fromCharCode(+e.slice(1)) : t)))
    .replace(/\s+/g, " ")
    .trim();
}

/* Les étapes du fil visible. `href: null` marque l'étape courante (le <span>). */
export function filVisible(html) {
  const nav = /<nav class="bc"[^>]*>([\s\S]*?)<\/nav>/.exec(String(html));
  if (!nav) return [];
  const etapes = [];
  for (const m of nav[1].matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>|<span[^>]*>([\s\S]*?)<\/span>/g)) {
    if (m[1] !== undefined) {
      if (EST_LIEN_DE_LANGUE.test(m[1])) continue;
      const href = /href="([^"]*)"/.exec(m[1]);
      etapes.push({ nom: texteNu(m[2]), href: href ? href[1] : "" });
    } else {
      etapes.push({ nom: texteNu(m[3]), href: null });
    }
  }
  return etapes.filter((e) => e.nom);
}

/* La déclaration attendue pour une page. `null` quand il n'y a rien à déclarer :
   un fil d'une seule étape n'apprend rien à un moteur de recherche.
   Même forme que celle qu'écrivent déjà les pages objet et les guides :
   « item » sur chaque étape, l'URL canonique pour la dernière. */
export function declarationFilAriane(html, urlCanonique) {
  const etapes = filVisible(html);
  if (etapes.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: etapes.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.nom,
      item: e.href ? (e.href.startsWith("http") ? e.href : SITE + e.href) : urlCanonique,
    })),
  };
}

export function canoniqueDe(html) {
  const m = /<link rel="canonical" href="([^"]+)"/.exec(String(html));
  return m ? m[1] : null;
}

/* Pose la déclaration dans une page qui n'en a pas encore. Utilisée par les
   générateurs juste avant l'écriture : la page vient d'être fabriquée, son fil
   visible est final, on le déclare tel quel. Sans <nav class="bc"> exploitable
   ou sans </head>, la page ressort inchangée. */
export function avecFilArianeDeclare(html, urlCanonique) {
  const url = urlCanonique || canoniqueDe(html);
  const decl = declarationFilAriane(html, url);
  if (!decl || !html.includes("</head>")) return html;
  return html.replace("</head>", '<script type="application/ld+json">' + JSON.stringify(decl) + "</script>\n</head>");
}
