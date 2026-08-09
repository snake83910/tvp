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
  // react-hooks/set-state-in-effect reste au niveau « error » de la
  // config Next : les 17 composants qui hydrataient leur état depuis un
  // effet ont été repris (localStorage via useSyncExternalStore dans
  // lib/localStore, chargements en chaînes de promesses, états dérivés,
  // animation du toast en CSS). Toute nouvelle occurrence casse le lint.
];

export default config;
