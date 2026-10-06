# Portail Recrute Stagiaire

Portail candidats. On dépose un CV, les champs sont extraits, puis le PDF est enregistré. Le candidat a un espace, l'admin a une vue des profils.

Le dépôt est sur `/depot`. L'extraction appelle `POST /api/parse-cv` (Affinda). L'envoi du PDF appelle `POST /api/depot` et range le fichier dans le bucket Supabase `cvs`. Sans `AFFINDA_API_KEY`, le dépôt du PDF fonctionne encore et l'extraction répond une erreur de configuration.

`AFFINDA_API_BASE` doit viser la région du compte Affinda (`api.eu1`, `api.us1`, ou `api`). Le code part sur l'Europe.

## Lancer

```bash
npm install
cp .env.example .env.local
npm run dev
```

Les noms de variables sont dans `.env.example`.

## Stack

Next.js, Supabase, Affinda.
