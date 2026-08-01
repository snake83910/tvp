import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Conditions générales de vente — tousvospneus.com",
  description:
    "Conditions générales de vente de tousvospneus.com — version en vigueur au 18 avril 2024.",
};

type Node =
  | { t: "h2"; s: string }
  | { t: "h3"; s: string }
  | { t: "h4"; s: string }
  | { t: "p"; s: string }
  | { t: "ul"; items: string[] }
  | { t: "dl"; items: [string, string][] }
  | { t: "note"; items: string[] };

const content: Node[] = [
  {
    t: "p",
    s: "TOUSVOSPNEUS.COM, société par actions simplifiée au capital de 500,00 €, enregistrée au registre du commerce et des sociétés R.C.S. Aix-en-Provence sous le numéro d'immatriculation 977 671 965, ayant pour numéro de TVA intracommunautaire FR38 977 671 965, dont le siège social est au 35B Chemin des Beaumouilles, 13710 Fuveau, email : servicesclients@tousvospneus.com, téléphone : +33 6 16 85 28 07 (ci-après désignée le « Vendeur »), a pour principale activité la vente de pneumatiques et de produits associés par le biais du site internet tousvospneus.com (ci-après le « Site »).",
  },
  {
    t: "p",
    s: "Les présentes conditions générales de vente ont vocation à régir, sans restriction, l'ensemble des ventes de produits et services à tout client, personne physique ou morale, qu'il soit consommateur, non-professionnel ou professionnel (ci-après le « Client »), ayant réalisé un achat sur le Site et à définir les rapports contractuels entre le Vendeur et le Client.",
  },

  { t: "h2", s: "1. Définitions" },
  {
    t: "p",
    s: "Tous les noms communs dont la première lettre est en majuscule dans le présent document ont la définition attribuée au présent article.",
  },
  {
    t: "dl",
    items: [
      ["Accusé de Réception", "désigne le courriel de réponse transmis par le Vendeur au Client à la suite de la validation de la Commande par le Client et contenant le récapitulatif de la Commande, les conditions générales de vente applicables et la Facture correspondante."],
      ["Bon de Commande", "désigne le récapitulatif des Produits sélectionnés par le Client et soumis à validation de ce dernier sur le Site pour finaliser la Commande."],
      ["Bon de Livraison", "désigne le document remis au Client par le Transporteur lors de la livraison de la Commande, contre signature du Client attestant de la délivrance de la Commande ainsi que du parfait état du ou des Produit(s) concernés et de l'absence d'anomalies."],
      ["CGV", "désigne les présentes conditions générales de vente du Vendeur auxquelles le Client doit adhérer pour effectuer sa Commande."],
      ["Client", "désigne tout individu ou société agissant en tant que Consommateur, Non-Professionnel ou Professionnel accédant au Site en vue de la réalisation d'une Commande."],
      ["Commande", "désigne le ou les Produit(s) commandés par le Client pour chaque circonstance d'achat sur le Site."],
      ["Consommateur", "désigne un Client, personne physique, qui agit à des fins qui n'entrent pas dans le cadre de son activité commerciale, industrielle, artisanale, libérale ou agricole."],
      ["Contrat", "désigne l'ensemble des documents contractuels définissant les droits et obligations des Parties pour toute Vente, visés à l'Article 15."],
      ["Date de Livraison", "désigne la date de livraison effective de la Commande au Client indiquée sur le Bon de Livraison."],
      ["Délai de Livraison", "désigne le délai maximum visé à l'Article 8.2 auquel le Vendeur s'engage à livrer la Commande au Client."],
      ["Délai de Rétractation", "désigne le délai visé à l'Article 9."],
      ["Facture", "désigne la facture envoyée au Client par le biais de l'Accusé de Réception."],
      ["Force Majeure", "désigne le cas où un événement échappant au contrôle du débiteur, qui ne pouvait être raisonnablement prévu lors de la conclusion du Contrat et dont les effets ne peuvent être évités par des mesures appropriées, empêche l'exécution de son obligation par le débiteur."],
      ["Fournisseur", "désigne un tiers au Contrat en possession du ou des Produits de la Commande du Client."],
      ["Livraison", "désigne le transfert au Client de la possession physique ou du contrôle du ou des Produit(s)."],
      ["Non-Professionnel", "désigne un Client, personne morale, qui n'agit pas à des fins professionnelles (cf. la définition de Professionnel ci-dessous)."],
      ["Offre de Produit", "désigne l'offre publiée sous la responsabilité du Vendeur sur l'un de ses supports, et notamment son Site, dédiée à la vente d'un Produit en particulier et incluant notamment la photographie ainsi que les caractéristiques et le prix du Produit."],
      ["Partie(s)", "désigne, au singulier, le Client ou le Vendeur pris individuellement et, au pluriel, le Client et le Vendeur pris collectivement."],
      ["Prix", "désigne le prix total visé à l'Article 5 que le Client s'engage à payer au titre de la Commande."],
      ["Produit(s)", "désigne les produits pneumatiques ou associés (jantes, chaînes, etc.) proposés à la vente par le Vendeur sur le Site."],
      ["Professionnel", "désigne un Client, personne physique ou morale, publique ou privée, qui agit à des fins entrant dans le cadre de son activité commerciale, industrielle, artisanale, libérale ou agricole, y compris lorsqu'il agit au nom ou pour le compte d'un autre professionnel."],
      ["Site", "désigne le site internet du Vendeur accessible à l'adresse URL tousvospneus.com."],
      ["Titulaire du Droit de Rétractation", "désigne la personne visée à l'Article 9."],
      ["Transporteur", "désigne la société de transport choisie par le Fournisseur ou le Vendeur pour l'acheminement et la Livraison de la Commande à l'adresse déclarée par le Client."],
      ["Vendeur", "désigne la personne visée en Préambule."],
      ["Vente", "désigne l'opération juridique conclue entre le Vendeur et le Client par laquelle le premier s'oblige à livrer la Commande et le second à payer le Prix."],
    ],
  },

  { t: "h2", s: "2. Objet et acceptation" },
  { t: "p", s: "Les CGV ont vocation à régir, sans restriction, l'ensemble des Ventes conclues par l'intermédiaire du Site du Vendeur et à définir les rapports contractuels entre le Vendeur et le Client relativement à chaque Commande." },
  { t: "p", s: "Les CGV prévalent et se substituent à tous autres éventuels accords, engagements, déclarations, promesses, intentions, documentations ou informations intervenus antérieurement entre les Parties relativement à la Commande." },
  { t: "p", s: "La validation de toute Commande par un Client est strictement subordonnée à l'acceptation préalable, sans restriction ni réserve, de l'intégralité des termes et conditions des CGV concomitamment en vigueur sur le Site, laquelle acceptation se manifeste par le fait de cocher d'un clic de souris la case située à gauche de la mention « J'ai lu et j'accepte les conditions générales de vente ainsi que la charte de confidentialité. ». Cette étape intervient après que le Client a eu la possibilité de vérifier le détail de sa Commande et son Prix total et de corriger d'éventuelles erreurs avant de confirmer celle-ci pour exprimer son acceptation définitive." },
  { t: "p", s: "Les CGV sont accessibles sur le Site et sont transmises au Client sur un support durable en pièce jointe de l'Accusé de Réception." },
  { t: "p", s: "Le Contrat est réputé conclu entre les Parties à compter de l'émission de l'Accusé de Réception par le Vendeur." },
  { t: "p", s: "Le Vendeur assure la conservation de l'écrit qui constate le Contrat à partir de la conclusion du Contrat et pendant une durée de dix ans à compter de la Livraison de la Commande. Le Client peut accéder au Contrat archivé sur simple demande adressée au Vendeur." },
  { t: "p", s: "Le Client est informé que la conclusion du Contrat emporte à son égard la souscription de l'obligation de paiement du Prix au bénéfice du Vendeur." },

  { t: "h2", s: "3. Produits" },
  { t: "h3", s: "3.1 Caractéristiques des Produits" },
  { t: "p", s: "Les caractéristiques essentielles et le prix des Produits sont indiqués dans chaque Offre de Produit publiée sur le Site. Ces éléments constituent des informations contractuelles qui engagent le Vendeur en cas de conclusion du Contrat avec le Client et sous réserve de la disponibilité en stock des Produits concernés." },
  { t: "p", s: "Chaque pneu est revêtu sur le flanc du numéro DOT composé de la manière suivante — exemple : DOT B9 4W HWNX 3903." },
  {
    t: "ul",
    items: [
      "DOT : Department Of Transportation ;",
      "B9 : code de l'usine où le pneu a été fabriqué ;",
      "4W : code dimensionnel propre au manufacturier ;",
      "HWNX : code optionnel propre au fabricant ;",
      "3903 : date de fabrication du pneu, correspondant à la 39e semaine de l'année 2003.",
    ],
  },
  { t: "h3", s: "3.2 Disponibilité des Produits" },
  { t: "p", s: "L'indication de la disponibilité d'un Produit dans l'Offre de Produit correspondante par la mention « en stock » est une information purement indicative eu égard aux flux et volumes de transaction quotidiens." },
  { t: "p", s: "En cas de rupture de stock, le Vendeur en informera le Client et remboursera intégralement ce dernier par le même moyen utilisé lors de la Commande dans un délai de soixante-douze (72) heures à compter de son information sur l'indisponibilité du Produit. En cas d'indisponibilité partielle de la Commande, le Client sera remboursé au prorata du ou des Produits manquants." },

  { t: "h2", s: "4. Commande" },
  { t: "h3", s: "4.1 Accès au Site" },
  { t: "p", s: "Le Site public est mis à disposition de tout visiteur, toute l'année, 7 jours sur 7, 24 heures sur 24, sous réserve des interruptions nécessaires aux opérations techniques de maintenance, d'entretien et de mise à jour que le Vendeur jugera opportun de réaliser et de toute panne technique indépendante de la volonté du Vendeur." },
  { t: "p", s: "Tous les frais engagés par le Client pour assurer son propre accès au Site demeurent à son entière charge, et notamment le coût de son matériel informatique, de son abonnement internet et de tout logiciel." },
  { t: "h3", s: "4.2 Sélection du ou des Produits" },
  { t: "p", s: "Le Client reconnaît et accepte que la recherche et la sélection du ou des Produits par le Client se fait sous son entière et seule responsabilité." },
  { t: "p", s: "Pour faciliter les recherches du Client, le Vendeur met à disposition du Client sur son Site (i) une barre de recherche dans laquelle le Client peut saisir librement des mots-clés et (ii) un outil de recherche fondé sur diverses caractéristiques des Produits visées par liste de choix. Le bon fonctionnement, l'intérêt, l'exhaustivité et la pertinence de ces outils ne sont pas garantis par le Vendeur." },
  { t: "p", s: "Il appartient au Client de prendre connaissance de l'intégralité des Offres de Produit proposées par le Vendeur sur son Site et de réaliser les recherches nécessaires sur le modèle sélectionné et sur la concurrence pour évaluer la pertinence, l'intérêt et l'adéquation de l'Offre de Produit à ses besoins." },
  { t: "p", s: "Le Vendeur fournit à titre informatif :" },
  {
    t: "ul",
    items: [
      "les données BMF sur le lien entre véhicule, pneus et jantes ;",
      "les données constructeurs sur le lien entre véhicules et chaînes ;",
      "les données sur la compatibilité entre les véhicules et produits.",
    ],
  },
  { t: "p", s: "Le Vendeur ne garantit en aucun cas la pertinence, l'exactitude ni l'exhaustivité de ces données, qui ne sont fournies qu'à titre purement indicatif pour faciliter la recherche de produit. Il appartient au Client de vérifier que les Produits sélectionnés s'adaptent et correspondent à son véhicule." },
  { t: "p", s: "Le Client est spécifiquement invité à consulter les avis ainsi que les pneus similaires proposés sous l'Offre de Produit en vue d'évaluer si le Produit visualisé est susceptible de satisfaire ses besoins." },
  { t: "p", s: "La sélection d'un Produit s'exécute en cliquant sur la fonction « Ajouter au panier » après avoir sélectionné la quantité requise. Cette opération a uniquement pour effet d'inclure le Produit sélectionné dans le panier du Client et n'engendre aucune obligation d'achat à ce stade." },
  { t: "p", s: "Une fois que le Client considère que la sélection de ses achats est terminée, il lui suffit de se rendre dans la rubrique « Panier » pour vérifier la bonne sélection des Produits et des quantités et prendre connaissance du Prix total associé à sa Commande. Avant la validation définitive de la Commande, le Client peut modifier son panier à tout moment et a la possibilité de vérifier le détail de sa Commande et son Prix total et de corriger d'éventuelles erreurs avant de confirmer celle-ci pour exprimer son acceptation définitive." },
  { t: "h3", s: "4.3 Création et utilisation du compte client" },
  { t: "p", s: "Pour finaliser sa Commande, le Client doit créer son compte personnel (si cela n'a pas déjà été réalisé lors d'une précédente Commande). À cet effet, le Consommateur et le Non-Professionnel doivent fournir une adresse de courrier électronique valide et configurer un mot de passe ainsi que déclarer leur identité, leur numéro de téléphone et leur adresse postale et e-mail. Le Professionnel crée pour sa part un « compte professionnel » en fournissant une adresse de courrier électronique valide et en configurant un mot de passe ainsi qu'en déclarant son nom, son prénom, le nom de la société, un numéro de téléphone et l'adresse." },
  { t: "p", s: "Le Client est invité à compléter toutes les informations utiles dans son compte personnel, sachant que les champs présentant un astérisque (*) sont obligatoires. L'ensemble des informations personnelles des Clients sont collectées et traitées pour les finalités et dans les conditions précisées à l'Article 14 ci-dessous et à la Charte de Confidentialité." },
  { t: "p", s: "Le Client s'engage à fournir des informations véritables et sincères et à informer le Vendeur de tout changement les concernant. Un récapitulatif des informations fournies est accessible sur le Site. Le défaut de fourniture des informations sollicitées équivaut à renoncer à la création d'un compte et empêche la validation de la Commande par le Client." },
  { t: "p", s: "L'identifiant et le mot de passe sont strictement personnels et confidentiels : le Client s'interdit de les divulguer à un tiers ou de les céder. Toute Commande passée grâce à cet identifiant et ce mot de passe sera réputée être effectuée par le Client et engagera en conséquence ce dernier à l'égard du Vendeur, sauf si cette Commande a été passée par un tiers en raison d'une faille de sécurité du site du Vendeur. Il appartient au Client d'informer immédiatement par écrit le Vendeur de toute utilisation de son identifiant et de son mot de passe faite à son insu et dont il aurait connaissance." },
  { t: "p", s: "Le Client peut corriger, à tout moment, les erreurs de saisie des informations demandées. Le Vendeur ne saurait être tenu pour responsable d'éventuelles erreurs de saisie et des conséquences qui en découleraient, tel qu'un retard et/ou une erreur de livraison. Dans ce contexte, tous les frais engagés pour la réexpédition de la Commande seront entièrement à la charge du Client." },
  { t: "p", s: "Le compte personnel permet au Client d'accéder aux informations suivantes :" },
  {
    t: "ul",
    items: [
      "Vos Commandes – SAV : la liste des Commandes passées sur le Site ;",
      "Modifier vos informations : les informations personnelles déclarées par le Client, avec la possibilité de les modifier à tout moment.",
    ],
  },
  { t: "p", s: "Le Vendeur se réserve le droit de désactiver, sans délai ni indemnité, le compte de tout Client en cas de violation des présentes conditions générales et d'utilisation frauduleuse ou illicite du compte par le Client ou tout tiers." },
  { t: "p", s: "Le Client peut désactiver son compte en informant le Vendeur de sa décision par courrier électronique. Le Vendeur désactivera le compte dans un délai maximum de soixante-douze (72) heures à compter de la réception de ce courriel." },
  { t: "h3", s: "4.4 Validation de la Commande" },
  { t: "p", s: "Après avoir validé son panier, créé son compte, saisi l'adresse de livraison et sélectionné son moyen de paiement, le Client est invité à valider définitivement sa Commande en effectuant son règlement par la fonction « Procéder au paiement sécurisé ». L'effectivité de cette opération est subordonnée à l'acceptation préalable des présentes conditions générales de vente (cf. supra)." },
  { t: "p", s: "La validation définitive de la Commande a pour effet d'emporter à l'égard du Client la souscription de l'obligation du paiement du Prix au bénéfice du Vendeur." },
  { t: "p", s: "Après réception du paiement par le Vendeur, le Client reçoit un courrier électronique du Vendeur récapitulant sa Commande." },
  { t: "h3", s: "4.5 Annulation de la Commande (clause résolutoire)" },
  { t: "p", s: "Le présent Article constitue une clause résolutoire qui précise les engagements dont l'inexécution entraînera la résolution de la Vente." },
  { t: "h4", s: "4.5.1 Annulation de la Commande par le Client" },
  {
    t: "ul",
    items: [
      "Convenance : après la validation définitive de sa Commande, le Client a la possibilité de solliciter son annulation, sous réserve que les Produits de la Commande ne soient pas encore en préparation, en contactant par e-mail le service après-vente de tousvospneus.com ;",
      "Retard ou refus de livraison : en cas de retard ou de refus de livraison du Vendeur et selon les conditions et modalités rappelées à l'Article 8.2 ;",
      "Rétractation : en cas d'exercice du droit de rétractation dans les conditions de l'Article 9 ;",
      "Défaut de conformité : dans les cas de défaut de conformité visés à l'Article 10.2 ;",
      "Vice caché : en cas de vice caché au sens de l'Article 10.2 ;",
      "Force Majeure : en cas d'empêchement définitif du Vendeur d'exécuter ses obligations en raison de la Force Majeure en application de l'Article 13.",
    ],
  },
  { t: "h4", s: "4.5.2 Annulation de la Commande par le Vendeur" },
  { t: "p", s: "Le Vendeur pourra annuler la Commande, c'est-à-dire résoudre la Vente, dans les cas suivants :" },
  {
    t: "ul",
    items: [
      "Retard ou défaut de paiement : en cas de manquement du Client à son obligation de paiement dans les conditions de l'Article 6 ;",
      "Indisponibilité des Produits : dans le cas d'une indisponibilité du ou des Produits en stock ;",
      "Défaillance du Client dans la réception des Produits à l'adresse déclarée : au sens et dans les conditions de l'Article 8.5 ;",
      "Force Majeure : en cas d'empêchement définitif du Client d'exécuter ses obligations en raison de la Force Majeure en application de l'Article 13.",
    ],
  },
  { t: "h4", s: "4.5.3 Mise en demeure préalable" },
  { t: "p", s: "La résolution de la Vente doit être précédée, sauf urgence, d'une mise en demeure de la Partie défaillante de satisfaire à son engagement dans un délai raisonnable, à l'exception des cas suivants : annulation pour convenance (Article 4.5.1(i)) ; cas spécifiques du refus de livraison et du non-respect d'un délai de livraison institué en condition essentielle conformément à l'Article 8.2 ; exercice du droit de rétractation (Article 4.5.1(iii)) ; indisponibilité des Produits (Article 4.5.2(ii)) ; et défaillance du Client dans la réception des Produits à l'adresse déclarée (Article 4.5.2(iii))." },
  { t: "p", s: "Cette mise en demeure fait référence au présent Article 4.5 et mentionne expressément le motif de résolution et qu'à défaut pour la Partie défaillante de satisfaire à son obligation, l'autre Partie sera en droit de résoudre la Vente. Le Client est invité à consulter les éventuelles modalités supplémentaires de mise en demeure stipulées dans les présentes CGV pour chacun des cas d'annulation de la Commande visés ci-dessus." },
  { t: "h4", s: "4.5.4 Formalisme de la résolution" },
  { t: "p", s: "La Partie souhaitant résoudre la Vente pourra le faire par notification visant le cas de résolution invoqué, ou par demande en justice. Dans le cas de l'exercice du droit de rétractation, la notification susvisée est effectuée par le formulaire de rétractation ou toute autre déclaration dénuée d'ambiguïté dans les conditions de l'Article 9. Dans le cas de l'annulation pour convenance, la notification est effectuée par le Client via son compte en sélectionnant la Commande concernée et en ouvrant une réclamation par le biais du support via ticket." },
  { t: "h4", s: "4.5.5 Moment de la résolution" },
  { t: "p", s: "La résolution de la Vente prendra effet à partir de la réception par l'autre Partie de la notification susvisée (en dehors du cas où le Vendeur s'est exécuté entre-temps dans le cas de l'Article 4.5.1(ii)), ou de la date décidée par le juge saisi en cas de résolution judiciaire." },
  { t: "h4", s: "4.5.6 Effets de la résolution" },
  { t: "p", s: "Les éventuelles restitutions ont lieu dans les conditions prévues aux articles 1352 à 1352-9 du Code civil français et/ou, le cas échéant :" },
  {
    t: "ul",
    items: [
      "en cas de résolution pour convenance (Article 4.5.1(i)) : remboursement de la Commande dans un délai de dix (10) jours ouvrés maximum à compter du courrier électronique de confirmation du Vendeur, par le même moyen de paiement que celui utilisé par le Client lors de la Commande ;",
      "en cas de résolution pour retard ou refus de livraison (Article 4.5.1(ii)) : remboursement de la Commande dans les conditions de l'Article 8.2 ;",
      "en cas de résolution à la suite d'une rétractation (Article 4.5.1(iii)) : remboursement de la Commande dans les conditions de l'Article 9 ;",
      "en cas de résolution pour défaut de conformité (Article 4.5.1(iv)) : le Vendeur rembourse au Client Consommateur ou Non-Professionnel le prix payé et les frais de retour du ou des Produits dès réception du ou des Produits ou de la preuve de leur renvoi par le Client, et au plus tard dans les quatorze (14) jours suivants, en recourant au même moyen de paiement que celui utilisé lors de la conclusion de la Commande, sauf accord exprès de ce dernier et sans frais supplémentaire ;",
      "en cas de résolution pour indisponibilité en stock (Article 4.5.2(ii)) : remboursement de la Commande dans un délai de trois (3) jours ouvrés maximum à compter du courrier électronique de résolution du Vendeur, par le même moyen de paiement ;",
      "en cas de défaillance du Client dans la réception des Produits à l'adresse déclarée (Article 4.5.2(iii)) : remboursement de la Commande dans un délai de trois (3) jours ouvrés maximum à compter du courrier électronique de résolution du Vendeur, par le même moyen de paiement et sous déduction des frais de retour et des éventuels frais de tentative de relivraison visés à l'Article 8.5.",
    ],
  },
  { t: "p", s: "La résolution de la Vente n'affectera pas les Articles 21 et 22, qui demeureront en vigueur entre les Parties." },

  { t: "h2", s: "5. Prix" },
  { t: "p", s: "Chaque Offre de Produit est accompagnée du prix unitaire libellé en euros et entendu toutes taxes comprises (TTC)." },
  { t: "p", s: "Conformément à l'Article 19 ci-dessous, toutes les Commandes sont soumises aux lois françaises, lesquelles Commandes sont réputées être réalisées sur ce territoire dans lequel le Vendeur est établi. En conséquence, les prix des Offres de Produit ne comprennent pas les éventuelles contributions environnementales applicables en dehors de la France métropolitaine." },
  { t: "p", s: "Le Vendeur se réserve le droit de modifier ses prix à tout moment. Le Client est averti que les prix des Offres de Produit sont susceptibles de varier plusieurs fois par jour. Les prix appliqués à une Commande sont ceux affichés sur le Site concomitamment à la validation définitive de la Commande au sens de l'Article 4.4." },
  { t: "p", s: "Dans le cadre de certaines Offres de Produit, le Vendeur met à la disposition du Client un outil de comparaison du prix avec ceux de certains de ses concurrents." },
  { t: "p", s: "Le Prix total d'une Commande est composé de la somme totale des prix des quantités de produits et services sélectionnés par le Client et des éventuels frais de port (sauf offre des frais de port sous conditions)." },

  { t: "h2", s: "6. Conditions financières" },
  { t: "p", s: "Le paiement est exigible immédiatement à la Commande, laquelle sera traitée par le Vendeur uniquement à réception du complet paiement du Client." },
  { t: "p", s: "En l'absence de réception du paiement du Prix dans les trois (3) jours suivant la validation de la Commande, le Client reçoit une notification du Vendeur le mettant en demeure de régler le Prix dans un délai supplémentaire de quatre (4) jours. À défaut, le Vendeur pourra annuler la Commande et donc résoudre la Vente." },
  { t: "p", s: "Le Client peut régler sa Commande par carte bancaire ou par PayPal." },
  { t: "p", s: "Le Client assume les conséquences de toute erreur de saisie lors de la procédure de paiement et de toute anomalie ou dysfonctionnement des moyens de paiement." },
  { t: "p", s: "Le Vendeur pourra exiger de tout Client Professionnel des pénalités de retard exigibles le jour suivant la date d'échéance. Le taux des intérêts de retard sera égal au taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage. Le taux applicable pendant le premier semestre de l'année concernée est le taux en vigueur au 1er janvier de l'année en question ; pour le second semestre, il est le taux en vigueur le 1er juillet. Les pénalités de retard sont exigibles sans qu'un rappel soit nécessaire." },
  { t: "p", s: "En outre, tout Client Professionnel en situation de retard de paiement sera de plein droit débiteur, à l'égard du Vendeur, d'une indemnité forfaitaire pour frais de recouvrement d'un montant de quarante euros (40,00 €). Lorsque les frais de recouvrement exposés sont supérieurs au montant de cette indemnité forfaitaire, le Vendeur pourra demander une indemnisation complémentaire, sur justification." },
  { t: "p", s: "En cas de prélèvement échoué, pour tout Client Professionnel, le Client donne son accord pour régulariser les factures impayées automatiquement sur la carte bancaire de sa société. Après chaque règlement, quel qu'en soit le moyen, le Client reçoit un courrier électronique de confirmation." },
  { t: "h3", s: "6.1 Paiement par carte bancaire" },
  { t: "p", s: "Le Vendeur accepte uniquement le paiement par cartes bancaires Visa, Mastercard ou Maestro. Le paiement sécurisé en ligne par carte bancaire est réalisé par un prestataire de paiement." },
  { t: "p", s: "L'ensemble des phases de paiement par cartes bancaires sont soumises au système de paiement SOGECOMMERCE, lequel est entièrement crypté et protégé. Le protocole utilisé est SSL couplé à de la monétique bancaire (protocole 3D Secure). Cela signifie que les informations liées à la commande et le numéro de la carte bancaire ne circulent pas en clair sur Internet. Le numéro de carte bancaire n'est imprimé sur aucun papier, facture, facturette ou autre listing." },
  { t: "p", s: "Le Vendeur n'a pas connaissance des numéros de cartes. SOGECOMMERCE ne conserve pas les numéros de carte après avoir transmis la transaction de paiement à la banque du commerçant. Ainsi, aucune personne n'a accès, ni de façon informatique ni de façon imprimée, aux coordonnées des cartes bancaires des acheteurs." },
  { t: "p", s: "Lors de paiements par carte bancaire, la transaction est immédiatement débitée dès le paiement effectué par le Client. L'engagement de payer donné par carte est irrévocable. En communiquant ses informations bancaires lors de la Vente, le Client autorise le Vendeur à débiter sa carte du montant correspondant au prix indiqué. Le Client confirme qu'il est bien le titulaire légal de la carte à débiter et qu'il est légalement en droit d'en faire usage. En cas d'erreur ou d'impossibilité de débiter la carte, la Commande est susceptible d'être annulée dans les conditions susvisées." },
  { t: "h3", s: "6.2 Paiement par PayPal" },
  { t: "p", s: "Le Client qui recourt à un paiement via PayPal (www.paypal.com) doit disposer ou créer un compte auprès de ce prestataire. Les transactions effectuées via PayPal sont sécurisées par le protocole 3D-Secure. Le Vendeur n'accède à aucun moment aux coordonnées bancaires du Client." },

  { t: "h2", s: "7. Propriété et transfert des risques" },
  { t: "p", s: "Les Produits deviennent la propriété du Client dès la validation de la Commande. En conséquence, le Client est seul responsable de l'importation et de l'introduction des Produits dans le pays de destination qu'il a choisi pour l'expédition. Le Client est invité à consulter les éventuelles obligations qui lui incombent en raison de l'importation des Produits dans ledit pays de destination." },
  { t: "p", s: "Tout risque de perte ou d'endommagement des Produits est transféré au Client Professionnel à compter du transfert de propriété." },
  { t: "p", s: "Tout risque de perte ou d'endommagement des Produits est transféré au Client Consommateur au moment où ce dernier, ou un tiers désigné par lui et autre que le transporteur proposé par le Vendeur, prend physiquement possession des Produits. Lorsque le Consommateur ou le Non-Professionnel confie la Livraison des Produits à un transporteur autre que celui proposé par le Vendeur, le risque de perte ou d'endommagement du bien sera transféré au Consommateur ou au Non-Professionnel lors de la remise du bien au transporteur." },

  { t: "h2", s: "8. Livraison" },
  { t: "p", s: "La livraison de la Commande se fait au choix du Client, exprimé lors de la Commande, par la délivrance de la Commande à une adresse fournie par le Client ou chez l'un des garages partenaires (sélection du choix lors de la commande)." },
  { t: "h3", s: "8.1 Frais de livraison" },
  { t: "p", s: "Concernant les pièces auto et tous les autres articles, les frais de port sont indiqués dans le panier. Concernant les pneus, les frais de livraison sont offerts au Client pour tout achat de deux (2) produits identiques. En cas d'achat à l'unité (pneu auto, jante), les frais de livraison sont à la charge du Client, sauf pour les pneus moto où les frais de port sont offerts dès le premier pneu acheté." },
  { t: "h3", s: "8.2 Délai de livraison" },
  { t: "p", s: "Le Vendeur s'engage à livrer la Commande dans un délai maximum de trente (30) jours ouvrés à compter de la validation de la Commande (« Délai de Livraison »). Le Client reconnaît et accepte sans réserve qu'aucun autre délai mentionné sur le Site ne constitue un engagement ferme du Vendeur à l'égard du Client." },
  { t: "p", s: "Le Client est informé à titre purement indicatif que la livraison a lieu en moyenne entre deux (2) et huit (8) jours ouvrés à compter de la réception du complet paiement du Prix de la Commande. En cas de sélection de plusieurs Produits au sein d'une même Commande, ceux-ci peuvent éventuellement ne pas être livrés le même jour sans que cela ne puisse donner lieu à une quelconque réclamation de la part du Client." },
  { t: "p", s: "Le Délai de Livraison susvisé est interrompu dans les cas suivants : retard de paiement ; erreur d'adresse déclarée par le Client ; absence du Client ou de son représentant habilité pour réceptionner la Commande. Dans les deux premiers cas, le Délai de Livraison recommencera à courir à compter de la régularisation de l'incident pour une nouvelle durée de trente (30) jours. Dans le dernier cas, le Client et le Vendeur (ou le transporteur le cas échéant) conviendront d'une nouvelle date de livraison." },
  { t: "p", s: "En cas de manquement du Vendeur à son obligation de délivrance de la Commande dans le Délai de Livraison, le Consommateur ou le Non-Professionnel peut notifier au Vendeur la suspension du paiement de tout ou partie du Prix jusqu'à ce que le Vendeur s'exécute, ou résoudre la Vente si, après avoir mis en demeure le Vendeur d'effectuer la délivrance dans un délai supplémentaire raisonnable, ce dernier ne s'est pas exécuté dans ce délai." },
  { t: "p", s: "Le Consommateur ou le Non-Professionnel peut toutefois immédiatement résoudre la Vente lorsque le Vendeur refuse de délivrer la Commande ou lorsqu'il est manifeste qu'il ne la livrera pas, ou lorsque le Vendeur n'exécute pas son obligation de délivrance à la date ou à l'expiration du Délai de Livraison et que ce délai constitue pour le Consommateur ou le Non-Professionnel une condition essentielle du contrat." },
  { t: "p", s: "Lorsque la Vente est résolue dans les conditions du présent Article, le Vendeur rembourse le Consommateur ou le Non-Professionnel de la totalité des sommes versées, au plus tard dans les quatorze (14) jours suivant la date à laquelle la Vente a été dénoncée. Ces droits sont sans préjudice de l'allocation de dommages et intérêts." },
  { t: "h3", s: "8.3 Difficultés sur les Produits livrés" },
  { t: "p", s: "Le Client, son préposé ou son représentant doivent vérifier la conformité de l'état des Produits lors de la livraison et notifier au Transporteur toutes les réserves sur les Produits. Ces réserves doivent être mentionnées de manière explicite et précise sur le Bon de Livraison." },
  { t: "p", s: "Si les Produits objets de la Commande ne sont pas conformes ou si le colis réceptionné est en mauvais état, le Client peut refuser la Livraison. Il doit ensuite en informer sans délai le Vendeur en contactant le service client via le système de tickets. En cas de défaut de conformité, les stipulations de l'Article 10.3 ci-après sont applicables." },
  { t: "p", s: "En cas de colis abîmé et refusé, un litige sera ouvert auprès du Transporteur. Une attestation de colis endommagé, datée et signée, sera demandée au Client pour pouvoir ouvrir le litige. Le délai pour la résolution des litiges auprès du Transporteur est de dix (10) jours ouvrés minimum et peut durer jusqu'à quatre (4) semaines à compter de son ouverture. Ces délais sont donnés à titre indicatif." },
  { t: "h3", s: "8.4 Bon de livraison" },
  { t: "p", s: "Le Transporteur remet au Client un Bon de Livraison contre signature, lequel indique explicitement la possibilité de formuler des réserves, notamment en cas de défauts apparents du ou des Produits ou de défaut de remise de la notice d'emploi. Le Client reconnaît et accepte que la signature d'un tel Bon de Livraison constitue la preuve irréfragable de la Date de Livraison de l'intégralité de la Commande ou, en cas de livraison séparée, des Produits concernés. L'attention du Client est attirée sur le fait que la réception sans réserve sur le Bon de Livraison couvre les éventuels défauts apparents de conformité." },
  { t: "h3", s: "8.5 Difficultés lors de la livraison" },
  { t: "p", s: "Le Vendeur s'engage à livrer la Commande à l'adresse de livraison qui a été fournie par le Client lors de la Commande. Le Client s'engage à fournir une adresse de livraison existante, complète et exacte d'un lieu où la livraison est réalisable et autorisée." },
  { t: "p", s: "En cas d'erreur dans l'adresse de livraison fournie par le Client, toute modification de celle-ci entraînera des frais de réexpédition de quinze (15) euros, à la charge du Client et facturés par le Vendeur." },
  { t: "p", s: "Le Client garantit au Vendeur sa présence sur les lieux, ou celle d'un préposé ou d'un représentant dûment habilité, pour réceptionner la Commande. À défaut, le Vendeur ne pourra être tenu responsable de tout retard de livraison. Si le Client est absent lors de la livraison, il devra prendre contact avec le Transporteur pour convenir d'une nouvelle date de livraison ou d'un retrait dans le dépôt le plus proche. La deuxième tentative de livraison fera l'objet d'une facturation de frais de tentative de relivraison à hauteur de quinze (15) euros au bénéfice du Vendeur." },
  { t: "p", s: "À défaut pour le Client d'avoir contacté le Transporteur dans le délai fixé par ce dernier, les colis seront expédiés de retour vers les entrepôts du Vendeur, lequel notifiera l'annulation de la Commande et la résolution de la Vente à réception du colis de retour. Les frais de retour de quarante (40) euros par colis seront à la charge exclusive du Client. Les frais de retour ainsi que les éventuels frais de relivraison seront déduits lors du remboursement de la Commande." },
  { t: "h3", s: "8.6 Produits consignés" },
  { t: "p", s: "Certains Produits peuvent être consignés. Ils font l'objet d'une mention spécifique « Pièce consignée sous échange standard » dans leur fiche technique. Le prix des Produits consignés inclut le montant de la pièce et d'une consigne, c'est-à-dire le montant demandé par le fabricant afin de s'assurer du retour des anciennes pièces de rechange pour leur reconditionnement et leur recyclage." },
  { t: "p", s: "À réception du nouveau Produit, le Client doit renvoyer le Produit usagé au Vendeur, à l'adresse transmise par ce dernier pour les retours de Produits consignés, dans un délai maximum de trente (30) jours à compter de la réception du nouveau Produit. À défaut, le Client ne pourra obtenir aucun remboursement de la consigne. Le Produit retourné devra être équivalent, complet et placé dans l'emballage du nouveau Produit ; les frais de réexpédition sont à la charge du Client. À réception du Produit usagé conforme, le Vendeur rembourse le Client du montant de la consigne dans un délai maximum de quinze (15) jours, en utilisant le même moyen de paiement que celui utilisé pour l'achat du nouveau Produit." },

  { t: "h2", s: "9. Droit de rétractation" },
  { t: "h3", s: "9.1 Bénéficiaire du droit de rétractation" },
  { t: "p", s: "Est titulaire du droit de rétractation (le « Titulaire du Droit de Rétractation ») :" },
  {
    t: "ul",
    items: [
      "le Client Consommateur lorsque le Contrat est conclu à distance, à la suite d'un démarchage téléphonique ou hors établissement ;",
      "le Client Professionnel lorsque le Contrat est conclu hors établissement, dès lors que l'objet du Contrat n'entre pas dans le champ de l'activité principale du Client Professionnel sollicité et que le nombre de salariés employés par celui-ci est inférieur ou égal à cinq.",
    ],
  },
  { t: "h3", s: "9.2 Délai de rétractation" },
  { t: "p", s: "Le Titulaire du Droit de Rétractation dispose d'un délai de quatorze (14) jours (le « Délai de Rétractation ») pour exercer son droit de rétractation sans avoir à motiver sa décision, ni à supporter d'autres coûts que ceux rappelés au présent article." },
  { t: "p", s: "Le Délai de Rétractation court à compter de la réception du ou des Produit(s) par le Titulaire du Droit de Rétractation ou un tiers, autre que le transporteur, désigné par lui. Si le Contrat est conclu hors établissement, le Titulaire du Droit de Rétractation peut exercer son droit de rétractation à compter de la conclusion du Contrat. Dans le cas d'une Vente sur plusieurs Produits livrés séparément, le Délai court à compter de la réception du dernier Produit." },
  { t: "p", s: "Le jour où le Contrat est conclu ou le jour de la réception du Produit n'est pas compté dans le Délai de Rétractation. Si le Délai de Rétractation expire un samedi, un dimanche ou un jour férié ou chômé, il est prorogé jusqu'au premier jour ouvrable suivant." },
  { t: "h3", s: "9.3 Exercice du droit de rétractation" },
  { t: "p", s: "Pour exercer son droit de rétractation, le Titulaire du Droit de Rétractation informe le Vendeur de sa décision de se rétracter par l'envoi, avant l'expiration du Délai de Rétractation, du formulaire dûment rempli, ou de toute autre déclaration exprimant sa volonté dénuée d'ambiguïté de se rétracter, envoyée par courriel. La charge de la preuve de l'exercice du droit de rétractation pèse sur le Titulaire du Droit de Rétractation." },
  { t: "h3", s: "9.4 Restitution du ou des Produit(s)" },
  { t: "p", s: "Le Titulaire du Droit de Rétractation renvoie ou restitue le ou les Produit(s) au Vendeur ou à une personne désignée par ce dernier, sans retard excessif et au plus tard dans les quatorze (14) jours suivant la communication de sa décision de se rétracter, à moins que le Vendeur ne propose de récupérer lui-même le ou les Produit(s)." },
  { t: "p", s: "Le Titulaire du Droit de Rétractation ne supporte que les coûts directs de renvoi du ou des Produit(s). Il peut soit organiser lui-même le renvoi en prenant directement à sa charge les frais associés, soit solliciter du Vendeur, sous réserve d'acceptation de ce dernier, la prise en charge de ce renvoi, qui sera refacturé à hauteur d'une somme estimée de cent (100) euros par article (sous réserve de confirmation par le transporteur)." },
  { t: "p", s: "La responsabilité du Titulaire du Droit de Rétractation ne peut être engagée qu'en cas de dépréciation du ou des Produit(s) résultant de manipulations autres que celles nécessaires pour établir la nature, les caractéristiques et le bon fonctionnement du ou des Produit(s). Le Titulaire du Droit de Rétractation peut en faire la demande à la condition que les pièces reçues faisant l'objet du droit de rétractation soient dans un état jugé neuf, à l'instar du moment où les pièces ont été livrées chez le client, et donc jamais montées." },
  { t: "h3", s: "9.5 Remboursement" },
  { t: "p", s: "Lorsque le droit de rétractation est exercé, le Vendeur rembourse le Titulaire du Droit de Rétractation de la totalité des sommes versées, y compris les frais de livraison, sans retard injustifié et au plus tard dans les quatorze (14) jours à compter de la date à laquelle il est informé de la décision de se rétracter." },
  { t: "p", s: "Lorsque le Vendeur ne propose pas de récupérer lui-même le ou les Produit(s), le Vendeur pourra différer le remboursement jusqu'à récupération du ou des Produit(s) ou jusqu'à ce que le Titulaire du Droit de Rétractation ait fourni une preuve d'expédition, la date retenue étant celle du premier de ces faits. Le Vendeur effectue ce remboursement en utilisant le même moyen de paiement que celui utilisé pour la transaction initiale, sauf accord exprès contraire. Le Vendeur n'est pas tenu de rembourser les frais supplémentaires si le Titulaire du Droit de Rétractation a expressément choisi un mode de livraison plus coûteux que le mode standard proposé par le Vendeur." },
  { t: "h3", s: "9.6 Conséquences" },
  { t: "p", s: "L'exercice du droit de rétractation met fin à l'obligation des Parties soit d'exécuter le Contrat à distance ou hors établissement, soit de le conclure lorsque le Titulaire du Droit de Rétractation a fait une offre. L'exercice du droit de rétractation d'un Contrat principal met automatiquement fin à tout contrat accessoire, sans frais pour le Titulaire du Droit de Rétractation autres que ceux prévus au présent article." },

  { t: "h2", s: "10. Garanties" },
  { t: "h3", s: "10.1 Avertissement préalable" },
  { t: "p", s: "Le Client est tenu de s'assurer que les Produits qu'il commande sont conformes aux prescriptions du constructeur de son véhicule. Le Client est également tenu de respecter les prescriptions et recommandations du constructeur pour tout ce qui concerne la sécurité et la fiabilité du véhicule, notamment la taille des pneus et des jantes, le gonflage et la pression des pneus, ainsi que les conditions de montage et de stockage des pneus." },
  { t: "p", s: "Aucune des garanties stipulées au présent article ne prend en compte les défauts dus à une erreur de montage, ni à l'usure normale des Produits, ni les conséquences dues à une utilisation non conforme des Produits, ni la détérioration des Produits par négligence du Client ou de l'un de ses préposés." },
  { t: "h3", s: "10.2 Les garanties légales" },
  { t: "p", s: "TOUSVOSPNEUS.COM est tenue des garanties légales suivantes : la garantie légale de conformité telle qu'elle résulte des articles L. 217-3 à L. 217-20 du Code de la consommation français envers le Consommateur et le Non-Professionnel ; et la garantie des vices cachés des articles 1641 à 1649 du Code civil envers tout Client. La mise en œuvre de ces garanties peut être réalisée en contactant le Vendeur." },
  { t: "p", s: "En application de l'article D. 211-2 du Code de la consommation français, le Vendeur vous fournit les informations suivantes :" },
  {
    t: "note",
    items: [
      "Le consommateur dispose d'un délai de deux ans à compter de la délivrance du bien pour obtenir la mise en œuvre de la garantie légale de conformité en cas d'apparition d'un défaut de conformité. Durant ce délai, le consommateur n'est tenu d'établir que l'existence du défaut de conformité et non la date d'apparition de celui-ci.",
      "La garantie légale de conformité emporte obligation pour le professionnel, le cas échéant, de fournir toutes les mises à jour nécessaires au maintien de la conformité du bien.",
      "La garantie légale de conformité donne au consommateur droit à la réparation ou au remplacement du bien dans un délai de trente jours suivant sa demande, sans frais et sans inconvénient majeur pour lui. Si le bien est réparé dans le cadre de la garantie légale de conformité, le consommateur bénéficie d'une extension de six mois de la garantie initiale. Si le consommateur demande la réparation du bien, mais que le vendeur impose le remplacement, la garantie légale de conformité est renouvelée pour une période de deux ans à compter de la date de remplacement du bien.",
      "Le consommateur peut obtenir une réduction du prix d'achat en conservant le bien ou mettre fin au contrat en se faisant rembourser intégralement contre restitution du bien, si le professionnel refuse de réparer ou de remplacer le bien, si la réparation ou le remplacement intervient après un délai de trente jours, s'il occasionne un inconvénient majeur pour le consommateur, ou si la non-conformité persiste en dépit de la tentative de mise en conformité du vendeur restée infructueuse.",
      "Le consommateur a également droit à une réduction du prix du bien ou à la résolution du contrat lorsque le défaut de conformité est si grave qu'il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n'a pas droit à la résolution de la vente si le défaut de conformité est mineur.",
      "Les droits mentionnés ci-dessus résultent de l'application des articles L. 217-1 à L. 217-32 du Code de la consommation. Le vendeur qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile d'un montant maximal de 300 000 euros, qui peut être porté jusqu'à 10 % du chiffre d'affaires moyen annuel (article L. 241-5 du Code de la consommation).",
      "Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à 1649 du Code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction de prix si le bien est conservé ou à un remboursement intégral contre restitution du bien.",
    ],
  },
  { t: "p", s: "Le Non-Professionnel est informé que les informations fournies dans l'encadré ci-dessus lui sont applicables." },
  { t: "h3", s: "10.3 Garantie commerciale" },
  { t: "p", s: "Le Vendeur propose au Client d'associer à sa Commande, sous certaines conditions, une garantie commerciale appelée « Garantie Pneus Plus » par le biais du contrat de garantie commerciale. Cette garantie commerciale s'applique sans préjudice du droit pour le Consommateur ou le Non-Professionnel de bénéficier de la garantie légale de conformité, dans les conditions des articles L. 217-3 à L. 217-20 du Code de la consommation français, et de celle relative aux vices cachés, dans les conditions prévues aux articles 1641 à 1649 du Code civil français. Dans le cas où le Professionnel souscrit la garantie commerciale, cette dernière s'applique sans préjudice du droit pour le Professionnel de bénéficier de la garantie relative aux vices cachés." },

  { t: "h2", s: "11. Limitation de responsabilité et prescription" },
  { t: "h3", s: "11.1 Principes généraux applicables aux Parties" },
  { t: "p", s: "À moins que l'inexécution d'une des Parties soit définitive, les dommages et intérêts ne sont dus que si la Partie débitrice a préalablement été mise en demeure de s'exécuter dans un délai raisonnable. La Partie débitrice ne sera tenue que des dommages et intérêts qui ont été prévus ou qui pouvaient être prévus lors de la conclusion du Contrat, sauf lorsque l'inexécution est due à une faute lourde ou dolosive. Même dans ce cas, les dommages et intérêts ne comprennent que ce qui est une suite immédiate et directe de l'inexécution." },
  { t: "h3", s: "11.2 Responsabilité du Client" },
  { t: "p", s: "L'action du Vendeur contre le Client Consommateur se prescrit par deux (2) ans à compter du jour où le Vendeur a connu ou aurait dû connaître les faits lui permettant d'exercer l'action concernée. Le délai de prescription de l'action du Vendeur contre le Client Professionnel ou le Client Non-Professionnel est d'un (1) an à compter du jour où le Vendeur a connu ou aurait dû connaître les faits lui permettant de l'exercer." },
  { t: "h3", s: "11.3 Responsabilité du Vendeur" },
  { t: "p", s: "Il est expressément spécifié que la responsabilité du Vendeur à l'égard du Client Professionnel ne pourra excéder le montant de l'ensemble des sommes effectivement payées par le Client Professionnel au titre de la Vente concernée. Le délai de prescription de l'action du Client Professionnel ou du Client Non-Professionnel contre le Vendeur est d'un (1) an à compter du jour où il a connu ou aurait dû connaître les faits lui permettant de l'exercer." },

  { t: "h2", s: "12. Assurance" },
  { t: "p", s: "Le Vendeur est assuré au titre de sa responsabilité professionnelle découlant de son activité et résultant de dommages corporels, matériels et immatériels causés aux tiers avant ou après livraison d'un produit ou l'achèvement d'une prestation de travaux. Cette assurance a été souscrite auprès de la société AXA France — 313 Terrasses de l'Arche, 92727 Nanterre Cedex (France)." },

  { t: "h2", s: "13. Force majeure" },
  { t: "p", s: "En cas de Force Majeure ayant pour effet un empêchement définitif de la Partie débitrice, le Contrat est résolu de plein droit et les Parties sont libérées de leurs obligations. En cas de Force Majeure ayant pour effet un empêchement temporaire, l'exécution de l'obligation est suspendue, à moins que le retard qui en résulterait ne justifie la résolution du Contrat." },

  { t: "h2", s: "14. Données à caractère personnel" },
  { t: "p", s: "Les données à caractère personnel collectées par le Vendeur au sujet du Client dans le cadre de la Vente font l'objet d'un traitement automatisé pour lequel le Vendeur est seul à définir les moyens et la finalité et est, à ce titre, responsable de ce traitement. Le Client est invité à consulter la Charte de Confidentialité et la page Cookies du Site pour connaître les conditions dans lesquelles les données à caractère personnel sont traitées et conservées par le Vendeur." },

  { t: "h2", s: "15. Documents contractuels" },
  { t: "p", s: "Le Contrat est constitué des documents contractuels suivants : les présentes Conditions Générales de Vente ; le Bon de Commande ; le Bon de Livraison ; la Facture de Vente." },
  { t: "p", s: "En cas de contradiction ou de divergence entre les stipulations de deux de ces documents, la stipulation du document supérieur en rang prévaudra (ex. : la Facture de Vente prévaut sur le Bon de Livraison ; le Bon de Livraison prévaut sur le Bon de Commande ; le Bon de Commande prévaut sur les CGV). L'ensemble de ces documents contractuels représente l'intégralité des engagements existant entre les Parties et remplace tout engagement oral ou écrit antérieur relatif à la Vente." },

  { t: "h2", s: "16. Titres" },
  { t: "p", s: "Les titres utilisés dans les CGV sont seulement fournis pour des raisons de commodité et ne devront pas contribuer à affecter le sens ou la structure des stipulations des CGV. En cas de difficulté d'interprétation entre l'un quelconque des titres et l'une quelconque des clauses, les titres seront déclarés inexistants." },

  { t: "h2", s: "17. Validité" },
  { t: "p", s: "Si une ou plusieurs stipulations des CGV venaient à être déclarées nulles, non écrites ou non opposables en application d'une loi, d'un règlement ou à la suite d'une décision définitive d'une juridiction compétente, cette ou ces stipulations devront être considérées comme détachables des CGV. Les autres stipulations seront considérées comme valides et resteront en vigueur, à moins que l'une des Parties ne démontre que la ou les stipulations annulées revêtent un caractère essentiel et déterminant sans lequel elle n'aurait pas contracté." },

  { t: "h2", s: "18. Tolérances" },
  { t: "p", s: "Le fait pour l'une des Parties de ne pas se prévaloir d'un manquement de l'autre Partie à l'une quelconque de ses obligations issues du Contrat ne saurait être interprété comme une renonciation à l'exécution de l'obligation en cause en l'absence de prescription." },

  { t: "h2", s: "19. Réclamation" },
  { t: "p", s: "En cas de réclamation, le Client est invité à contacter le Vendeur en indiquant le numéro de sa Commande. Le Vendeur fera ses meilleurs efforts pour apporter une réponse à toute réclamation dans les plus brefs délais. La possibilité de formuler une réclamation se fait sans préjudice de l'exercice du droit de saisir le médiateur à la consommation dans les conditions de l'Article 20 ou toute juridiction compétente." },

  { t: "h2", s: "20. Médiation" },
  { t: "p", s: "Conformément aux articles L. 611-1 à L. 615-4 du Code de la consommation français, le Client Consommateur a la possibilité, en cas de litige, de recourir à la médiation de la consommation en s'adressant à AME Conso, 11 place Dauphine, 75001 Paris, et à sa plateforme d'e-médiation : mediationconso-ame.com." },

  { t: "h2", s: "21. Loi applicable" },
  { t: "p", s: "Les relations contractuelles entre le Vendeur et le Client Consommateur situé sur le territoire de l'Union européenne sont régies par la loi de l'État membre sur lequel ce dernier est établi, en ce qui concerne sa protection au titre du droit de la consommation dudit État membre. Pour toute autre question, la loi française sera applicable." },
];

