# Activer les comptes et le tchat RIP

Le code des comptes, profils, salons, amis, DM et tchat est deja dans le site.
Il reste seulement a creer/configurer la base Supabase, puis a relancer le SQL quand le site change.

## 1. Creer le projet

1. Va sur https://supabase.com/dashboard
2. Connecte-toi.
3. Clique sur `New project`.
4. Choisis un nom, par exemple `rip-chat`.
5. Choisis une region proche de toi.
6. Cree le projet et attends la fin du chargement.

## 2. Creer les tables Supabase

1. Dans Supabase, ouvre `SQL Editor`.
2. Clique `New query`.
3. Copie tout le contenu du fichier `supabase-chat.sql`.
4. Colle-le dans Supabase.
5. Clique `Run`.

Le script cree :

- `profiles` pour les pseudos et emails
- les champs de profil : titre, statut, bio, couleur, lien, derniere activite
- `chat_rooms` pour les salons publics, prives et DM
- `room_members` pour savoir qui a acces a chaque salon
- `friend_requests` pour les demandes d'amis
- `chat_messages` pour les messages par salon
- les regles RLS pour securiser les donnees
- un trigger qui cree un profil a chaque inscription Supabase
- les fonctions `join_room_by_code` et `create_or_get_dm`
- les index utiles pour les statistiques et le tchat

## 3. Recuperer les infos publiques

Dans Supabase, recupere :

- l'URL du projet, qui commence par `https://` et se termine par `.supabase.co`
- la cle publique `anon` ou `publishable`

Tu peux generalement les trouver dans le bouton `Connect`, ou dans `Settings > API Keys`.

Ne copie jamais une cle `service_role`, `secret`, ou `sb_secret`.

## 4. Coller les infos dans le site

Ouvre `supabase-config.js` et remplace les valeurs vides :

```js
window.RIP_SUPABASE = {
  url: "https://TON-PROJET.supabase.co",
  anonKey: "TA_CLE_PUBLIQUE"
};
```

Ne colle pas une URL qui finit par `/rest/v1/`.

## 5. Envoyer sur GitHub

```powershell
& "C:\Program Files\Git\cmd\git.exe" -C E:\RIP add .
& "C:\Program Files\Git\cmd\git.exe" -C E:\RIP commit -m "Ajoute le tchat en ligne"
& "C:\Program Files\Git\cmd\git.exe" -C E:\RIP push
```

Ensuite, ouvre `chat.html` sur ton site GitHub Pages.

## Apres une mise a jour du site

Si une nouvelle version ajoute des champs de profil ou de tchat, relance simplement tout le fichier
`supabase-chat.sql` dans Supabase. Le script utilise `if not exists`, donc il peut etre relance sans supprimer les comptes existants.

Pour cette version, il faut le relancer. Sinon tu peux voir des erreurs `400` sur `profiles`,
`chat_rooms`, `room_members`, `friend_requests` ou `room_id`.

Apres le `Run`, recharge ton site avec `Ctrl + F5`.

## Fonctions ajoutees

- salons publics visibles par les comptes connectes
- salons prives avec code d'invitation affiche dans le salon
- demandes d'amis par pseudo
- liste d'amis
- messages prives en DM entre amis acceptes
- presence en ligne par salon
- indicateur quand quelqu'un ecrit
- recherche dans le salon actif

## Probleme frequent

Si l'inscription dit que l'email doit etre confirme, ouvre ta boite mail et clique le lien Supabase.
Pour tester plus vite, tu peux aussi aller dans Supabase > Authentication > Sign In / Providers > Email
et desactiver temporairement la confirmation email.

Si tu ne vois pas `New query`, ouvre `SQL Editor` dans le menu de gauche, puis cherche un bouton `+`,
`New query`, `Blank query` ou `Create query` selon l'interface Supabase.
