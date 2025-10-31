# Klaviyo Flow Builder

Create automated Klaviyo email sequences (flows) through a tailor-made Next.js dashboard. Configure trigger sources, add sequenced email actions with optional delays, and push them to Klaviyo using the latest public API.

## Prerequisites

- A Klaviyo account with access to the `flows:write` scope.
- A private Klaviyo API key. Store it in an `.env` file using the `KLAVIYO_API_KEY` variable.

```bash
cp .env.example .env
```

Edit `.env` and paste your key:

```
KLAVIYO_API_KEY=pk_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Local development

Install dependencies and launch the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the flow builder UI.

## Deploy

The project is optimized for Vercel. Before deploying, ensure `KLAVIYO_API_KEY` is configured as an environment variable (Project Settings → Environment Variables).
