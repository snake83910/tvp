// Configuration plate ESLint 9. Remplace .eslintrc.json : Next 16 a
// supprimé la commande `next lint`, on lance désormais `eslint .`.
//
// eslint-config-next 16 exporte directement de la configuration plate.
// Ne pas le passer par FlatCompat : la conversion tente de sérialiser une
// config qui contient des références circulaires entre plugins et échoue
// sur « Converting circular structure to JSON ».
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    // En configuration plate, une clé « ignores » ne vaut globalement que
    // si elle est seule dans son objet — sinon elle ne s'applique qu'au
    // bloc qui la porte.
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-e2e/**",
      ".next-build-check/**",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // eslint-plugin-react-hooks 7 (arrivé avec eslint-config-next 16)
      // introduit cette règle, qui touche 17 composants existants : ils
      // hydratent leur état depuis un effet (chargement de données,
      // animation de montage). Le motif fonctionne, mais provoque un
      // rendu en cascade que React déconseille désormais.
      //
      // Laissée en avertissement, pas désactivée : les reprendre est un
      // travail de fond à mener composant par composant, avec un risque
      // de changement de comportement — ça n'a pas sa place dans une
      // migration de framework. En « warn », le CI passe et le décompte
      // reste sous les yeux ; en « off », il disparaîtrait pour de bon.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
