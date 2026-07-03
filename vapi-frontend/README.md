# VoxCRM Dashboard

Enterprise console for the VoxCRM platform (voice AI agents + email CRM).
Next.js 15 App Router, TypeScript, Tailwind CSS v4, shadcn-style components,
Lucide icons, Recharts. Dark-only zinc theme in the Linear aesthetic.

## Architecture

- **BFF security model.** The browser never talks to the backend directly and
  never sees the JWT. Next.js route handlers proxy every request:
  - `POST /api/auth/login` / `register` — forward credentials to the backend,
    store the returned JWT in an **httpOnly cookie** (`vox_token`).
  - `POST /api/auth/logout` — clears the cookie.
  - `ANY /api/backend/[...path]` — authenticated catch-all proxy that attaches
    `Authorization: Bearer <token>` and forwards to the backend `/api/*`.
  This keeps the token out of client JavaScript (XSS-safe) and avoids CORS.
- **Route guarding.** `src/middleware.ts` checks the cookie (including JWT
  expiry) at the edge: unauthenticated visits to `/dashboard/**` redirect to
  `/login?next=...`; authenticated visits to `/login` bounce to the dashboard.
  Real authorization is enforced by the backend on every proxied call.
- **Typed API layer.** `src/lib/api.ts` is the single typed client used by all
  views; domain types in `src/lib/types.ts` mirror the backend contracts.

## Views

| Route | Contents |
| --- | --- |
| `/login` | Sign in / create account (tabs), error surfacing, return-path support |
| `/dashboard` | KPI cards (total, completed, active calls, agents) + 14-day call volume area chart + status mix chart |
| `/dashboard/agents` | Agent CRUD: system prompt, provider/model, voice, temperature, max tokens, active toggle, delete confirm |
| `/dashboard/calls` | Paginated, status-filterable call table with a detail sheet showing metadata, the AI summary and the full transcript |

## Setup

```bash
npm install
cp .env.example .env.local   # set BACKEND_API_URL
npm run dev                  # http://localhost:3000
```

`BACKEND_API_URL` is server-side only (no `NEXT_PUBLIC_` prefix by design):

- Local backend: `http://localhost:8080`
- Railway: `https://<your-service>.up.railway.app`

When deploying (Vercel, Railway, etc.) set `BACKEND_API_URL` in the host's
environment settings.

## Conventions

- No emojis or decorative unicode anywhere in the UI — icons come exclusively
  from `lucide-react`.
- Theme tokens live in `src/app/globals.css` (`.dark` block): zinc-950 canvas,
  zinc-800 borders, white primary, emerald as the single accent for positive
  states.
- UI primitives are shadcn-generated (`src/components/ui/`); feature components
  live in `src/components/{dashboard,agents,calls}/`.
