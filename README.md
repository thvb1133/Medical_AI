# Neura

Real-time, AI-assisted mental health monitoring. A conversational companion
("Fergus") talks to a patient while their webcam and microphone are analysed
for physiological and emotional biomarkers, and everything measured is surfaced
to their care team — not to them.

This is an open reimplementation of the Neura hackathon project, rebuilt to
deploy on Vercel with no invite-only SDKs required.

> **Not a medical device.** Neura is a screening and monitoring aid, not a
> diagnosis, a therapist, or an emergency service. In a crisis call 999 (UK) or
> 911 (US), or Samaritans on 116 123.

---

## What it does

**The patient** opens `/session`, gives consent for camera, microphone and
clinician access separately, and then just talks. They see a calm avatar,
captions, and nothing else — no heart rate, no stress score, no wellbeing
number.

**The clinician** opens `/clinician` and sees every active session ranked with
flagged patients first: live heart rate and HRV, wellbeing, stress, mood,
expression, vocal markers, session trend lines, the full transcript, and any
safety alert that fired.

That split is the core design decision. Showing someone a live readout of their
own distress during a distressing conversation makes it worse and invites them
to perform for the sensor instead of talking.

## What it measures

| Signal | Source | How |
| --- | --- | --- |
| Heart rate, HRV | Webcam | Remote photoplethysmography (`lib/rppg.ts`) — chrominance signal from a forehead region, detrended, Hann-windowed, FFT peak in the 0.7–3 Hz band |
| Expression, eye closure, restlessness | Webcam | MediaPipe face landmarker blendshapes (`lib/expression.ts`) |
| Pitch, jitter, shimmer, energy, pauses, monotony | Microphone | Autocorrelation pitch detection over Web Audio frames (`lib/voice.ts`) |
| Wellbeing, stress, arousal, mood | Fusion | Transparent weighted model (`lib/wellbeing.ts`) |
| Suicide and self-harm risk | Language | Tiered pattern screen (`lib/crisis.ts`) |

Video and audio are analysed **on the patient's own device**. Frames are never
uploaded. Only the derived numbers and the transcript leave the browser.

## Safety model

The risk screen runs on the patient's words **before** the model is called, so
the crisis response never depends on the model behaving correctly, being fast,
or even being configured. It is deliberately tuned to over-trigger: a false
positive costs a clinician a glance at a transcript, a false negative can cost a
life.

Biomarkers can raise a risk level that language already established, but can
never create one on their own — a raised heart rate means someone climbed the
stairs at least as often as it means distress.

When risk reaches high or crisis, three things happen at once: crisis contacts
appear beside the conversation (never as a modal that traps someone), an alert
is written for the clinician, and the model is instructed to keep replies very
short and ask directly about immediate danger.

## Getting it running

### 1. Install and run locally

```bash
npm install
cp .env.example .env.local   # optional — it boots without any keys
npm run dev
```

Open http://localhost:3000. With no keys at all you still get a working
session: browser speech recognition, the browser's built-in voice, a local
canvas avatar, in-browser biomarkers, and a scripted reflective responder.

### 2. Add API keys

Every key is optional and each one upgrades a fallback. Put them in `.env.local`
locally, and in **Vercel → Project → Settings → Environment Variables** for a
deployment.

| Variable | What it buys you | Without it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude drives the conversation (preferred) | falls through to OpenAI |
| `OPENAI_API_KEY` | GPT drives the conversation | scripted reflective replies |
| `DEEPGRAM_API_KEY` | Accurate server transcription | browser speech recognition (Chrome/Edge only) |
| `ELEVENLABS_API_KEY` | Natural voice for Fergus | browser `speechSynthesis` voice |
| `ANAM_API_KEY` | Real video avatar | animated canvas avatar |
| `DATABASE_URL` | Sessions persist | in-memory only |
| `CLINICIAN_ACCESS_CODE` | Passphrase gate on `/clinician` | **dashboard is public** |

Optional tuning: `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `DEEPGRAM_MODEL`,
`ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`, `ANAM_PERSONA_ID`.

### 3. Set up the database

Create a Postgres database — Vercel Postgres, Neon, or Supabase all work — and
put its connection string in `DATABASE_URL`. Then create the tables:

```bash
npm run db:push
```

Without this the app still runs, but sessions live in a single serverless
instance's memory and the dashboard tells you so on screen.

### 4. Deploy to Vercel

```bash
npm i -g vercel
vercel          # link the project
vercel --prod   # deploy
```

Or import the repository at [vercel.com/new](https://vercel.com/new) — it is a
stock Next.js app and needs no build configuration. Add the environment
variables before or just after the first deploy, then redeploy so they take
effect.

Two things to check on a public deployment:

1. **Set `CLINICIAN_ACCESS_CODE`.** Otherwise `/clinician` — patient transcripts
   and all — is open to anyone with the URL. The dashboard shows a warning
   banner until you do.
2. **HTTPS is required** for camera and microphone access. Vercel gives you this
   by default; a custom domain must also be on HTTPS.

## Project layout

```
app/
  page.tsx              landing page
  session/              patient view — minimal by design
  clinician/            dashboard list and per-session detail
  api/                  chat, stt, tts, sessions, telemetry, alerts, anam token
components/             avatar, consent, conversation, crisis overlay, dashboard widgets
hooks/
  useNeuraSession.ts    owns media, both biomarker pipelines, turn-taking, upload
  usePolling.ts         dashboard refresh
lib/
  rppg.ts               camera heart rate
  voice.ts              vocal biomarkers
  expression.ts         facial expression
  wellbeing.ts          score fusion
  crisis.ts             risk screen and crisis resources
  prompt.ts             Fergus system prompt and safety rules
  llm.ts                Anthropic / OpenAI / fallback
  store.ts              Postgres or in-memory persistence
  client/               microphone pipeline and speech in/out
```

## Turn-taking

The original project's team called out end-to-end latency as their hardest
problem, and turn detection as the fix. Here it is silence-based and lives in
`lib/client/audio.ts`:

- recording opens slightly *below* the speech threshold so the first consonant
  is not clipped
- a turn closes after 1100 ms of silence, which is long enough not to interrupt
  someone who is upset and pausing
- utterances under 400 ms are discarded as coughs and door closes
- the microphone is muted while Fergus speaks so his own voice is never
  transcribed back

Those constants are at the top of the file if your room or accent needs them
adjusted.

## Known limits

These are real, and the UI states them rather than hiding them:

- **Skin tone.** rPPG reads pixel-level colour change, which carries less
  pulsatile signal on darker skin. Every heart rate is shown with a signal
  quality score, and low quality is called out rather than smoothed over.
- **Expression is not emotion.** The blendshape classifier is a heuristic. It
  can be confidently wrong, and a face is not a feeling.
- **The risk screen is lexical.** It will miss risk expressed obliquely, in
  metaphor, or in another language. A human reads the transcript.
- **Authentication is demo-grade.** One shared passphrase is not
  information-governance approval. Real patient data needs per-clinician
  identity, an audit trail, and encryption at rest.
- **MediaPipe assets load from a CDN.** Set `NEXT_PUBLIC_MEDIAPIPE_WASM_URL` and
  `NEXT_PUBLIC_FACE_MODEL_URL` to self-host them. If they fail to load the app
  keeps working with fewer signals.

## Scripts

```bash
npm run dev         # development server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run db:push     # create/update Postgres tables
```
