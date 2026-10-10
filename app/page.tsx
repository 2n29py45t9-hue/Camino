"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

// Verbindet sich mit deiner Camino-Datenbank (RLS schützt alle Daten).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ---------------- Typen ---------------- */

type Unit = {
  id: string;
  order_index: number;
  title_es: string;
  title_de: string;
  icon: string | null;
  lessons: Lesson[];
};

type Lesson = {
  id: string;
  unit_id: string;
  order_index: number;
  title_es: string;
  title_de: string;
  lesson_type: string;
  xp_reward: number;
};

type Exercise = {
  id: string;
  order_index: number;
  exercise_type: string;
  prompt: any;
  solution: any;
};

type Profile = {
  id: string;
  display_name: string | null;
  total_xp: number;
  streak_count: number;
  streak_last_active: string | null;
  daily_goal_minutes: number;
  learning_goal: string | null;
  cefr_level: string;
};

/* ---------------- App ---------------- */

export default function CaminoApp() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [dueCount, setDueCount] = useState(0);
  const [view, setView] = useState<{ name: "path" } | { name: "lesson"; lesson: Lesson } | { name: "review" } | { name: "profile" } | { name: "mywords" }>({ name: "path" });
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async (uid: string) => {
    const [u, lc, p, srs] = await Promise.all([
      supabase.from("units").select("*, lessons(*)").order("order_index"),
      supabase.from("lesson_completions").select("lesson_id").eq("profile_id", uid),
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase.from("srs_cards").select("id").eq("profile_id", uid).lte("due_at", new Date().toISOString()),
    ]);
    if (u.data) {
      setUnits((u.data as any[]).map((x) => ({ ...x, lessons: (x.lessons as any[]).sort((a, b) => a.order_index - b.order_index) })));
    }
    if (lc.data) setCompletedLessonIds(new Set(lc.data.map((r: any) => r.lesson_id)));
    if (p.data) setProfile(p.data as Profile);
    setDueCount(srs.data?.length ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadAll(data.session.user.id);
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) loadAll(s.user.id);
      else setLoading(false);
    });
    setReady(true);
    return () => sub.subscription.unsubscribe();
  }, [loadAll]);

  if (loading || !ready) {
    return <main className="min-h-screen flex items-center justify-center text-2xl">🌱 camino lädt …</main>;
  }

  if (!session) return <AuthScreen onDone={() => setLoading(true)} />;

  // Erste Anmeldung: Lernziel auswählen, bevor der Lernpfad startet.
  if (profile && profile.learning_goal == null) {
    return <OnboardingScreen profile={profile} onDone={() => loadAll(session.user.id)} />;
  }

  if (view.name === "profile") {
    return (
      <ProfileScreen
        profile={profile}
        userId={session.user.id}
        onBack={() => { loadAll(session.user.id); setView({ name: "path" }); }}
        onPracticeWords={() => setView({ name: "mywords" })}
      />
    );
  }

  if (view.name === "mywords") {
    return <MyWordsScreen userId={session.user.id} onBack={() => setView({ name: "profile" })} />;
  }

  if (view.name === "lesson") {
    return (
      <LessonPlayer
        lesson={view.lesson}
        profile={profile}
        userId={session.user.id}
        onExit={() => setView({ name: "path" })}
        onFinished={() => {
          loadAll(session.user.id);
          setView({ name: "path" });
        }}
      />
    );
  }

  if (view.name === "review") {
    return <ReviewScreen userId={session.user.id} onExit={() => setView({ name: "path" })} />;
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between text-sm font-bold">
          <span className="text-orange-500">🔥 {profile?.streak_count ?? 0}</span>
          <span className="text-lg font-extrabold text-[#58CC02]">camino</span>
          <button className="text-xl" title="Profil" onClick={() => setView({ name: "profile" })}>👤</button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6">
        {dueCount > 0 && (
          <button onClick={() => setView({ name: "review" })}
            className="w-full mb-5 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-left">
            <div className="font-extrabold text-amber-600">🔁 {dueCount} Wiederholung{dueCount > 1 ? "en" : ""} fällig</div>
            <div className="text-xs text-gray-500">Camino hat geplant, was du jetzt auffrischen solltest.</div>
          </button>
        )}

        <PathView
          units={units}
          completed={completedLessonIds}
          onStart={(lesson) => setView({ name: "lesson", lesson })}
        />

        <div className="mt-6 text-center text-xs text-gray-400">
          ⚡ {profile?.total_xp ?? 0} XP · Serien-Tag {profile?.streak_last_active ?? "–"}
        </div>
      </div>
    </main>
  );
}

