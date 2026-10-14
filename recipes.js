/* Catalogue local de recettes MICI Score.
 * Les quantités sont indiquées par portion. Les liens renvoient vers les sources ;
 * aucune recette complète ni photo tierce n'est reproduite ici.
 */
window.MICI_RECIPES = [
  {
    id: "riz-carottes-poulet",
    title: "Bol de riz, carottes et poulet",
    category: "Repas complet",
    servings: 1,
    summary: "Un plat simple composé d'aliments courants, à adapter selon ta tolérance personnelle.",
    source: "https://www.crohnscolitisfoundation.org/patientandcaregivers/gutfriendlyrecipes",
    sourceLabel: "Crohn's & Colitis Foundation — recettes",
    ingredients: [
      { names: ["Riz blanc cuit", "Riz blanc", "Riz cuit"], grams: 180 },
      { names: ["Poulet cuit", "Poulet", "Blanc de poulet cuit", "Blanc de poulet"], grams: 100 },
      { names: ["Carotte cuite", "Carottes cuites", "Carotte", "Carottes"], grams: 80 },
      { names: ["Huile d'olive", "Huile olive"], grams: 5 }
    ],
    steps: ["Cuire le riz et le poulet séparément.", "Cuire les carottes jusqu'à la texture souhaitée.", "Assembler et ajouter l'huile."]
  },
  {
    id: "omelette-pommes-de-terre",
    title: "Omelette et pommes de terre fondantes",
    category: "Repas complet",
    servings: 1,
    summary: "Une préparation courte avec des ingrédients familiers ; adapter la cuisson et la quantité selon son ressenti.",
    source: "https://www.crohnscolitisfoundation.org/patientsandcaregivers/diet-and-nutrition/what-should-i-eat",
    sourceLabel: "Crohn's & Colitis Foundation — alimentation",
    ingredients: [
      { names: ["Œuf", "Oeuf", "Œufs", "Oeufs"], grams: 100 },
      { names: ["Pomme de terre cuite", "Pommes de terre cuites", "Pomme de terre", "Pommes de terre"], grams: 180 },
      { names: ["Huile d'olive", "Huile olive"], grams: 5 }
    ],
    steps: ["Cuire les pommes de terre jusqu'à ce qu'elles soient tendres.", "Battre les œufs et cuire l'omelette à feu doux.", "Servir avec les pommes de terre."]
  },
  {
    id: "soupe-carotte-pomme-terre",
    title: "Velouté de carottes et pommes de terre",
    category: "Soupe",
    servings: 1,
    summary: "Une soupe mixée dont la texture et l'assaisonnement peuvent être ajustés.",
    source: "https://www.nhs.uk/conditions/crohns-disease/",
    sourceLabel: "NHS — maladie de Crohn et alimentation",
    ingredients: [
      { names: ["Carotte cuite", "Carottes cuites", "Carotte", "Carottes"], grams: 150 },
      { names: ["Pomme de terre cuite", "Pommes de terre cuites", "Pomme de terre", "Pommes de terre"], grams: 120 },
      { names: ["Bouillon de légumes", "Bouillon"], grams: 250 }
    ],
    steps: ["Éplucher et couper les légumes.", "Les cuire dans le bouillon jusqu'à ce qu'ils soient tendres.", "Mixer et ajuster la texture avec un peu d'eau si nécessaire."]
  },
  {
    id: "porridge-banane",
    title: "Porridge à la banane",
    category: "Petit-déjeuner",
    servings: 1,
    summary: "Un petit-déjeuner chaud, à personnaliser selon les aliments déjà bien tolérés.",
    source: "https://www.crohnscolitisfoundation.org/patientandcaregivers/gutfriendlyrecipes",
    sourceLabel: "Crohn's & Colitis Foundation — recettes",
    ingredients: [
      { names: ["Flocons d'avoine", "Avoine", "Porridge"], grams: 40 },
      { names: ["Lait sans lactose", "Lait demi-écrémé", "Lait"], grams: 180 },
      { names: ["Banane", "Banane mûre"], grams: 80 }
    ],
    steps: ["Faire chauffer doucement les flocons avec le lait.", "Remuer jusqu'à obtenir une texture crémeuse.", "Ajouter la banane écrasée ou coupée."]
  }
];
