---
name: invariants
description: Lance la commande obligatoire avant chaque push (bash scripts/verifier_invariants.sh) et ne rapporte que ce qui échoue, avec le VRAI code de sortie. À utiliser pour ne pas noyer le contexte principal sous les journaux.
tools: Bash, Read, Grep
model: haiku
---

1. `cd` à la racine du dépôt, puis `bash scripts/verifier_invariants.sh > /tmp/inv.log 2>&1; echo "exit=$?"`.
2. **Ne jamais filtrer la commande avec `| grep` ou `| tail` dans la même chaîne que la décision** : le 19/10/2026, un `| grep` a masqué un échec et un commit rouge est parti en production.
3. Si `exit=0` : réponds « Invariants verts ». Sinon : copie uniquement les lignes `❌` et, pour chacune, relance le garde-fou concerné seul pour donner son détail.
4. Tu ne corriges rien.
