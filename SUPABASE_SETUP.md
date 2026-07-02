# Activer RIP Casino dans Supabase

Le site public contient maintenant uniquement l'accueil Casino, la connexion, l'inscription et les tables avancees.

## Appliquer la base

1. Ouvre le projet dans le dashboard Supabase.
2. Ouvre `SQL Editor` puis `New query`.
3. Copie tout le fichier `supabase-chat.sql` (la migration v9 inclut boosts, progression et salons publics).
4. Execute la requete avec `Run`.
5. Recharge le site avec `Ctrl + F5`.

Le script est relancable et conserve les comptes et les soldes existants. La version Casino ajoute notamment :

- les wallets de points virtuels ;
- un bonus gratuit et unique de 10 000 points par compte ;
- le blackjack prive de un a quatre joueurs ;
- le jeu RIP x20 en quatre tirages ;
- Cosmic Roulette, Nebula Slots, Mini Baccarat et Star Dice ;
- Quantum Coin, Lucky Orbit, Asteroid Mines et Three Card Poker ;
- des tirages serveur avec `pgcrypto` ;
- des mises et paiements atomiques cote base ;
- un historique des manches instantanees.

## Configuration publique

La configuration frontend reste dans `shared/supabase/public-config.js` :

```js
window.RIP_SUPABASE = {
  url: "https://TON-PROJET.supabase.co",
  anonKey: "TA_CLE_PUBLIQUE"
};
```

Utilise uniquement une cle `anon` ou `publishable`. Ne place jamais une cle `service_role`, `secret` ou `sb_secret` dans le site.

## Economie virtuelle

- aucun depot d'argent ;
- aucun achat de points ;
- aucun retrait ;
- 10 000 points correspondent visuellement a environ 1 EUR, uniquement comme simulation d'interface ;
- les points n'ont aucune valeur monetaire reelle.