export default function CGVPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
          Conditions générales de vente
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Version en vigueur au 18 avril 2024 · tousvospneus.com — SAS ·
          R.C.S. Aix-en-Provence 977 671 965 · TVA FR38 977 671 965 · 35B
          Chemin des Beaumouilles, 13710 Fuveau
        </p>

        <article className="mt-8 text-sm leading-relaxed text-ink-soft">
          {content.map((node, i) => (
            <Block key={i} node={node} />
          ))}
        </article>
      </main>
    </>
  );
}

function Block({ node }: { node: Node }) {
  switch (node.t) {
    case "h2":
      return (
        <h2 className="mt-10 font-display text-xl font-bold text-ink">
          {node.s}
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-6 font-display text-base font-bold text-ink">
          {node.s}
        </h3>
      );
    case "h4":
      return (
        <h4 className="mt-4 font-semibold text-ink">{node.s}</h4>
      );
    case "p":
      return <p className="mt-3">{node.s}</p>;
    case "ul":
      return (
        <ul className="mt-3 ml-6 list-disc space-y-1.5">
          {node.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "dl":
      return (
        <dl className="mt-3 space-y-2">
          {node.items.map(([term, def], i) => (
            <div key={i}>
              <dt className="inline font-semibold text-ink">{term} </dt>
              <dd className="inline">{def}</dd>
            </div>
          ))}
        </dl>
      );
    case "note":
      return (
        <div className="mt-4 space-y-3 rounded-xl border border-line bg-paper-dim p-4 text-xs leading-relaxed">
          {node.items.map((it, i) => (
            <p key={i}>{it}</p>
          ))}
        </div>
      );
  }
}
