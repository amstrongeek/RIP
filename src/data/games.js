export const GAME_CATALOG = [
  {
    key: "reflex",
    title: "Reflex Blitz",
    shortTitle: "Reflex",
    category: "rapidite",
    mode: "solo",
    difficulty: "facile",
    reward: "8-90 coins",
    description: "Clique au signal, evite les faux departs et monte ton score sur 5 rounds.",
    implemented: true,
    featured: true
  },
  {
    key: "memory",
    title: "Memory Grid",
    shortTitle: "Memory",
    category: "reflexion",
    mode: "solo",
    difficulty: "moyen",
    reward: "10-120 coins",
    description: "Memorise une sequence de cases de plus en plus longue.",
    implemented: true,
    featured: true
  },
  {
    key: "runner",
    title: "Neon Runner",
    shortTitle: "Runner",
    category: "action",
    mode: "solo",
    difficulty: "moyen",
    reward: "10-140 coins",
    description: "Change de lane, evite les obstacles et tiens le plus longtemps possible.",
    implemented: true,
    featured: true
  },
  {
    key: "aim",
    title: "Aim Trainer",
    shortTitle: "Aim",
    category: "precision",
    mode: "solo",
    difficulty: "moyen",
    reward: "10-130 coins",
    description: "Touche les cibles en 20 secondes, limite les miss et garde le rythme.",
    implemented: true,
    featured: true
  },
  {
    key: "cipher",
    title: "Code Breaker",
    shortTitle: "Code",
    category: "reflexion",
    mode: "solo",
    difficulty: "moyen",
    reward: "10-120 coins",
    description: "Devine un code secret avec des indices exacts et mal places.",
    implemented: true,
    featured: false
  },
  {
    key: "duel",
    title: "RPS Battle",
    shortTitle: "Duel",
    category: "multijoueur",
    mode: "multi",
    difficulty: "facile",
    reward: "5-35 coins",
    description: "Duel Pierre Feuille Ciseaux avec code prive et recompenses.",
    implemented: true,
    featured: false
  },
  {
    key: "ttt",
    title: "Morpion Neon",
    shortTitle: "Morpion",
    category: "multijoueur",
    mode: "multi",
    difficulty: "facile",
    reward: "15-60 coins",
    description: "Morpion en ligne avec code de partie, tours et gains de fin de match.",
    implemented: true,
    featured: true
  },
  {
    key: "snake",
    title: "Snake Mods",
    shortTitle: "Snake",
    category: "classique",
    mode: "solo",
    difficulty: "a venir",
    reward: "bientot",
    description: "Snake moderne avec skins, vitesse progressive et power-ups.",
    implemented: false,
    featured: false
  },
  {
    key: "space",
    title: "Space Shooter",
    shortTitle: "Space",
    category: "action",
    mode: "solo",
    difficulty: "a venir",
    reward: "bientot",
    description: "Prototype de jeu plus complet avec vaisseau, vagues et boss.",
    implemented: false,
    featured: false
  }
];

export const GAME_CATEGORIES = [
  "tous",
  "action",
  "rapidite",
  "precision",
  "reflexion",
  "multijoueur",
  "classique"
];