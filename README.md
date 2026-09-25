# Neura

Real-time AI mental health monitoring. A patient talks to a conversational video
avatar while camera and voice biomarkers are captured continuously, and the
readings plus a risk assessment of the transcript are surfaced to the clinician
responsible for their care.

Neura is a monitoring aid for healthcare professionals. It is **not** a
diagnostic device, and it does not replace clinical judgement or emergency care.

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, and import the repository. Vercel detects
   Next.js automatically; no build settings need changing.
3. Add environment variables (below). At minimum set `AUTH_SECRET`.
4. Deploy.

The app runs with **zero API keys configured** — every integration falls back to
simulated data — so you can deploy first and add credentials as they arrive.

### Environment variables

Copy `.env.example` to `.env.local` for local work, or paste the same values
into **Vercel → Settings → Environment Variables**.

| Variable | Required | What happens without it |
| --- | --- | --- |
| `AUTH_SECRET` | Yes in production | The app refuses to start. Generate with `openssl rand -base64 32` |
| `OPENAI_API_KEY` | No | Agent uses a scripted reflective fallback that still escalates on risk |
| `ANAM_API_KEY` | No | Avatar panel shows a presence indicator; replies use the browser voice |
| `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` | No | Audio stays local instead of routing through Agora RTC |
| `NEXT_PUBLIC_SHENAI_API_KEY` | No | Heart rate, HRV, BP and the rest are simulated |
| `THYMIA_API_KEY` | No | Helios and Apollo panels are simulated |
| `DATABASE_URL` | No | Sessions are held in memory and lost on restart |

`AGORA_APP_CERTIFICATE` must never be prefixed with `NEXT_PUBLIC_` — it signs
tokens and has to stay on the server. `NEXT_PUBLIC_SHENAI_API_KEY` is public on
purpose: the Shen.AI WASM SDK runs in the browser and reads it directly.

### Database

Set `DATABASE_URL` to any Postgres connection string (Neon, Supabase, Vercel
Postgres, RDS). Tables are created automatically the first time the app talks to
the database — there is no migration step to run.

Without `DATABASE_URL` the app uses an in-memory store. That is fine for a demo,
but on Vercel every serverless invocation may get a fresh process, so accounts
and transcripts will not reliably survive between requests. Add a database
before showing this to anyone who expects their history to persist.

---

## Running locally

```bash
npm install
cp .env.example .env.local   # optional; fill in what you have
npm run dev
```

Open <http://localhost:8084>. Register an account — pick **Patient** for the
consultation console, or **Clinician** for the monitoring dashboard. Camera and
microphone permission is requested on entering a session; declining leaves the
text chat fully working.

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`.

---

## How it fits together

```
Browser                                  Server (Next.js route handlers)
───────                                  ──────────────────────────────
Shen.AI WASM  ──┐  camera vitals
Web Speech    ──┤  transcription         /api/sessions/[id]/messages
Anam SDK      ──┤  avatar video      ──► ├─ rule-based risk triage
Agora RTC     ──┘  audio transport       ├─ OpenAI reply generation
                                         └─ persist turn + snapshot
     ▲                                              │
     └──────────── reply + safety level ────────────┘
```

The browser owns the measurement loop, because the camera and the Shen.AI WASM
both live there. It posts a snapshot of every panel to the server roughly every
five seconds, and the server owns the transcript, the risk assessment and the
clinical record.

### Safety

Risk is triaged by deterministic rules over the patient's own words, on every
turn, in `src/lib/safety.ts`. The language model is used to *phrase* the
response, never to decide whether there is a risk — it can raise the assessed
level but never lower it, and the rules run whether or not an LLM key is
configured. Risk is also sticky within a session: a later "I'm fine" does not
clear an earlier disclosure for the reviewing clinician.

Levels run 0 (None) through 3 (Crisis). At level 3 the console shows crisis
resources, and the agent is instructed to stop assessing and escalate.

### Simulated biomarkers

When Shen.AI or Thymia are not licensed, `src/lib/simulation.ts` produces the
readings. It is seeded per session and continuous, so values drift like a real
sensor rather than flickering, and it is driven by a distress term derived from
the actual transcript — so the rail responds to the conversation instead of
showing decorative noise. Simulated snapshots are tagged `live: false`, and the
settings menu in the console header shows exactly which panels are real.

---

## Project layout

```
src/
  app/
    api/            route handlers: auth, sessions, messages, metrics, tokens
    clinician/      monitoring dashboard and per-session review
    session/        the consultation console
    login/ register/
  components/
    console/        the three-column console: conversation, avatar,
                    measurement panel, analytics rail, call controls
    clinician/      dashboard shell, risk badge, sparkline
    ui/             panel primitives and icons
  hooks/
    useConsultation.ts   orchestrates media, providers, sampling and turns
  lib/
    agent.ts        therapist persona and LLM calls
    safety.ts       risk triage rules
    simulation.ts   fallback biomarker engine
    store.ts        Postgres / in-memory persistence
    client/         browser-side SDK wrappers (Shen.AI, Anam, Agora, speech)
```

## Credits

Built on the Neura project from the Claude Hackathon at Imperial College London
by Ben, Nick, Beejal, Anton and Tan.