/* ---------------- Auth ---------------- */

function AuthScreen({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    setMsg("");
    const fn = mode === "signup" ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { error } = await fn({ email, password });
    if (error) { setMsg(error.message); return; }
    if (mode === "signup") setMsg("Prüfe dein Postfach zur Bestätigung – oder deaktiviere „Confirm email“ im Supabase-Dashboard.");
    onDone();
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-8 gap-4">
      <div className="text-6xl">🌿</div>
      <h1 className="text-3xl font-extrabold text-[#58CC02]">camino</h1>
      <p className="text-sm text-gray-400 text-center">Dein Weg zu Spanisch – kostenlos, adaptiv, ohne Paywall.</p>
      <div className="w-full max-w-sm flex flex-col gap-3 mt-2">
        <input className="border-2 border-gray-200 rounded-2xl px-4 py-3" type="email" placeholder="E-Mail"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border-2 border-gray-200 rounded-2xl px-4 py-3" type="password" placeholder="Passwort (min. 6 Zeichen)"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="bg-[#58CC02] text-white font-extrabold rounded-2xl px-6 py-3 border-b-4 border-[#46A302]"
          onClick={submit}>
          {mode === "signup" ? "Konto erstellen" : "Einloggen"}
        </button>
        <button className="text-sm text-[#1CB0F6] font-bold" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
          {mode === "signup" ? "Ich habe schon ein Konto" : "Neu hier? Konto erstellen"}
        </button>
        {msg && <div className="text-xs text-gray-500 text-center">{msg}</div>}
      </div>
    </main>
  );
}

/* ---------------- Lernpfad ---------------- */

function PathView({ units, completed, onStart }: { units: Unit[]; completed: Set<string>; onStart: (l: Lesson) => void }) {
  const offsets = [0, 40, 72, 40, 0, -40, -72, -40];
  let nextFound = false;

  return (
    <div className="flex flex-col gap-3">
      {units.map((unit) => {
        const unitLessons = unit.lessons;
        const unitDone = unitLessons.every((l) => completed.has(l.id));
        const unlocked = unit.order_index === 1 || units.find((u) => u.order_index === unit.order_index - 1)
          ?.lessons.every((l) => completed.has(l.id));
        return (
          <div key={unit.id}>
            <div className={`rounded-2xl p-3 mb-2 flex items-center gap-3 ${unlocked ? "bg-[#58CC02]" : "bg-gray-300"}`}>
              <span className="text-2xl">{unlocked ? (unit.icon ?? "📘") : "🔒"}</span>
              <div className="text-white flex-1">
                <div className="font-extrabold">{unit.title_es} <span className="text-xs opacity-70">· A1</span></div>
                <div className="text-xs opacity-80">{unit.title_de}</div>
              </div>
              {unitDone && <span className="text-white">✓</span>}
            </div>
            <div className="flex flex-col items-center">
              {unitLessons.map((lesson, li) => {
                const isDone = completed.has(lesson.id);
                const isNext = !nextFound && unlocked && !isDone;
                if (isNext) nextFound = true;
                const playable = isDone || isNext;
                return (
                  <div key={lesson.id} className="flex flex-col items-center">
                    <button
                      disabled={!playable}
                      onClick={() => playable && onStart(lesson)}
                      className={`w-16 h-16 rounded-full text-2xl flex items-center justify-center border-b-4 ${isDone ? "bg-[#58CC02] border-[#46A302] text-white" : isNext ? "bg-[#FFC800] border-[#E0AC00] text-white" : "bg-[#E5E5E5] border-[#C9C9C9] text-gray-400"}`}
                      style={{ marginLeft: offsets[li % offsets.length] }}
                    >
                      {isDone ? "✓" : lesson.lesson_type === "review" ? "🔁" : lesson.lesson_type === "checkpoint" ? "🏆" : "★"}
                    </button>
                    <div className={`text-[10px] font-bold mt-1 mb-3 ${playable ? "text-gray-600" : "text-gray-400"}`}>
                      {lesson.title_es}{isNext && " ← EMPEZAR"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Audio: Aussprache (Web Speech API) ---------------- */

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch { /* TTS nicht verfügbar – Übung funktioniert trotzdem */ }
}

/* ---------------- Lektions-Player ---------------- */

function LessonPlayer({ lesson, profile, userId, onExit, onFinished }: {
  lesson: Lesson; profile: Profile | null; userId: string; onExit: () => void; onFinished: () => void;
}) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [feedback, setFeedback] = useState<null | { ok: boolean; correctText: string }>(null);
  const [input, setInput] = useState("");
  const [tiles, setTiles] = useState<number[]>([]);
  const [matchDone, setMatchDone] = useState<string[]>([]);
  const [matchSel, setMatchSel] = useState<string | null>(null);
  const [matchErr, setMatchErr] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("exercises").select("*").eq("lesson_id", lesson.id).order("order_index")
      .then(({ data }) => setExercises((data as Exercise[]) ?? []));
  }, [lesson.id]);

  if (!exercises) return <main className="min-h-screen flex items-center justify-center">Lektion lädt …</main>;
  if (exercises.length === 0) {
    return (
      <EmptyLesson lesson={lesson} onExit={onExit} />
    );
  }

	const exs: Exercise[] = exercises;
  const item = exs[idx];
  const p = item.prompt;

  function finish(ok: boolean, correctText: string) { setFeedback({ ok, correctText }); if (!ok) setWrongCount((w) => w + 1); }

  async function scheduleSrs(ok: boolean) {
    if (ok) return;
    const days = [1, 3, 7, 30];
    const { data: card } = await supabase.from("srs_cards")
      .select("id, reps").eq("profile_id", userId).eq("exercise_id", item.id).maybeSingle();
    const reps = (card?.reps ?? 0);
    const due = new Date(Date.now() + (days[Math.min(reps, 3)] ?? 1) * 86400000).toISOString();
    if (card?.id) {
      await supabase.from("srs_cards").update({ due_at: due, reps: reps + 1, last_review_at: new Date().toISOString() }).eq("id", card.id);
    } else {
      await supabase.from("srs_cards").insert({ profile_id: userId, exercise_id: item.id, due_at: due, reps: 1 });
    }
  }

  async function next() {
    const wasOk = feedback?.ok;
    await scheduleSrs(!!wasOk);
    setFeedback(null); setInput(""); setTiles([]); setMatchDone([]); setMatchSel(null); setMatchErr(0);
    if (idx + 1 >= exs.length) { await completeLesson(); } else { setIdx(idx + 1); }
  }

  async function completeLesson() {
    setSaving(true);
    const total = exs.length;
    const accuracy = (total - wrongCount) / total;
    const xp = lesson.xp_reward + (wrongCount === 0 ? 5 : 0);
    const today = new Date().toISOString().slice(0, 10);

    await supabase.from("lesson_completions").insert({
      profile_id: userId, lesson_id: lesson.id, accuracy, xp_earned: xp,
    });

    if (profile) {
      const isNewDay = profile.streak_last_active !== today;
      await supabase.from("profiles").update({
        total_xp: profile.total_xp + xp,
        streak_count: isNewDay ? profile.streak_count + 1 : profile.streak_count,
        streak_last_active: today,
      }).eq("id", userId);

      const { data: act } = await supabase.from("daily_activity").select("xp, minutes")
        .eq("profile_id", userId).eq("day", today).maybeSingle();
      await supabase.from("daily_activity").upsert({
        profile_id: userId, day: today,
        xp: (act?.xp ?? 0) + xp,
        minutes: (act?.minutes ?? 0) + 5,
        exercises_done: total,
      });
    }
    setSaving(false);
    onFinished();
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-4 border-b border-gray-100">
        <button onClick={onExit} className="text-xl text-gray-400">✕</button>
        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#58CC02] transition-all" style={{ width: `${((idx + (feedback ? 1 : 0)) / exercises.length) * 100}%` }} />
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-8">
        <div className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">
          {lesson.title_es} · {idx + 1}/{exercises.length}
        </div>

        {item.exercise_type === "new_word" && (
          <div className="text-center flex flex-col items-center gap-3">
            <div className="text-6xl">{p.emoji ?? "📘"}</div>
            <div className="text-3xl font-extrabold flex items-center justify-center gap-3">
              {p.word}
              <button onClick={() => speak(p.word)} className="text-xl text-[#1CB0F6]" title="Wort vorlesen">🔊</button>
            </div>
            <div className="text-xl text-gray-500">{p.translation}</div>
            {p.hint && <div className="text-sm text-gray-400">💡 {p.hint}</div>}
          </div>
        )}

        {item.exercise_type === "mc" && (
          <div className="flex flex-col gap-3">
            <div className="text-lg font-bold">{p.question}</div>
            {(p.options as string[]).map((o, i) => (
              <button key={i} disabled={!!feedback}
                onClick={() => finish(i === item.solution.correct, p.options[item.solution.correct])}
                className="px-4 py-3 rounded-2xl border-2 border-gray-200 font-bold text-left hover:bg-gray-50">
                {o}
              </button>
            ))}
          </div>
        )}

        {item.exercise_type === "cloze" && (
          <div className="flex flex-col gap-4">
            <div className="text-2xl font-bold text-center">{p.sentence}</div>
            <div className="text-sm text-gray-400 text-center">💡 {p.hint}</div>
            <input className="border-2 border-gray-200 rounded-2xl px-4 py-3 text-lg" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") finish(input.trim().toLowerCase() === item.solution.answer, item.solution.answer); }} />
          </div>
        )}

        {item.exercise_type === "word_bank" && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-bold">Übersetze: <span className="text-[#1CB0F6]">{p.sentence}</span></div>
            <div className="min-h-[48px] border-b-2 border-dashed border-gray-300 text-lg font-bold">
              {tiles.map((t) => p.tiles[t]).join(" ")}
            </div>
            <div className="flex flex-wrap gap-2">
              {(p.tiles as string[]).map((t, i) => (
                <button key={i} disabled={tiles.includes(i) || !!feedback} onClick={() => setTiles([...tiles, i])}
                  className="px-4 py-2 rounded-xl border-2 border-gray-200 font-bold disabled:opacity-20">{t}</button>
              ))}
            </div>
          </div>
        )}

        {item.exercise_type === "match" && (
          <div className="flex flex-col gap-4">
            <div className="text-lg font-bold">Ordne die Paare zu</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-3">
                {(p.pairs as any[]).map((pr) => (
                  <button key={pr.es} disabled={matchDone.includes(pr.es) || !!feedback}
                    onClick={() => setMatchSel(pr.es)}
                    className={`px-3 py-3 rounded-xl border-2 font-bold ${matchDone.includes(pr.es) ? "bg-green-50 border-[#58CC02] opacity-60" : matchSel === pr.es ? "border-[#1CB0F6] bg-blue-50" : "border-gray-200"}`}>
                    {pr.es}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {(p.pairs as any[]).map((pr) => (
                  <button key={pr.de} disabled={matchDone.includes(pr.de) || !!feedback}
                    onClick={() => {
                      if (matchSel === pr.es) {
                        const nd = [...matchDone, pr.es, pr.de];
                        setMatchDone(nd); setMatchSel(null);
                        if (nd.length >= (p.pairs as any[]).length * 2 && matchErr === 0) finish(true, "Alle Paare richtig!");
                        else if (nd.length >= (p.pairs as any[]).length * 2) finish(false, "Mit Fehlern – Paare wiederholen!");
                      } else { setMatchErr(matchErr + 1); setMatchSel(null); }
                    }}
                    className={`px-3 py-3 rounded-xl border-2 font-bold ${matchDone.includes(pr.de) ? "bg-green-50 border-[#58CC02] opacity-60" : "border-gray-200"}`}>
                    {pr.de}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <div className={`max-w-md mx-auto px-6 pb-6 ${feedback.ok ? "text-[#58CC02]" : "text-[#FF4B4B]"}`}>
          <div className="font-extrabold mb-1">{feedback.ok ? "¡Perfecto!" : "Richtig wäre:"}</div>
          <div className="text-sm text-gray-500 mb-3">{feedback.ok ? "Weiter so 🌿" : feedback.correctText}</div>
          <button className="w-full bg-[#58CC02] text-white font-extrabold rounded-2xl px-6 py-3 border-b-4 border-[#46A302]"
            onClick={next} disabled={saving}>
            {saving ? "Speichern …" : idx + 1 >= exercises.length ? "Abschließen" : "Weiter"}
          </button>
        </div>
      )}
      {!feedback && (
        <div className="max-w-md mx-auto px-6 pb-6">
          <button className="w-full bg-[#58CC02] text-white font-extrabold rounded-2xl px-6 py-3 border-b-4 border-[#46A302] disabled:opacity-40"
            disabled={
              item.exercise_type === "new_word" ? false :
              item.exercise_type === "match" ? true :
              item.exercise_type === "mc" ? true :
              item.exercise_type === "cloze" ? input.trim().length === 0 :
              tiles.length === 0
            }
            onClick={() => {
              if (item.exercise_type === "new_word") finish(true, "");
              if (item.exercise_type === "cloze") finish(input.trim().toLowerCase() === item.solution.answer, item.solution.answer);
              if (item.exercise_type === "word_bank") finish(tiles.map((t) => p.tiles[t]).join(" ") === item.solution.answer, item.solution.answer);
            }}>
            {item.exercise_type === "new_word" ? "Verstanden – Weiter" : "Prüfen"}
          </button>
        </div>
      )}
    </main>
  );
}

function EmptyLesson({ lesson, onExit }: { lesson: Lesson; onExit: () => void }) {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-8 gap-4 text-center">
      <div className="text-5xl">🚧</div>
      <h2 className="text-xl font-extrabold">{lesson.title_es}</h2>
      <p className="text-sm text-gray-500">
        Diese Lektion ist im Lernpfad angelegt, ihre Übungen folgen bald. Camino befüllt die Datenbank laufend weiter.
      </p>
      <button className="text-[#1CB0F6] font-bold text-sm" onClick={onExit}>Zurück zum Lernpfad</button>
    </main>
  );
}

/* ---------------- Wiederholen (SRS) ---------------- */

function ReviewScreen({ userId, onExit }: { userId: string; onExit: () => void }) {
  const [cards, setCards] = useState<any[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [ok, setOk] = useState<null | boolean>(null);

  useEffect(() => {
    supabase.from("srs_cards").select("id, exercises!inner(id, prompt, solution)").eq("profile_id", userId)
      .lte("due_at", new Date().toISOString()).limit(10)
      .then(({ data }) => setCards((data as any[]) ?? []));
  }, [userId]);

  if (!cards) return <main className="min-h-screen flex items-center justify-center">Wiederholungen laden …</main>;
  if (cards.length === 0) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🎉</div>
        <p className="text-sm text-gray-500">Keine Wiederholungen fällig. ¡Muy bien!</p>
        <button className="text-[#1CB0F6] font-bold" onClick={onExit}>Zurück</button>
      </main>
    );
  }
  if (idx >= cards.length) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🧠</div>
        <p className="text-sm text-gray-500">Wiederholung abgeschlossen. Camino verschiebt die Karten neu.</p>
        <button className="text-[#1CB0F6] font-bold" onClick={onExit}>Zurück</button>
      </main>
    );
  }

	const cardList: any[] = cards;
  const ex = cards[idx].exercises;
  const p = ex.prompt;
  const isWord = typeof p.word === "string";
  const question = isWord ? p.word : p.question ?? p.sentence;
  const answerText = isWord ? p.translation : p.options?.[ex.solution.correct] ?? ex.solution.answer;

  async function answer(okk: boolean) {
    const cardId = cardsList[idx].id;
    const days = [1, 3, 7, 30];
    const due = new Date(Date.now() + (okk ? days[Math.min(idx % 3 + 1, 3)] : 1) * 86400000).toISOString();
    await supabase.from("srs_cards").update({ due_at: due, last_review_at: new Date().toISOString() }).eq("id", cardId);
    setOk(okk);
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-6 py-10 flex flex-col gap-4">
        <div className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Wiederholung · {idx + 1}/{cards.length}</div>
        <div className="text-sm text-gray-400">Was bedeutet …</div>
        <div className="text-3xl font-extrabold flex items-center gap-3">
          {question}
          {isWord && <button className="text-xl text-[#1CB0F6]" title="Wort vorlesen" onClick={() => speak(question)}>🔊</button>}
        </div>
        <div className="flex flex-col gap-3 mt-2">
          <button className="px-4 py-3 rounded-2xl border-2 border-[#58CC02] font-bold text-[#58CC02] bg-green-50"
            onClick={() => ok === null && answer(true)}>Gewusst ✓</button>
          <button className="px-4 py-3 rounded-2xl border-2 border-[#FF4B4B] font-bold text-[#FF4B4B] bg-red-50"
            onClick={() => ok === null && answer(false)}>Nochmal üben ↻</button>
        </div>
        {ok !== null && (
          <>
            <div className={`font-extrabold ${ok ? "text-[#58CC02]" : "text-[#FF4B4B]"}`}>{ok ? "Richtig!" : "Kommt bald wieder"}</div>
            <div className="text-lg font-bold">{answerText}</div>
            <button className="bg-[#58CC02] text-white font-extrabold rounded-2xl px-6 py-3 border-b-4 border-[#46A302]"
              onClick={() => { setOk(null); setIdx(idx + 1); }}>
              {idx + 1 >= cards.length ? "Fertig" : "Nächste Karte"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

/* ---------------- Ziel-Onboarding ---------------- */

const GOALS = [
  { key: "reisen", icon: "🌎", title: "Reisen", desc: "Unterwegs fragen, einkaufen, navigieren" },
  { key: "schule", icon: "🎓", title: "Schule", desc: "Vokabeln & Grammatik für den Unterricht" },
  { key: "beruf", icon: "💼", title: "Beruf", desc: "E-Mails, Meetings, Smalltalk" },
  { key: "alltag", icon: "🇪🇸", title: "Alltag", desc: "Der komplette Weg von A1 bis B1" },
];

const GOAL_LABELS: Record<string, string> = { reisen: "🌎 Reisen", schule: "🎓 Schule", beruf: "💼 Beruf", alltag: "🇪🇸 Alltag" };

function OnboardingScreen({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [saving, setSaving] = useState(false);

  async function pick(goal: string) {
    if (saving) return;
    setSaving(true);
    await supabase.from("profiles").update({ learning_goal: goal }).eq("id", profile.id);
    onDone();
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-8 py-16 max-w-md mx-auto">
      <div className="text-6xl mb-4">🌿</div>
      <h1 className="text-2xl font-extrabold">¡Bienvenido a Camino!</h1>
      <p className="text-sm text-gray-500 text-center mt-2 mb-8">
        Wofür lernst du Spanisch? Camino merkt sich dein Ziel und passt Empfehlungen und Wiederholungen daran an.
      </p>
      <div className="w-full flex flex-col gap-3">
        {GOALS.map((g) => (
          <button key={g.key} disabled={saving} onClick={() => pick(g.key)}
            className="w-full text-left px-4 py-4 rounded-2xl border-2 border-gray-200 hover:border-[#1CB0F6] hover:bg-blue-50 flex items-center gap-4">
            <span className="text-3xl">{g.icon}</span>
            <span>
              <span className="block font-extrabold">{g.title}</span>
              <span className="block text-xs text-gray-500">{g.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}

/* ---------------- Profil mit Wochenstatistik ---------------- */

function ProfileScreen({ profile, userId, onBack, onPracticeWords }: { profile: Profile | null; userId: string; onBack: () => void; onPracticeWords: () => void }) {
  const [week, setWeek] = useState<{ day: string; xp: number; minutes: number; exercises_done: number }[] | null>(null);
  const [lessonsDone, setLessonsDone] = useState(0);
  const [goal, setGoal] = useState<string | null>(profile?.learning_goal ?? null);
  const [matTitle, setMatTitle] = useState("");
  const [matText, setMatText] = useState("");
  const [matMsg, setMatMsg] = useState("");
  const [matSaving, setMatSaving] = useState(false);
  const [materials, setMaterials] = useState<{ id: string; title: string; derived_exercises: number }[]>([]);
  const [dueWords, setDueWords] = useState(0);

  async function refreshMaterials() {
    const [mats, dw] = await Promise.all([
      supabase.from("user_materials").select("id, title, derived_exercises").eq("profile_id", userId).order("created_at", { ascending: false }),
      supabase.from("user_words").select("id", { count: "exact", head: true }).eq("profile_id", userId).lte("due_at", new Date().toISOString()),
    ]);
    const list = ((mats.data as any[]) ?? []);
    setMaterials(list);
    setDueWords((dw as any).count ?? 0);
    const n = list[0]?.derived_exercises ?? 0;
    setMatMsg(n > 0
      ? `Gespeichert! 🌱 ${n} Vokabelkarte${n > 1 ? "n" : ""} automatisch erstellt – direkt bei „Meine Wörter“ wiederholbar.`
      : "Gespeichert – aber keine Vokabeln erkannt. Tipp: eine Karte pro Zeile, z. B. „hola = Hallo“.");
  }

  useEffect(() => {
    const from = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    Promise.all([
      supabase.from("daily_activity").select("day, xp, minutes, exercises_done")
        .eq("profile_id", userId).gte("day", from).order("day"),
      supabase.from("lesson_completions").select("id", { count: "exact", head: true }).eq("profile_id", userId),
      supabase.from("user_materials").select("id, title, derived_exercises").eq("profile_id", userId).order("created_at", { ascending: false }),
      supabase.from("user_words").select("id", { count: "exact", head: true }).eq("profile_id", userId).lte("due_at", new Date().toISOString()),
    ]).then(([act, lc, mats, dw]) => {
      const map = new Map(((act.data as any[]) ?? []).map((r) => [r.day, r]));
      const days: { day: string; xp: number; minutes: number; exercises_done: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        const row: any = map.get(d);
        days.push({ day: d, xp: row?.xp ?? 0, minutes: row?.minutes ?? 0, exercises_done: row?.exercises_done ?? 0 });
      }
      setWeek(days);
      setLessonsDone((lc as any).count ?? 0);
      setMaterials(((mats.data as any[]) ?? []));
      setDueWords((dw as any).count ?? 0);
    });
  }, [userId]);

  async function changeGoal(g: string) {
    setGoal(g);
    await supabase.from("profiles").update({ learning_goal: g }).eq("id", userId);
  }

  async function uploadMaterial() {
    if (!matTitle.trim() || !matText.trim()) { setMatMsg("Bitte Titel und Text eingeben."); return; }
    setMatSaving(true);
    const { error } = await supabase.from("user_materials")
      .insert({ profile_id: userId, title: matTitle.trim(), material_type: "text", content: matText.trim() });
    setMatSaving(false);
    if (error) { setMatMsg(error.message); return; }
    setMatTitle(""); setMatText("");
    await refreshMaterials();
  }

  const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const weekXp = (week ?? []).reduce((s, d) => s + d.xp, 0);
  const weekMin = (week ?? []).reduce((s, d) => s + d.minutes, 0);
  const maxXp = Math.max(10, ...(week ?? []).map((d) => d.xp));

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <button className="text-xl text-gray-400" onClick={onBack}>←</button>
          <h1 className="text-lg font-extrabold">Profil</h1>
          <button className="text-xs text-gray-400 font-bold" onClick={async () => { await supabase.auth.signOut(); }}>Abmelden</button>
        </div>

        {/* Konto */}
        <div className="bg-white rounded-2xl p-4 flex items-center gap-4 border border-gray-100 mb-4">
          <div className="w-14 h-14 rounded-full bg-[#58CC02] text-white text-2xl flex items-center justify-center font-extrabold">
            {(profile?.display_name ?? "C").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-extrabold">{profile?.display_name ?? "Camino-Lerner"}</div>
            <div className="text-xs text-gray-500">
              Spanisch · Niveau {profile?.cefr_level ?? "A1"} · Ziel: {goal ? GOAL_LABELS[goal] : "–"}
            </div>
          </div>
        </div>

        {/* Statistik + Woche */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div><div className="text-xl font-extrabold text-amber-500">🔥 {profile?.streak_count ?? 0}</div><div className="text-[10px] text-gray-400 font-bold">SERIE (TAGE)</div></div>
            <div><div className="text-xl font-extrabold text-[#58CC02]">⚡ {profile?.total_xp ?? 0}</div><div className="text-[10px] text-gray-400 font-bold">XP GESAMT</div></div>
            <div><div className="text-xl font-extrabold text-[#1CB0F6]">✓ {lessonsDone}</div><div className="text-[10px] text-gray-400 font-bold">LEKTIONEN</div></div>
          </div>
          <div className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2">
            Diese Woche · {weekXp} XP · {weekMin} Min.
          </div>
          <div className="flex items-end justify-between gap-2 h-28">
            {(week ?? []).map((d) => {
              const h = Math.max(4, Math.round((d.xp / maxXp) * 90));
              const dow = dayNames[new Date(d.day + "T12:00:00").getDay()];
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg bg-[#58CC02]" style={{ height: `${h}px`, opacity: d.xp > 0 ? 1 : 0.2 }} />
                  <div className="text-[10px] text-gray-400 font-bold">{dow}</div>
                </div>
              );
            })}
          </div>
          <div className="text-[11px] text-gray-400 mt-2">Tagesziel: {profile?.daily_goal_minutes ?? 10} Min.</div>
        </div>

        {/* Lernziel */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <div className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3">Lernziel anpassen</div>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map((g) => (
              <button key={g.key} onClick={() => changeGoal(g.key)}
                className={`px-3 py-3 rounded-xl border-2 font-bold text-sm ${goal === g.key ? "border-[#58CC02] bg-green-50 text-[#58CC02]" : "border-gray-200 text-gray-600"}`}>
                {g.icon} {g.title}
              </button>
            ))}
          </div>
        </div>

        {/* Eigenes Material */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <div className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-1">Eigenes Material</div>
          <p className="text-[11px] text-gray-500 mb-3">
            Füge Vokabeln oder Texte aus der Schule ein – Camino baut daraus automatisch Übungen.
          </p>
          <input className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm mb-2"
            placeholder="Titel, z. B. „Unit 3 Vokabeln“" value={matTitle} onChange={(e) => setMatTitle(e.target.value)} />
          <textarea className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm mb-2 h-24"
            placeholder="Text oder Vokabelliste einfügen …" value={matText} onChange={(e) => setMatText(e.target.value)} />
          <button className="w-full bg-[#1CB0F6] text-white font-extrabold rounded-xl px-4 py-2 border-b-4 border-[#1899D6] text-sm"
            disabled={matSaving} onClick={uploadMaterial}>
            {matSaving ? "Speichern …" : "Material hochladen"}
          </button>
          {matMsg && <div className="text-[11px] text-gray-500 mt-2">{matMsg}</div>}
          {materials.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {materials.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs bg-neutral-50 rounded-xl px-3 py-2">
                  <span className="font-bold text-gray-700 truncate">{m.title}</span>
                  <span className="text-gray-400 whitespace-nowrap">{m.derived_exercises} Karten</span>
                </div>
              ))}
              {dueWords > 0 && (
                <button className="w-full bg-amber-50 border-2 border-amber-200 rounded-xl px-3 py-3 font-extrabold text-amber-600 text-sm"
                  onClick={onPracticeWords}>
                  🔁 {dueWords} eigene Wort{dueWords > 1 ? "e" : ""} zum Wiederholen
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ---------------- Meine Wörter (aus eigenem Material, FSRS-artig) ---------------- */

function MyWordsScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [cards, setCards] = useState<{ id: string; es: string; de: string; reps: number }[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState<null | boolean>(null);

  useEffect(() => {
    supabase.from("user_words").select("id, es, de, reps")
      .eq("profile_id", userId).lte("due_at", new Date().toISOString())
      .order("due_at").limit(15)
      .then(({ data }) => setCards((data as any[]) ?? []));
  }, [userId]);

  if (!cards) return <main className="min-h-screen flex items-center justify-center">Wörter laden …</main>;

  if (cards.length === 0) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 text-center px-8">
        <div className="text-6xl">🌱</div>
        <p className="text-sm text-gray-500">
          Gerade ist keines deiner eigenen Wörter dran. Camino plant sie genau dann wieder ein, wenn du sie brauchst.
        </p>
        <button className="text-[#1CB0F6] font-bold" onClick={onBack}>Zurück</button>
      </main>
    );
  }

  if (idx >= cards.length) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 text-center px-8">
        <div className="text-6xl">🧠</div>
        <p className="text-sm text-gray-500">Alle eigenen Wörter aufgefrischt. ¡Muy bien!</p>
        <button className="bg-[#58CC02] text-white font-extrabold rounded-2xl px-6 py-3 border-b-4 border-[#46A302]" onClick={onBack}>
          Zurück zum Profil
        </button>
      </main>
    );
  }

  const c = cards[idx];

  async function answer(knew: boolean) {
    if (answered !== null) return;
    const days = [1, 3, 7, 30];
    const due = new Date(Date.now() + (knew ? days[Math.min(c.reps, 3)] : 1) * 86400000).toISOString();
    await supabase.from("user_words").update({
      due_at: due,
      reps: knew ? c.reps + 1 : 0,
      last_review_at: new Date().toISOString(),
    }).eq("id", c.id);
    setAnswered(knew);
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-6 py-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button className="text-xl text-gray-400" onClick={onBack}>←</button>
          <div className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Meine Wörter · {idx + 1}/{cards.length}</div>
          <span className="w-5" />
        </div>
        <div className="text-sm text-gray-400">Was bedeutet …</div>
        <div className="text-3xl font-extrabold flex items-center gap-3">
          {c.es}
          <button className="text-xl text-[#1CB0F6]" title="Wort vorlesen" onClick={() => speak(c.es)}>🔊</button>
        </div>
        <div className="flex flex-col gap-3 mt-2">
          <button className="px-4 py-3 rounded-2xl border-2 border-[#58CC02] font-bold text-[#58CC02] bg-green-50"
            onClick={() => answer(true)}>Gewusst ✓</button>
          <button className="px-4 py-3 rounded-2xl border-2 border-[#FF4B4B] font-bold text-[#FF4B4B] bg-red-50"
            onClick={() => answer(false)}>Nochmal üben ↻</button>
        </div>
        {answered !== null && (
          <>
            <div className={`font-extrabold ${answered ? "text-[#58CC02]" : "text-[#FF4B4B]"}`}>
              {answered ? "¡Perfecto!" : "Kommt morgen wieder"}
            </div>
            <div className="text-lg font-bold">{c.de}</div>
            <button className="bg-[#58CC02] text-white font-extrabold rounded-2xl px-6 py-3 border-b-4 border-[#46A302]"
              onClick={() => { setAnswered(null); setIdx(idx + 1); }}>
              {idx + 1 >= cards.length ? "Fertig" : "Nächstes Wort"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}