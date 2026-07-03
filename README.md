# VoxCRM Backend

A production-oriented TypeScript backend combining a **Vapi.ai-style voice AI
platform** (Twilio Media Streams → STT → LLM → TTS) with an **email marketing
CRM**. Clean layered architecture, Zod-validated inputs, JWT auth, centralized
error handling, and a queue that transparently uses **BullMQ when Redis is
configured** or an **in-process async queue** otherwise.

Every third-party integration degrades gracefully to a deterministic local stub
when its API key is absent, so the server boots and the full request + voice
pipeline can be exercised **without any external credentials**.

## Stack

- **Runtime:** Node ≥ 20, TypeScript (CommonJS)
- **HTTP:** Express 5 · **Validation:** Zod 4 · **Auth:** JWT (`jsonwebtoken`)
- **ORM:** Prisma 6 (PostgreSQL) · **WebSockets:** `ws`
- **Queue:** BullMQ (Redis) with in-memory fallback
- **Voice:** Twilio Media Streams · Deepgram (STT) · ElevenLabs (TTS)
- **LLM:** Anthropic Claude / OpenAI · **Email:** Resend / SMTP / console

## Getting started

```bash
npm install
cp .env.example .env          # fill in what you have; blanks fall back to stubs
npm run prisma:generate       # generate the Prisma client
# with a database configured:
npm run prisma:migrate        # create tables
npm run dev                   # ts-node + nodemon (hot reload)
# or
npm run build && npm start    # compiled production build
```

Health check: `GET http://localhost:8080/api/health` reports which providers are
live vs. stubbed and which queue driver is active.

## Project layout

```
src/
├─ config/         env validation (Zod), Prisma singleton, provider configs
├─ middleware/     asyncHandler, Zod validate, JWT auth, global errorHandler
├─ queue/          Queue abstraction (BullMQ ⇄ in-memory)
├─ services/
│  ├─ VoiceOrchestrator.ts   Twilio WS ↔ STT ↔ LLM ↔ TTS + barge-in
│  ├─ LLMService.ts          Anthropic/OpenAI (buffered + streaming) + summaries
│  ├─ EmailService.ts        Resend / raw-SMTP / console, bulk send
│  └─ providers/             stt.ts (Deepgram), tts.ts (ElevenLabs)
├─ workers/        postCall.worker (summary→email), campaign.worker (bulk send)
├─ controllers/    auth, agent, call, campaign
├─ routes/         express routers + /voice Twilio webhook
├─ validators/     Zod schemas per resource
├─ types/          shared interfaces + Express augmentation
├─ utils/          ApiError, logger, password (scrypt), http helpers
├─ app.ts          Express app factory
├─ server.ts       HTTP + WS + workers bootstrap, graceful shutdown
└─ index.ts        entry point
```

## API

All `/api/*` routes except `/api/health` and `/api/auth/*` require
`Authorization: Bearer <token>`.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/register` · `/login` | Get a JWT |
| GET | `/api/auth/me` | Current user |
| CRUD | `/api/agents` `/:id` | Voice agents (prompt + provider config) |
| CRUD | `/api/calls` `/:id` | Call logs, transcripts, summaries |
| CRUD | `/api/campaigns` `/:id` | Email campaigns |
| POST | `/api/campaigns/:id/queue` | Enqueue a campaign for delivery |
| GET | `/api/campaigns/:id/status` | Delivery progress + breakdown |
| POST/GET | `/voice/incoming` | **Public** Twilio webhook → returns TwiML |
| WS | `/voice/stream` | Twilio Media Streams audio socket |

## Voice pipeline

1. Twilio hits `POST /voice/incoming`; the server returns TwiML that opens a
   Media Stream to `wss://…/voice/stream` with the agent/user as parameters.
2. `VoiceOrchestrator` accepts the socket, loads the agent, creates a `Call`,
   and greets the caller (TTS → Twilio).
3. Inbound mu-law audio → **Deepgram** STT (interim + final + VAD).
4. Final transcripts → **LLM** streamed with the agent's system prompt; each
   completed sentence is spoken immediately for low latency.
5. **ElevenLabs** streams 8 kHz mu-law frames back to Twilio.
6. **Barge-in:** if the caller speaks while the agent is talking, the current
   LLM/TTS turn is aborted and a Twilio `clear` flushes buffered audio.
7. On hang-up the call is marked `COMPLETED`, which triggers the post-call
   worker: LLM summary → saved to the call → emailed to the lead/user.

## Deploy to Railway

The repo ships with [railway.toml](railway.toml) for zero-config deployment:

1. Push this folder to a GitHub repo (or run `railway up` from it). If `vapi/`
   is a subfolder of the repo, set the service **Root Directory** to `/vapi`
   in Railway → service → Settings.
2. In the Railway project, add a **PostgreSQL** database service.
3. On the app service, set variables:
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (reference the DB service)
   - `JWT_SECRET` → a long random string
   - provider keys as available (`ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`,
     `ELEVENLABS_API_KEY`, `TWILIO_*`, `RESEND_API_KEY`, …)
   - `REDIS_URL` → `${{Redis.REDIS_URL}}` only if you add a Redis service
4. Deploy. The pipeline is: Railpack installs deps (dev deps included for the
   build) → `npm run build` (`npx prisma generate` + `tsc`) → pre-deploy
   `npx prisma db push` creates the schema on the Railway Postgres → start
   `node dist/index.js` → healthcheck on `/api/health`.

No `PORT` or `PUBLIC_BASE_URL` needed: the app listens on Railway's injected
`PORT` and derives its public URL from `RAILWAY_PUBLIC_DOMAIN` automatically.
`prisma` + `@prisma/client` are in `dependencies` on purpose — Railpack prunes
devDependencies from the runtime image, and the pre-deploy command needs the
Prisma CLI after pruning. Once you adopt migration files, switch the
pre-deploy command to `npx prisma migrate deploy`.

## Notes

- **No live database required to boot** — DB-backed routes error clearly until
  `DATABASE_URL` is set, but the voice TwiML webhook still answers so calls are
  never dropped.
- Swap providers via `.env` (`LLM_PROVIDER`, `EMAIL_PROVIDER`, keys). Missing
  keys → local stub, never a crash.
- `REDIS_URL` set → BullMQ; unset → in-memory queue. Identical calling code.
