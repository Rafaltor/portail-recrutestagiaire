This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Portail — dépôt CV & extraction (Affinda)

- Page **`/depot`** : dépôt de CV, bouton **Extraire les infos du CV** (API **`POST /api/parse-cv`**, clé serveur **`AFFINDA_API_KEY`**), puis envoi **`POST /api/depot`** (PDF uniquement, bucket Supabase `cvs`).
- Variables : voir **`.env.example`**. Sans `AFFINDA_API_KEY`, l’extraction renvoie une erreur de configuration ; le dépôt PDF reste utilisable.
- **Erreur 401** : clé incorrecte *ou* mauvaise région — `AFFINDA_API_BASE` doit correspondre au domaine Affinda où tu te connectes (`api.eu1`, `api.us1` ou `api` global). Le code par défaut utilise **EU** (`https://api.eu1.affinda.com`).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
