/**
 * Articles du hub « Guide du pneu » : contenu structuré, rendu par
 * /guide/[slug]. Chaque article cible une requête informationnelle
 * (« loi montagne pneus », « pression pneus »…) NON couverte par la page
 * pilier /guide, pour bâtir l'autorité thématique sans cannibalisation.
 */

export interface GuideSection {
  h2: string;
  paragraphs: string[];
  list?: string[];
  note?: string;
}

export interface GuideArticle {
  slug: string;
  title: string; // H1
  metaTitle: string;
  description: string;
  intro: string;
  sections: GuideSection[];
  faq?: { q: string; a: string }[];
}

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    slug: "loi-montagne",
    title: "Loi Montagne : pneus hiver obligatoires du 1er novembre au 31 mars",
    metaTitle: "Loi Montagne 2026 : zones, pneus acceptés, sanctions",
    description:
      "Loi Montagne II : dans quels départements les pneus hiver sont obligatoires, du 1er novembre au 31 mars, quels équipements sont acceptés (3PMSF, chaînes, chaussettes) et ce que vous risquez.",
    intro:
      "Depuis novembre 2021, la loi Montagne II impose des équipements hivernaux dans certaines zones de France, chaque année du 1er novembre au 31 mars. Voici, concrètement, qui est concerné, quels pneus sont acceptés et comment être en règle sans se sur-équiper.",
    sections: [
      {
        h2: "Qui est concerné ?",
        paragraphs: [
          "La loi s'applique dans 34 départements situés en zones de montagne : Alpes, Pyrénées, Massif central, Jura, Vosges et Corse. Dans chaque département concerné, le préfet définit la liste précise des communes où l'obligation s'applique — elle est signalée par les panneaux B58 (entrée de zone) et B59 (sortie).",
          "L'obligation concerne les véhicules légers, utilitaires, camping-cars, poids lourds et autocars, qu'ils soient immatriculés en France ou à l'étranger. Elle s'applique même pour un simple transit par la zone.",
        ],
      },
      {
        h2: "Quels équipements sont acceptés ?",
        paragraphs: [
          "Vous êtes en règle si votre véhicule remplit l'une de ces deux conditions pendant la période :",
        ],
        list: [
          "Quatre pneus hiver ou 4 saisons marqués 3PMSF (pictogramme montagne à trois pics avec flocon). Depuis le 1er novembre 2024, le marquage M+S seul ne suffit plus.",
          "Des chaînes ou chaussettes à neige (au moins pour deux roues motrices) détenues à bord du véhicule.",
        ],
        note: "Le marquage 3PMSF certifie un test d'adhérence sur neige normalisé. C'est le seul repère fiable : la mention « M+S » est déclarative, sans test obligatoire.",
      },
      {
        h2: "Que risque-t-on ?",
        paragraphs: [
          "Le non-respect de l'obligation est passible d'une amende de 135 € et d'une possible immobilisation du véhicule. Au-delà de la sanction, rouler sans équipement adapté sur route enneigée met en jeu votre sécurité et celle des autres : les distances de freinage sur neige sont divisées par deux avec des pneus homologués.",
        ],
      },
      {
        h2: "Faut-il des pneus hiver ou des 4 saisons ?",
        paragraphs: [
          "Pour rester en règle toute l'année sans changer de monte, des pneus 4 saisons marqués 3PMSF sont le choix le plus simple : ils sont conformes à la loi Montagne et évitent le double jeu de pneus. Si vous vivez en altitude ou roulez beaucoup l'hiver, de vrais pneus hiver restent plus performants sous 7 °C et sur neige.",
        ],
      },
    ],
    faq: [
      {
        q: "La loi Montagne s'applique-t-elle aux touristes de passage ?",
        a: "Oui. L'obligation s'applique à tout véhicule circulant dans une commune concernée pendant la période, y compris en transit ou en vacances.",
      },
      {
        q: "Les pneus M+S sont-ils encore acceptés ?",
        a: "Non. Depuis le 1er novembre 2024, seuls les pneus marqués 3PMSF sont considérés comme des pneus hiver au sens de la loi Montagne. Le marquage M+S seul n'est plus suffisant.",
      },
      {
        q: "Deux pneus hiver suffisent-ils ?",
        a: "Non. La loi impose quatre pneus homologués. Techniquement, mélanger pneus été et hiver déséquilibre le comportement du véhicule, notamment au freinage.",
      },
    ],
  },
  {
    slug: "pression-des-pneus",
    title: "Pression des pneus : quelle valeur, quand et comment vérifier",
    metaTitle: "Pression des pneus : la bonne valeur et les erreurs à éviter",
    description:
      "Où trouver la pression recommandée pour votre voiture, quand la vérifier, sous-gonflage et surgonflage : les règles simples pour la sécurité, la consommation et la durée de vie des pneus.",
    intro:
      "La pression est le réglage le plus important — et le plus négligé — d'un pneu. Un pneu sous-gonflé s'use plus vite, chauffe, augmente la consommation et allonge les distances de freinage. Voici comment faire simple et juste.",
    sections: [
      {
        h2: "Où trouver la bonne pression ?",
        paragraphs: [
          "La pression recommandée par le constructeur figure sur une étiquette collée dans l'ouverture de la portière conducteur (parfois dans la trappe à carburant) et dans le manuel du véhicule. Elle est exprimée en bars et souvent donnée pour deux situations : usage normal et véhicule chargé (autoroute, vacances).",
          "C'est cette valeur qui fait foi — pas celle inscrite sur le flanc du pneu, qui est une pression maximale admissible, pas une recommandation.",
        ],
      },
      {
        h2: "Quand et comment vérifier ?",
        paragraphs: [
          "Vérifiez la pression une fois par mois et avant tout long trajet, idéalement à froid (moins de 3 km parcourus). Si vous contrôlez à chaud, ajoutez 0,3 bar à la valeur recommandée, et ne dégonflez jamais un pneu chaud.",
        ],
        list: [
          "Contrôlez les quatre pneus, et la roue de secours une fois par trimestre.",
          "Remettez toujours les bouchons de valve : ils protègent de la poussière et de l'humidité.",
          "N'oubliez pas d'ajuster à la pression « chargé » avant un départ en vacances.",
        ],
      },
      {
        h2: "Sous-gonflage : le vrai danger",
        paragraphs: [
          "À -0,5 bar, la distance de freinage s'allonge et le pneu s'use anormalement sur les épaules. À -1 bar, le risque d'éclatement devient réel : le flanc s'échauffe en roulant. Le sous-gonflage augmente aussi la consommation de carburant (jusqu'à 5 %) et c'est la première cause de crevaison sur autoroute.",
          "Le surgonflage modéré est moins dangereux mais dégrade le confort, réduit la surface de contact et use le centre de la bande de roulement.",
        ],
        note: "Depuis 2014, les voitures neuves sont équipées d'un détecteur de sous-gonflage (TPMS). Il alerte en cas de perte notable, mais ne remplace pas un contrôle mensuel : il se déclenche souvent tard.",
      },
    ],
    faq: [
      {
        q: "Quelle pression pour ma voiture ?",
        a: "Celle indiquée sur l'étiquette de la portière conducteur ou dans le manuel — généralement entre 2,0 et 2,8 bars pour une voiture de tourisme. La valeur exacte dépend du véhicule, de la dimension du pneu et de la charge.",
      },
      {
        q: "Faut-il gonfler à l'azote ?",
        a: "L'azote fuit un peu moins vite que l'air et sa pression varie moins avec la température, mais pour un usage courant, l'air est parfaitement adapté et gratuit. L'azote n'est pas un prérequis de sécurité.",
      },
    ],
  },
  {
    slug: "quand-changer-ses-pneus",
    title: "Quand changer ses pneus : usure, témoins et limite légale",
    metaTitle: "Quand changer ses pneus ? Usure, témoin, 1,6 mm : les repères",
    description:
      "Témoin d'usure, profondeur légale de 1,6 mm, âge du pneu, usure irrégulière : les signes qui indiquent qu'il faut changer ses pneus, et ce que dit la réglementation.",
    intro:
      "Un pneu usé freine moins bien, aquaplane plus tôt et peut vous coûter une contre-visite au contrôle technique — voire une amende. Voici les repères concrets pour savoir quand il est temps de changer.",
    sections: [
      {
        h2: "La limite légale : 1,6 mm",
        paragraphs: [
          "En France comme dans toute l'Union européenne, la profondeur minimale des sculptures est de 1,6 mm sur toute la bande de roulement. En dessous, le véhicule n'est plus conforme : amende possible de 135 €, immobilisation, et contre-visite au contrôle technique.",
          "Chaque pneu intègre des témoins d'usure : de petites barrettes de gomme au fond des rainures principales, repérées par le sigle TWI (ou un logo de la marque) sur l'épaule. Quand la bande de roulement arrive au niveau des témoins, le pneu est à remplacer.",
        ],
        note: "En pratique, n'attendez pas 1,6 mm : sous 3 mm (été) et 4 mm (hiver), les performances sur sol mouillé et sur neige chutent fortement. Le test de la pièce de 1 € : si le liseré doré disparaît dans la rainure, il reste une marge correcte.",
      },
      {
        h2: "L'âge du pneu compte aussi",
        paragraphs: [
          "Même peu utilisé, un pneu vieillit : la gomme durcit et perd de l'adhérence. Au-delà de 5 ans, faites-le inspecter chaque année ; au-delà de 10 ans (date DOT sur le flanc), remplacez-le, même si la sculpture semble correcte. C'est particulièrement vrai pour les véhicules qui roulent peu et les roues de secours.",
        ],
      },
      {
        h2: "Les signes qui ne trompent pas",
        paragraphs: ["Au-delà de l'usure normale, certains signes imposent un remplacement immédiat ou un passage au garage :"],
        list: [
          "Usure irrégulière (un bord plus usé que l'autre) : contrôle de géométrie ou de pression nécessaire.",
          "Hernie ou bosse sur le flanc : structure endommagée, remplacement immédiat.",
          "Craquelures visibles sur les flancs : gomme vieillissante.",
          "Vibrations inhabituelles dans le volant : équilibrage ou usure anormale.",
          "Crevaison réparée plusieurs fois sur le même pneu.",
        ],
      },
      {
        h2: "Par deux, et plutôt à l'arrière",
        paragraphs: [
          "Remplacez toujours les pneus par paire (même essieu), avec des pneus identiques en marque, modèle et dimension. Si vous ne changez que deux pneus, montez les neufs à l'arrière : un train arrière qui décroche est bien plus difficile à rattraper qu'un train avant, quelle que soit la transmission.",
        ],
      },
    ],
    faq: [
      {
        q: "Quelle est la durée de vie moyenne d'un pneu ?",
        a: "Entre 30 000 et 50 000 km pour un pneu été de qualité, selon le style de conduite, le véhicule et l'entretien (pression, géométrie). En années : 10 ans maximum, contrôle annuel dès 5 ans.",
      },
      {
        q: "Peut-on rouler avec des pneus de marques différentes ?",
        a: "C'est légal si les dimensions et indices sont conformes, et que les deux pneus d'un même essieu sont identiques. Pour un comportement homogène, une monte identique sur les quatre roues reste recommandée.",
      },
    ],
  },
  {
    slug: "stockage-des-pneus",
    title: "Stocker ses pneus : la bonne méthode pour les préserver",
    metaTitle: "Stockage des pneus : méthode, position, erreurs à éviter",
    description:
      "Comment stocker des pneus été ou hiver entre deux saisons : nettoyage, position (empilés ou debout), lieu idéal, et les erreurs qui abîment la gomme.",
    intro:
      "Si vous alternez pneus été et hiver, la moitié de votre monte passe six mois au repos. Bien stockés, vos pneus gardent leurs performances plusieurs saisons ; mal stockés, la gomme se déforme ou se craquèle. La méthode est simple.",
    sections: [
      {
        h2: "Avant le stockage",
        paragraphs: [
          "Lavez les pneus à l'eau et au savon pour retirer sel, gravillons et poussières de frein, puis séchez-les. Profitez-en pour inspecter la gomme (coupures, hernies, usure irrégulière) et notez la position de chaque roue (AVG, AVD, ARG, ARD) à la craie : vous permuterez à la remonte pour égaliser l'usure.",
        ],
      },
      {
        h2: "La bonne position selon le cas",
        paragraphs: ["La règle dépend d'une seule chose : les pneus sont-ils montés sur jantes ?"],
        list: [
          "Pneus SUR jantes (roues complètes) : empilés à plat ou suspendus à des crochets. Gonflez-les légèrement au-dessus de la pression d'usage.",
          "Pneus SANS jantes : debout, à la verticale, en les tournant d'un quart de tour chaque mois. Jamais empilés ni suspendus : la carcasse se déformerait.",
        ],
      },
      {
        h2: "Le lieu idéal",
        paragraphs: [
          "Un endroit sec, frais, ventilé et à l'abri de la lumière : cave saine ou garage. Évitez le plein soleil (les UV craquellent la gomme), les fortes chaleurs, et la proximité de produits chimiques, solvants ou d'un moteur électrique (l'ozone dégrade le caoutchouc). Posez les pneus sur une surface propre, pas à même un sol gras.",
          "Pas de place chez vous ? La plupart des garages proposent la garde de pneus saisonnière pour quelques dizaines d'euros par saison — souvent couplée au montage.",
        ],
      },
    ],
    faq: [
      {
        q: "Combien de temps peut-on stocker un pneu neuf ?",
        a: "Stocké dans de bonnes conditions, un pneu neuf conserve ses propriétés environ 5 ans avant montage. Vérifiez la date DOT gravée sur le flanc avant de le monter.",
      },
      {
        q: "Faut-il des housses de stockage ?",
        a: "Elles protègent de la poussière et de la lumière, c'est un plus, surtout pour des roues complètes empilées. L'essentiel reste le lieu : sec, frais et sombre.",
      },
    ],
  },
  {
    slug: "pneus-neufs-avant-ou-arriere",
    title: "Pneus neufs à l'avant ou à l'arrière ? La réponse des professionnels",
    metaTitle: "Pneus neufs : à monter à l'avant ou à l'arrière ?",
    description:
      "Quand on ne remplace que deux pneus, faut-il monter les neufs à l'avant ou à l'arrière ? La règle des professionnels, l'explication physique, et le rôle de la permutation.",
    intro:
      "C'est une question qui revient à chaque remplacement partiel : les deux pneus neufs vont-ils à l'avant, là où ça use le plus, ou à l'arrière ? La réponse des manufacturiers est unanime — et contre-intuitive.",
    sections: [
      {
        h2: "Les pneus neufs se montent à l'arrière",
        paragraphs: [
          "Quelle que soit la transmission du véhicule (traction, propulsion ou intégrale), les pneus les moins usés doivent équiper le train arrière. La raison est une question de comportement dynamique : sur sol mouillé, un train avant qui décroche provoque un sous-virage — le véhicule s'élargit, mais reste rattrapable en levant le pied. Un train arrière qui décroche provoque un survirage : l'arrière part en tête-à-queue, une situation que la plupart des conducteurs ne savent pas contrôler.",
          "Des pneus usés à l'arrière aquaplanent plus tôt que des neufs à l'avant : c'est précisément le scénario du tête-à-queue sur autoroute mouillée.",
        ],
      },
      {
        h2: "Et l'usure plus rapide à l'avant ?",
        paragraphs: [
          "C'est vrai : sur une traction (la majorité des voitures), l'avant use ses pneus nettement plus vite — il motrice, freine et dirige. Monter les neufs à l'arrière signifie que les pneus avant, partiellement usés, seront à remplacer plus tôt. C'est le prix de la sécurité, et c'est là qu'intervient la permutation.",
        ],
      },
      {
        h2: "La permutation : user ses quatre pneus ensemble",
        paragraphs: [
          "Permuter les pneus (échanger avant et arrière) tous les 10 000 à 15 000 km égalise l'usure des quatre roues. Résultat : on remplace les quatre pneus en même temps, on évite le débat avant/arrière, et on profite de montes toujours homogènes. Respectez le sens de rotation des pneus directionnels lors de la permutation.",
        ],
        note: "Certains véhicules ont des dimensions différentes entre l'avant et l'arrière (montes décalées, sportives) : la permutation avant/arrière y est impossible.",
      },
    ],
    faq: [
      {
        q: "Peut-on ne changer qu'un seul pneu ?",
        a: "À éviter, sauf pneu récent endommagé : les deux pneus d'un même essieu doivent être identiques (marque, modèle, dimension) et d'usure proche. Un écart d'usure important sur un essieu déséquilibre le freinage.",
      },
      {
        q: "La règle vaut-elle aussi pour une propulsion ?",
        a: "Oui. La règle « les neufs à l'arrière » vaut pour toutes les transmissions : elle concerne la stabilité du véhicule, pas les roues motrices.",
      },
    ],
  },
];

export function getGuideArticle(slug: string): GuideArticle | null {
  return GUIDE_ARTICLES.find((a) => a.slug === slug) ?? null;
}
