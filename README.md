# CaddieAI

Voice-first golf caddie for UK high-handicap golfers. React + Vite frontend with secure Vercel serverless API routes for OpenAI transcription and recommendations.

## Local development

### Environment variables

API keys are **server-side only**. Never use a `VITE_` prefix for OpenAI credentials.

1. Copy the example env file:

```bash
cp .env.example .env.local
```

2. Add your values to `.env.local`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

- `OPENAI_API_KEY` — required for `/api/transcribe` and `/api/caddie`
- `OPENAI_MODEL` — optional; falls back to `gpt-4o-mini` in `api/_lib/config.js`

**Never commit `.env.local` or any file containing a real API key to Git.**

### Running locally

**Full stack (recommended)** — serves the Vite app and API routes together:

```bash
npm run dev:full
```

Uses `vercel dev`, which loads `.env.local` and exposes `/api/*`.

**Frontend only** — UI without working API unless you also run `vercel dev` on port 3000:

```bash
npm run dev
```

Vite proxies `/api` requests to `http://localhost:3000` when a Vercel dev server is running.

### Microphone access

Browsers require **HTTPS** (or `localhost`) for `getUserMedia` / microphone recording. In production on Vercel, your deployment is served over HTTPS automatically.

## Deploying to Vercel

1. Push the repo to GitHub and import the project in Vercel.
2. Add environment variables in **Project Settings → Environment Variables**:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional)
3. Deploy. API routes in `/api` run as serverless functions; the static app is served from `dist`.

Do **not** add `OPENAI_API_KEY` to the Vite build or any `VITE_*` variable — the React app calls `/api/transcribe` and `/api/caddie` only.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (frontend) |
| `npm run dev:full` | Vercel dev (frontend + API) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Oxlint |

## Security notes

- OpenAI is called **only** from `api/transcribe.js` and `api/caddie.js`.
- `OPENAI_API_KEY` is read via `process.env` on the server.
- Rate limiting uses a temporary in-memory store (see `api/_lib/rateLimit.js`) — replace before scaling to multiple instances.
