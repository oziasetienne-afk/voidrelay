/* Lecture des tables de données Lua du wiki officiel (03/09/2026).
   Le wiki sert ses bases sous forme de modules Lua (Module:Stances/data,
   Module:Weapons/data/melee…) : ce sont des tables littérales, pas du code —
   un analyseur du sous-ensemble suffit et évite toute exécution de code
   distant. Gère : tables imbriquées, clefs ["texte"] / identifiant / [n],
   chaînes " et ', nombres (dont -2 et 0.28), true/false/nil, virgules et
   points-virgules en fin de liste, commentaires -- et --[[ ]].
   Une table Lua mélange partie tableau et partie dictionnaire : on rend un
   TABLEAU quand il n'y a que des valeurs positionnelles, un OBJET sinon
   (les valeurs positionnelles y prennent les clefs "1", "2", …). */

export function parseLuaTable(src, i) {
  const n = src.length;

  function espaces(p) {
    for (;;) {
      while (p < n && /\s/.test(src[p])) p++;
      if (src[p] === "-" && src[p + 1] === "-") {
        if (src[p + 2] === "[" && src[p + 3] === "[") {
          const f = src.indexOf("]]", p + 4);
          p = f === -1 ? n : f + 2;
        } else {
          const f = src.indexOf("\n", p);
          p = f === -1 ? n : f + 1;
        }
        continue;
      }
      return p;
    }
  }

  function chaine(p) {
    const q = src[p];
    let out = "";
    p++;
    while (p < n && src[p] !== q) {
      if (src[p] === "\\") {
        const c = src[p + 1];
        out += c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c;
        p += 2;
      } else out += src[p++];
    }
    return [out, p + 1];
  }

  function valeur(p) {
    p = espaces(p);
    const c = src[p];
    if (c === "{") return table(p);
    if (c === '"' || c === "'") return chaine(p);
    // identifiant, éventuellement pointé (math.huge dans les portées d'armes)
    const mot = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(p, p + 64));
    if (mot) {
      const m = mot[0];
      if (m === "true") return [true, p + 4];
      if (m === "false") return [false, p + 5];
      if (m === "nil") return [null, p + 3];
      if (m === "math.huge") return [Infinity, p + m.length];
      if (m === "-math.huge") return [-Infinity, p + m.length];
      return [m, p + m.length]; // référence/appel : gardée en texte, jamais évaluée
    }
    const num = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(p, p + 32));
    if (num) return [Number(num[0]), p + num[0].length];
    throw new Error("Lua : valeur illisible à " + p + " → " + JSON.stringify(src.slice(p, p + 40)));
  }

  function table(p) {
    p = espaces(p + 1); // saute '{'
    const dict = {};
    const liste = [];
    let aDesClefs = false;
    while (p < n && src[p] !== "}") {
      let clef = null;
      if (src[p] === "[") {
        const [k, p2] = valeur(p + 1);
        p = espaces(p2);
        if (src[p] !== "]") throw new Error("Lua : ']' attendu à " + p);
        p = espaces(p + 1);
        if (src[p] !== "=") throw new Error("Lua : '=' attendu à " + p);
        clef = String(k);
        p = p + 1;
      } else {
        const id = /^[A-Za-z_][A-Za-z0-9_]*\s*=(?!=)/.exec(src.slice(p, p + 64));
        if (id) {
          clef = id[0].replace(/\s*=$/, "");
          p += id[0].length;
        }
      }
      const [v, p3] = valeur(p);
      if (clef === null) liste.push(v); else { dict[clef] = v; aDesClefs = true; }
      p = espaces(p3);
      if (src[p] === "," || src[p] === ";") p = espaces(p + 1);
    }
    if (!aDesClefs) return [liste, p + 1];
    liste.forEach((v, k) => { dict[String(k + 1)] = v; });
    return [dict, p + 1];
  }

  return valeur(i)[0];
}

/* Table nommée d'un module : `local X = { … }` ou `X = { … }`. */
export function tableLuaNommee(src, nom) {
  const re = new RegExp("(?:^|\\n)\\s*(?:local\\s+)?" + nom + "\\s*=\\s*\\{");
  const m = re.exec(src);
  if (!m) throw new Error("table Lua « " + nom + " » introuvable");
  return parseLuaTable(src, m.index + m[0].length - 1);
}

/* Module qui rend directement sa table : `return { … }` (Module:Weapons/data/*). */
export function tableLuaRetournee(src) {
  const m = /(?:^|\n)\s*return\s*\{/.exec(src);
  if (!m) throw new Error("aucun « return { … } » dans ce module Lua");
  return parseLuaTable(src, m.index + m[0].length - 1);
}
