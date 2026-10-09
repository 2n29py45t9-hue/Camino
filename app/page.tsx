"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type AuthMode = "signup" | "login";

const answers = ["Buenas noches", "Buenos días", "Hasta luego"];

function CaminoMark() {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      fill="none"
      viewBox="0 0 44 44"
    >
      <rect fill="currentColor" height="44" rx="15" width="44" />
      <path
        d="M13 27.5c3.2-7.2 7.4-11 12.5-11 2.7 0 4.8 1.1 6.5 3.4M15 30.5c4.2-2.1 8.1-2.6 11.7-1.5 2 .6 3.7 1.6 5.3 3"
        stroke="#FBF8F0"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <circle cx="15" cy="16" fill="#E8A275" r="2.2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path
        d="M4 10h11m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.5 5.5c2.7-.8 5.2-.4 7.5 1.2v12c-2.3-1.6-4.8-2-7.5-1.2v-12Zm15 0c-2.7-.8-5.2-.4-7.5 1.2v12c2.3-1.6 4.8-2 7.5-1.2v-12Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(() => isSupabaseConfigured());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lessonOpen, setLessonOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      if (nextSession) {
        setAuthOpen(false);
        setAuthError("");
      }
      setAuthLoading(false);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
        setAuthLoading(false);
      })
      .catch(() => {
        if (isMounted) setAuthLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const learnerName =
    session?.user.user_metadata?.display_name ||
    session?.user.email?.split("@")[0] ||
    "Lernende:r";

  function openAuth(mode: AuthMode = "signup") {
    setAuthMode(mode);
    setAuthError("");
    setAuthMessage("");
    setAuthOpen(true);
  }

  function startLesson() {
    if (!session) {
      openAuth("signup");
      return;
    }
    setAnswer(null);
    setLessonOpen(true);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!isSupabaseConfigured()) {
      setAuthError(
        "Die Supabase-Variablen fehlen. Bitte NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY einrichten.",
      );
      return;
    }

    setAuthBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();

      if (authMode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          setSession(data.session);
          setAuthOpen(false);
        } else {
          setAuthMessage(
            "Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach und melde dich danach an.",
          );
        }
      } else {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (signInError) throw signInError;
        setSession(data.session);
        setAuthOpen(false);
      }
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Das hat gerade nicht geklappt. Bitte versuche es noch einmal.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (!isSupabaseConfigured()) return;
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) setAuthError(error.message);
    else setSession(null);
  }

  function goToLearningPath() {
    document.getElementById("lernweg")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <a aria-label="Camino – Startseite" className="brand" href="#start">
          <CaminoMark />
          <span className="brand-wordmark">
            camino<span>.</span>
          </span>
        </a>

        <nav aria-label="Hauptnavigation" className="main-nav">
          <a href="#lernweg">Dein Lernweg</a>
          <a href="#idee">So funktioniert’s</a>
        </nav>

        <div className="header-actions">
          {session ? (
            <>
              <span className="signed-in-label">
                <span className="status-dot" />
                {authLoading ? "Lädt …" : learnerName}
              </span>
              <button className="button button-quiet" onClick={handleSignOut}>
                Abmelden
              </button>
            </>
          ) : (
            <>
              <button
                className="button button-quiet header-login"
                onClick={() => openAuth("login")}
              >
                Anmelden
              </button>
              <button
                className="button button-small button-primary"
                onClick={() => openAuth("signup")}
              >
                Kostenlos starten <ArrowIcon />
              </button>
            </>
          )}
        </div>
      </header>

      <section aria-labelledby="hero-title" className="hero" id="start">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-spark" aria-hidden="true">✳</span>
            SPANISCH LERNEN, GANZ IN DEINEM TEMPO
          </div>
          <h1 id="hero-title">
            Dein Weg zu Spanisch beginnt mit <em>hola.</em>
          </h1>
          <p className="hero-description">
            Kurze Lektionen, die in deinen Alltag passen. Ein klarer Lernpfad,
            der dich Schritt für Schritt zu echten Gesprächen bringt.
          </p>
          {session ? (
            <div className="welcome-note">
              <span className="welcome-spark" aria-hidden="true">✦</span>
              Schön, dass du da bist, {learnerName}.
            </div>
          ) : null}
          <div className="hero-buttons">
            {session ? (
              <button className="button button-primary" onClick={goToLearningPath}>
                Weiter zum Lernweg <ArrowIcon />
              </button>
            ) : (
              <button
                className="button button-primary"
                onClick={() => openAuth("signup")}
              >
                Deinen Weg beginnen <ArrowIcon />
              </button>
            )}
            <a className="text-link" href="#lernweg">
              Lernweg ansehen <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="hero-footnote">Kostenlos starten · kein Abo · dein Tempo</p>
        </div>

        <div aria-label="Vorschau einer Camino-Lektion" className="hero-art">
          <div className="art-sun" />
          <div className="art-orbit art-orbit-one" />
          <div className="art-orbit art-orbit-two" />
          <div className="floating-note note-top">
            <span className="note-star" aria-hidden="true">✳</span>
            Kleine Schritte. Große Welt.
          </div>
          <div className="lesson-preview-card">
            <div className="preview-card-top">
              <span className="lesson-index">01</span>
              <div>
                <span className="card-kicker">DEIN ERSTER SCHRITT</span>
                <strong>Saludos</strong>
              </div>
              <span aria-label="Lektion" className="preview-book-icon">
                <BookIcon />
              </span>
            </div>
            <div className="preview-divider" />
            <p className="spanish-word">¡Hola!</p>
            <p className="word-translation">Hallo — schön, dass du da bist.</p>
            <div className="preview-footer">
              <span><span className="tiny-dot" /> Begrüßungen</span>
              <span>Erste Lektion</span>
            </div>
          </div>
          <div className="floating-note note-bottom">
            <span className="note-check" aria-hidden="true">✓</span>
            66 Übungen warten auf dich
          </div>
          <div aria-hidden="true" className="art-leaf leaf-one" />
          <div aria-hidden="true" className="art-leaf leaf-two" />
        </div>
      </section>

      <section aria-label="Camino auf einen Blick" className="quick-facts">
        <div className="fact-item">
          <span className="fact-number">66</span>
          <span className="fact-text">kurze Übungen</span>
        </div>
        <span aria-hidden="true" className="fact-separator" />
        <div className="fact-item">
          <span className="fact-icon fact-icon-clock" aria-hidden="true">◷</span>
          <span className="fact-text">Lernen in deinem Alltag</span>
        </div>
        <span aria-hidden="true" className="fact-separator" />
        <div className="fact-item">
          <span className="fact-icon fact-icon-heart" aria-hidden="true">♡</span>
          <span className="fact-text">Ohne Paywall</span>
        </div>
      </section>

      <section aria-labelledby="path-title" className="path-section" id="lernweg">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">TU CAMINO · DEIN LERNWEG</p>
            <h2 id="path-title">Heute ein Schritt.<br />Bald ein ganzes Gespräch.</h2>
          </div>
          <p className="section-description">
            Fang mit den Worten an, die du sofort gebrauchen kannst. Mit jeder
            Lektion wächst dein Gefühl für die Sprache.
          </p>
        </div>

        <div className="path-card">
          <div className="path-art-panel">
            <div aria-hidden="true" className="path-sun" />
            <span className="path-art-kicker">EMPEZAMOS</span>
            <span className="path-art-word">¡Hola!</span>
            <span className="path-art-caption">Alles beginnt mit einem Hallo.</span>
            <span aria-hidden="true" className="path-path-line" />
            <span aria-hidden="true" className="path-marker marker-one" />
            <span aria-hidden="true" className="path-marker marker-two" />
          </div>
          <div className="path-card-content">
            {session ? (
              <div className="path-account-pill">
                <span className="status-dot" /> Angemeldet als {learnerName}
              </div>
            ) : null}
            <p className="card-kicker">DEIN STARTPUNKT</p>
            <h3>Saludos</h3>
            <p className="path-card-copy">
              Begrüße andere, frage wie es ihnen geht und verabschiede dich —
              deine ersten Gespräche beginnen hier.
            </p>
            <div className="path-tags">
              <span>Erste Schritte</span>
              <span>Alltags-Spanisch</span>
            </div>
            <button className="button button-dark" onClick={startLesson}>
              {session ? "Lektion ansehen" : "Kostenlos anfangen"} <ArrowIcon />
            </button>
            <p className="path-card-note">
              {session
                ? "Die Lernpfad-Vorschau ist bereit."
                : "Ein Konto genügt, um deinen Lernpfad zu öffnen."}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="idea-title" className="idea-section" id="idee">
        <div className="idea-copy">
          <p className="section-eyebrow">WENIGER DRUCK. MEHR SPANISCH.</p>
          <h2 id="idea-title">Eine Sprache wächst<br />mit jedem kleinen Schritt.</h2>
        </div>
        <div className="idea-points">
          <article className="idea-point">
            <span className="idea-number">01</span>
            <div>
              <h3>Mach es dir leicht.</h3>
              <p>Ein übersichtlicher Lernpfad hilft dir, einfach anzufangen.</p>
            </div>
          </article>
          <article className="idea-point">
            <span className="idea-number">02</span>
            <div>
              <h3>Komm regelmäßig zurück.</h3>
              <p>Kurze Einheiten machen aus Lernen eine Gewohnheit.</p>
            </div>
          </article>
          <article className="idea-point">
            <span className="idea-number">03</span>
            <div>
              <h3>Lern für echte Gespräche.</h3>
              <p>Starte mit den Ausdrücken, die du im Alltag wirklich brauchst.</p>
            </div>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <a aria-label="Camino – zurück nach oben" className="brand footer-brand" href="#start">
          <CaminoMark />
          <span className="brand-wordmark">camino<span>.</span></span>
        </a>
        <p>Dein Weg zu Spanisch. Schritt für Schritt.</p>
        <span className="footer-language">Hecho con cariño <span aria-hidden="true">♥</span></span>
      </footer>

      {authOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="auth-title"
            aria-modal="true"
            className="dialog auth-dialog"
            role="dialog"
          >
            <button
              aria-label="Dialog schließen"
              className="dialog-close"
              onClick={() => setAuthOpen(false)}
              type="button"
            >
              <CloseIcon />
            </button>
            <div className="dialog-brand"><CaminoMark /></div>
            <p className="section-eyebrow">DEIN WEG BEGINNT HIER</p>
            <h2 id="auth-title">
              {authMode === "signup" ? "Hola, schön dich zu sehen." : "Willkommen zurück."}
            </h2>
            <p className="dialog-intro">
              {authMode === "signup"
                ? "Erstelle dein kostenloses Konto und mach den ersten Schritt."
                : "Melde dich an und setze deinen Weg fort."}
            </p>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "signup" ? (
                <label className="field-label">
                  Wie dürfen wir dich nennen?
                  <input
                    autoComplete="name"
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Dein Name"
                    value={displayName}
                  />
                </label>
              ) : null}
              <label className="field-label">
                E-Mail-Adresse
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="du@beispiel.de"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="field-label">
                Passwort
                <input
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  required
                  type="password"
                  value={password}
                />
              </label>
              {authError ? (
                <p className="form-feedback form-error" role="alert">{authError}</p>
              ) : null}
              {authMessage ? (
                <p className="form-feedback form-success" role="status">{authMessage}</p>
              ) : null}
              <button className="button button-primary auth-submit" disabled={authBusy} type="submit">
                {authBusy
                  ? "Einen Moment …"
                  : authMode === "signup"
                    ? "Kostenloses Konto erstellen"
                    : "Anmelden"}
                {!authBusy ? <ArrowIcon /> : null}
              </button>
            </form>
            <p className="auth-switch">
              {authMode === "signup" ? "Schon ein Konto?" : "Noch kein Konto?"}{" "}
              <button
                onClick={() => {
                  setAuthMode(authMode === "signup" ? "login" : "signup");
                  setAuthError("");
                  setAuthMessage("");
                }}
                type="button"
              >
                {authMode === "signup" ? "Anmelden" : "Jetzt registrieren"}
              </button>
            </p>
            {!isSupabaseConfigured() ? (
              <p className="config-note">
                Lokale Einrichtung fehlt noch: Trage die Supabase-Werte in <code>.env.local</code> ein.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {lessonOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="lesson-title"
            aria-modal="true"
            className="dialog lesson-dialog"
            role="dialog"
          >
            <button
              aria-label="Lektion schließen"
              className="dialog-close"
              onClick={() => setLessonOpen(false)}
              type="button"
            >
              <CloseIcon />
            </button>
            <p className="section-eyebrow">LEKTION 01 · SALUDOS</p>
            <h2 id="lesson-title">¡Buenos días!</h2>
            <p className="dialog-intro">Was bedeutet dieser Gruß auf Deutsch?</p>
            <div className="answer-list">
              {answers.map((choice) => {
                const isCorrect = choice === "Buenos días";
                const isSelected = answer === choice;
                return (
                  <button
                    aria-pressed={isSelected}
                    className={`answer-option${isSelected ? (isCorrect ? " answer-correct" : " answer-wrong") : ""}`}
                    key={choice}
                    onClick={() => setAnswer(choice)}
                    type="button"
                  >
                    <span className="answer-radio">{isSelected ? (isCorrect ? "✓" : "×") : ""}</span>
                    {choice}
                  </button>
                );
              })}
            </div>
            {answer ? (
              <p className={`answer-feedback${answer === "Buenos días" ? " feedback-correct" : " feedback-wrong"}`} role="status">
                {answer === "Buenos días"
                  ? "¡Muy bien! „Buenos días“ heißt „Guten Morgen“."
                  : "Fast! „Buenos días“ bedeutet „Guten Morgen“. Versuch es noch einmal."}
              </p>
            ) : null}
            <p className="preview-disclaimer">
              Interaktive Vorschau. Die originale Canvas-Lektion und das Speichern von XP,
              Streaks und Wiederholungen werden ergänzt, sobald ihr Seitencode vorliegt.
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}
