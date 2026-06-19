# Activer les comptes et le tchat RIP

Le code des comptes et du tchat est deja dans le site. Il reste seulement a creer/configurer la base Supabase.

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
- `chat_messages` pour les messages
- les regles RLS pour securiser les donnees
- un trigger qui cree un profil a chaque inscription Supabase

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

## Probleme frequent

Si l'inscription dit que l'email doit etre confirme, ouvre ta boite mail et clique le lien Supabase.
Pour tester plus vite, tu peux aussi aller dans Supabase > Authentication > Sign In / Providers > Email
et desactiver temporairement la confirmation email.
