import Link from "next/link";

const PROBLEM = [
  {
    stat: "120 days",
    detail:
      "typical NHS wait from referral to second contact, against a four-week standard.",
  },
  {
    stat: "1m+",
    detail: "people currently waiting for mental health support in England.",
  },
  {
    stat: "31%",
    detail: "of young adults report feeling lonely, per the Office for National Statistics.",
  },
];

const MEASURES = [
  {
    title: "Physiological",
    body: "Heart rate and heart-rate variability estimated from ordinary webcam video, with a signal-quality score attached to every reading.",
  },
  {
    title: "Emotional and behavioural",
    body: "Facial expression, eye closure and restlessness, plus vocal pitch, energy, pauses and intonation flatness.",
  },
  {
    title: "Composite",
    body: "A transparent weighted wellbeing, stress, arousal and mood score you can read in the source rather than take on faith.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      <p className="text-sm font-medium tracking-[0.2em] text-calm-400">NEURA</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-calm-50 sm:text-5xl">
        Real-time mental health monitoring, between the appointments.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-calm-300">
        A conversational companion measures voice and video biomarkers while someone talks,
        and surfaces them to their care team. It is a tool for clinicians — never a
        replacement for one.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/session"
          className="rounded-lg bg-calm-400 px-6 py-3 font-medium text-calm-950 transition hover:bg-calm-300"
        >
          Start a session
        </Link>
        <Link
          href="/clinician"
          className="rounded-lg border border-calm-700 px-6 py-3 font-medium text-calm-100 transition hover:border-calm-500"
        >
          Clinician dashboard
        </Link>
      </div>

      <section className="mt-20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-calm-500">
          The problem
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {PROBLEM.map((item) => (
            <div
              key={item.stat}
              className="rounded-xl border border-calm-800 bg-calm-900/30 p-5"
            >
              <div className="text-3xl font-semibold text-calm-100">{item.stat}</div>
              <p className="mt-2 text-sm text-calm-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-sm font-medium uppercase tracking-wide text-calm-500">
          What it measures
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {MEASURES.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-calm-800 bg-calm-900/30 p-5"
            >
              <h3 className="font-medium text-calm-100">{item.title}</h3>
              <p className="mt-2 text-sm text-calm-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-calm-800 bg-calm-900/30 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-calm-500">
          Two different views, on purpose
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="font-medium text-calm-100">The patient sees almost nothing</h3>
            <p className="mt-2 text-sm text-calm-400">
              No heart rate, no stress score, no wellbeing number. Watching your own distress
              scored in real time makes a hard conversation harder, and invites performing
              for the sensor instead of talking.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-calm-100">The clinician sees everything</h3>
            <p className="mt-2 text-sm text-calm-400">
              Full biomarkers, session trends, the complete transcript, and any safety alert
              raised — each reading shown with the confidence behind it.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
        <h2 className="font-medium text-amber-100">Known limits</h2>
        <ul className="mt-3 space-y-2 text-sm text-calm-300">
          <li>
            Camera-based vitals rely on pixel-level colour change and are less reliable on
            darker skin tones and in poor lighting. Signal quality is shown with every value
            rather than hidden.
          </li>
          <li>
            Expression and voice analysis are screening signals, not diagnoses, and can be
            wrong about what someone is feeling.
          </li>
          <li>
            The safety screen is a lexical check tuned to over-trigger. It will miss risk
            expressed obliquely, which is why a human reads the transcript.
          </li>
          <li>
            Neura is not an emergency service. In a crisis, call 999, or Samaritans on 116 123.
          </li>
        </ul>
      </section>

      <footer className="mt-16 text-xs text-calm-600">
        Built as an open reimplementation of the Neura hackathon project. Not a medical
        device, and not certified for clinical use.
      </footer>
    </main>
  );
}
