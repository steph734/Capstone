import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Volume2 } from "lucide-react";
import SunnyScenery from "../../pages/games/SunnyScenery";
import GameFinishScreen from "../GameFinishScreen";
import { buildRounds, initRound, pick } from "./feedPao";

// Feed Pao: listen to a direction, then give Pao the right food, in order.
// Rules and wording live in feedPao.js; this file draws, speaks and picks Pao's pose.
// The folder name is case-sensitive on Vercel: keep "Feed_Pao_SVGs" exactly.
const FEED_PAO_BASE = "/games/Feed_Pao_SVGs";
const POSES = [
  "pao-feed-hello", "pao-feed-hungry", "pao-feed-asking", "pao-feed-waiting", "pao-feed-hint",
  "pao-feed-eating", "pao-feed-yum", "pao-feed-not-this", "pao-feed-full", "pao-feed-thanks",
];
const poseSrc = (p) => `${FEED_PAO_BASE}/${p}.svg`;

const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" };
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" };
const HIGHLIGHT = "#E8A100";
const FOOD_EMOJI = {
  banana: "🍌", milk: "🥛", carrot: "🥕", bread: "🍞", water: "💧", cookie: "🍪",
  apple: "🍎", apple_red: "🍎", apple_green: "🍏", "red apple": "🍎", "green apple": "🍏",
  candy: "🍬", chips: "🥔", soda: "🥤", fries: "🍟",
};
const FOOD_CLUE = {
  banana: "yellow", milk: "white", carrot: "orange", apple: "red", "red apple": "red", "green apple": "green",
  bread: "brown", cookie: "brown", water: "blue", candy: "sweet", chips: "crunchy", soda: "fizzy", fries: "golden",
};
const SPEECH_RATE = 0.8;
const SPEECH_PITCH = 1.15;
const HUNGRY_MS = 1000;
const EATING_MS = 1200;
const IDLE_HINT_MS = 6000;
const NEXT_MS = 2300;

let posesPreloaded = false;
function preloadPoses() {
  if (posesPreloaded || typeof Image === "undefined") return;
  posesPreloaded = true;
  POSES.forEach((p) => { new Image().src = poseSrc(p); });
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Pao with a soft 200 ms cross-fade between poses (no fade when reduced motion is on).
function PaoPose({ pose, width }) {
  const [shown, setShown] = useState(pose);
  const [prev, setPrev] = useState(null);
  const t = useRef(null);
  useEffect(() => {
    if (pose === shown) return undefined;
    if (prefersReducedMotion()) { setShown(pose); setPrev(null); return undefined; }
    setPrev(shown);
    setShown(pose);
    clearTimeout(t.current);
    t.current = setTimeout(() => setPrev(null), 200);
    return () => clearTimeout(t.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose]);
  const layer = (p, anim) => (
    <img key={p} src={poseSrc(p)} alt={anim === "out" ? "" : "Pao"} aria-hidden={anim === "out" ? true : undefined} draggable={false}
      className="absolute inset-0 h-full w-full object-contain"
      style={anim ? { animation: `fpFade${anim === "in" ? "In" : "Out"} .2s ease both` } : undefined} />
  );
  return (
    <div className="relative" style={{ width, aspectRatio: "4 / 5" }}>
      <style>{`@keyframes fpFadeIn{from{opacity:0}to{opacity:1}}@keyframes fpFadeOut{from{opacity:1}to{opacity:0}}@keyframes fpShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
      {prev && layer(prev, "out")}
      {layer(shown, prev ? "in" : null)}
    </div>
  );
}

// Wraps every food name in `text` in the highlight colour.
function Highlighted({ text, words }) {
  const list = [...new Set(words.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!text || !list.length) return text;
  const re = new RegExp(`(${list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) => (list.some((w) => w.toLowerCase() === part.toLowerCase())
    ? <span key={i} style={{ color: HIGHLIGHT }}>{part}</span>
    : part));
}

export default function FeedPao({ game, onExit, onComplete }) {
  const rounds = useMemo(() => buildRounds(game), [game]);
  const showWordsDefault = game.typeSettings?.choose_picture?.show_words_default !== false;
  const readAloud = game.support?.read_aloud !== false;
  const reduced = prefersReducedMotion();

  const [roundIdx, setRoundIdx] = useState(0);
  const [state, setState] = useState(initRound);
  const [showWords, setShowWords] = useState(showWordsDefault);
  const [done, setDone] = useState(false);
  const [stars, setStars] = useState(0);
  const [pose, setPose] = useState("pao-feed-hello");
  const [line, setLine] = useState("");
  const [ready, setReady] = useState(false); // cards react once Pao has asked
  const [chosenKey, setChosenKey] = useState(null);
  const [shakeKey, setShakeKey] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  const timers = useRef([]);
  const speakGen = useRef(0);
  const totals = useRef({ attempts: 0, hints: 0 });
  const answers = useRef([]);
  const target = useRef({ attempts: 0, hintUsed: false, startedAt: Date.now() });
  const reportedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const roundIdxRef = useRef(0);
  roundIdxRef.current = roundIdx;

  const round = rounds[roundIdx];
  const levelRounds = rounds.filter((r) => r.levelOrder === round?.levelOrder);
  const levelIndex = levelRounds.indexOf(round);

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id; };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // Speak and call onEnd when finished (or after a short pause if speech is off/unavailable).
  const say = (text, onEnd) => {
    setLine(text || "");
    const gen = ++speakGen.current;
    const finish = () => { if (gen === speakGen.current) onEnd?.(); };
    if (!readAloud || !text || typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (onEnd) later(finish, 900);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = SPEECH_RATE;
      u.pitch = SPEECH_PITCH;
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
    } catch { finish(); }
  };
  // Reads text without touching Pao's pose or the speech bubble.
  const readOnly = (text) => {
    if (!readAloud || !text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      speakGen.current += 1;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = SPEECH_RATE;
      u.pitch = SPEECH_PITCH;
      window.speechSynthesis.speak(u);
    } catch { /* read-aloud is best-effort */ }
  };

  const neededOption = (r, s) => {
    if (!r || r.mode === "healthy") return null;
    const key = r.wanted[s.given.length];
    return r.options.find((o) => o.key === key) || null;
  };
  const clueFor = (r, s) => {
    const opt = neededOption(r, s);
    if (!opt) return "Pick a healthy food!";
    const clue = FOOD_CLUE[opt.key] || FOOD_CLUE[String(opt.label).toLowerCase()];
    return clue ? `The ${opt.label} is ${clue}!` : `Look for the ${opt.label}!`;
  };

  // Waiting for an answer; after 6 s of nothing, Pao gives a hint.
  const startWaiting = () => {
    setPose("pao-feed-waiting");
    later(() => giveHint(), IDLE_HINT_MS);
  };

  const giveHint = () => {
    const r = rounds[roundIdxRef.current];
    const s = stateRef.current;
    if (!r || s.roundDone) return;
    clearTimers();
    markHint();
    const need = neededOption(r, s);
    setState((cur) => ({ ...cur, glowKey: need ? need.key : cur.glowKey }));
    setPose("pao-feed-hint");
    say(clueFor(r, s), () => startWaiting());
  };

  const markHint = () => {
    if (!target.current.hintUsed) { target.current.hintUsed = true; totals.current.hints += 1; }
  };

  const startRound = (idx) => {
    clearTimers();
    setRoundIdx(idx);
    roundIdxRef.current = idx;
    const fresh = initRound();
    stateRef.current = fresh;
    setState(fresh);
    setChosenKey(null);
    setReady(false);
    setPose("pao-feed-hungry");
    later(() => {
      const r = rounds[idx];
      target.current = { attempts: 0, hintUsed: false, startedAt: Date.now() };
      setReady(true);
      setPose("pao-feed-asking");
      say(r.direction, () => startWaiting());
    }, HUNGRY_MS);
  };

  // Game start: say hello, then the first round.
  useEffect(() => {
    preloadPoses();
    clearTimers();
    setPose("pao-feed-hello");
    say("Hi! It's snack time!", () => startRound(0));
    return () => { clearTimers(); speakGen.current += 1; try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  const choose = (key) => {
    const r = rounds[roundIdxRef.current];
    const s = stateRef.current;
    if (!r || !ready || s.roundDone) return;
    const next = pick(s, r, key);
    if (next === s) return;
    clearTimers();
    stateRef.current = next;
    setState(next);
    totals.current.attempts = next.attempts;

    const t = target.current;
    t.attempts += 1;
    const need = neededOption(r, s);
    const chosenOpt = r.options.find((o) => o.key === key);
    const correct = next.given.length > s.given.length;
    if (next.glowKey && !s.glowKey) markHint();
    answers.current.push({
      item: need?.label || r.direction,
      chosen: chosenOpt?.label || key,
      correct,
      attempts: t.attempts,
      hintUsed: t.hintUsed,
      timeMs: Date.now() - t.startedAt,
    });

    if (!correct) {
      if (!reduced) { setShakeKey(key); later(() => setShakeKey(null), 500); }
      const hinted = Boolean(next.glowKey);
      setPose(hinted ? "pao-feed-hint" : "pao-feed-not-this");
      const text = r.mode === "healthy"
        ? next.message?.text
        : hinted ? `This one is the ${neededOption(r, next)?.label || "food"}!` : "Hmm, not that one. Let's try again!";
      say(text, () => startWaiting());
      return;
    }

    // Correct food: eating, then yum.
    setChosenKey(key);
    setPose("pao-feed-eating");
    later(() => setPose("pao-feed-yum"), EATING_MS);
    t.attempts = 0; t.hintUsed = false; t.startedAt = Date.now();
    const label = chosenOpt?.label || key;

    if (!next.roundDone) {
      say(next.message?.text, () => startWaiting());
      return;
    }

    setStars((n) => n + 1);
    say(r.mode === "healthy" ? next.message?.text : `Yum, yum! Thank you for the ${label}!`);
    const idx = roundIdxRef.current;
    const isLastRound = idx === rounds.length - 1;
    if (isLastRound) {
      later(() => { setPose("pao-feed-thanks"); say("Thank you for feeding me!"); }, NEXT_MS);
      later(() => {
        if (reportedRef.current) return;
        reportedRef.current = true;
        setDone(true);
        onComplete?.({
          correct: rounds.length,
          attempts: totals.current.attempts,
          hints_used: totals.current.hints,
          stars: rounds.length,
          detail: { show_words: showWords, answers: answers.current },
        });
      }, NEXT_MS * 2);
    } else if (rounds[idx + 1].levelOrder !== r.levelOrder) {
      later(() => { setPose("pao-feed-full"); say("My tummy is happy!"); }, NEXT_MS);
      later(() => startRound(idx + 1), NEXT_MS * 2);
    } else {
      later(() => startRound(idx + 1), NEXT_MS);
    }
  };

  const hearAgain = () => { if (!round || state.roundDone) return; clearTimers(); setPose("pao-feed-asking"); say(round.direction, () => startWaiting()); };
  const readFoods = () => readOnly(round?.options.map((o) => o.label).join(". "));
  const replayLine = () => readOnly(line || round?.direction);
  const onHint = () => { if (ready && !state.roundDone) giveHint(); };

  if (done) {
    const gains = Object.entries(game.statGains || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)} +${v}`);
    return (
      <GameFinishScreen
        title="Pao is full!"
        subtitle={`You fed Pao ${rounds.length} times. Thank you!`}
        badgeFallback={{ emoji: "👂", name: "Good Listener" }}
        xp={game.pointsPerPlay ?? 100}
        chips={gains}
        replayLabel="Play again"
        onReplay={() => {
          reportedRef.current = false;
          totals.current = { attempts: 0, hints: 0 };
          answers.current = [];
          setDone(false); setStars(0); setRoundIdx(0); setState(initRound()); setChosenKey(null); setReady(false);
          setPlayKey((k) => k + 1);
        }}
        onExit={onExit}
      />
    );
  }

  if (!round) return null;

  const tall = round.options.length <= 4;
  const givenLabel = (k) => round.options.find((o) => o.key === k)?.label || k;
  const need = neededOption(round, state);
  const foodWords = round.options.map((o) => o.label);
  const bubbleText = showWords ? (line || round.direction) : "Listen to Pao…";
  const correctBanner = chosenKey && !state.refused.includes(chosenKey) && (state.roundDone || state.message?.tone === "good");
  const instruction = round.mode === "healthy" || round.wanted.length > 1 || !need ? round.direction : `Give Pao the ${need.label}.`;
  const pictureOpt = need || round.options.find((o) => o.is_correct);

  const cardStatus = (opt) => {
    const refused = state.refused.includes(opt.key);
    const wrong = state.wrongKeys.includes(opt.key);
    const given = state.given.includes(opt.key);
    const chosen = chosenKey === opt.key && given;
    const faded = state.roundDone ? !chosen : (wrong || refused || given);
    return { refused, chosen, faded };
  };

  return (
    <Shell>
      {/* Top bar */}
      <div className="relative z-10 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
        <button type="button" onClick={onExit} className="flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[17px] font-extrabold text-[#2B2366] shadow-[0_5px_0_rgba(43,35,102,.12)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>← Games</button>
        <div className="flex items-center gap-3 rounded-full bg-white px-5 py-2 shadow-[0_5px_0_rgba(43,35,102,.12)]" style={HEADING}>
          <span className="text-[18px] font-extrabold text-[#2B2366]">Feed Pao</span>
          <span className="rounded-full bg-[#ede9fe] px-3 py-1 text-[14px] font-bold text-[#5b21b6]">Level {round.levelOrder} · {round.levelName}</span>
          <span className="flex gap-1.5" aria-label={`Direction ${levelIndex + 1} of ${levelRounds.length}`}>
            {levelRounds.map((r, i) => (
              <span key={i} className={`h-3 w-3 rounded-full ${i < levelIndex ? "bg-[#2F8A4C]" : i === levelIndex ? "bg-[#6D4AE0] ring-4 ring-[#6D4AE0]/25" : "bg-[#D6D3E0]"}`} />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={showWords} onClick={() => setShowWords((v) => !v)} className="h-12 rounded-full bg-white px-5 text-[16px] font-extrabold text-[#2B2366] shadow-[0_5px_0_rgba(43,35,102,.12)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>
            Words: {showWords ? "on" : "off"}
          </button>
          <div className="flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[19px] font-extrabold text-[#2B2366] shadow-[0_5px_0_rgba(43,35,102,.12)]" style={HEADING} aria-label={`${stars} stars`}><span className="text-[#F5B400]">★</span> {stars}</div>
        </div>
      </div>

      <div className="relative z-10 mx-4 flex flex-1 flex-col items-center gap-4 pb-4 md:mx-8 md:flex-row md:items-start md:gap-8">
        {/* Left: speech bubble above Pao, who stands on the hill */}
        <div className="flex w-full flex-col items-center md:w-[40%] md:max-w-[460px]">
          <div aria-live="polite" className="relative z-10 flex w-full max-w-[420px] items-center gap-3 rounded-[26px] bg-white px-5 py-4 shadow-[0_6px_0_rgba(43,35,102,.12)]" style={HEADING}>
            <button type="button" onClick={replayLine} aria-label="Hear Pao again" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#7C5CFF] text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"><Volume2 size={22} aria-hidden="true" /></button>
            <p className="text-[24px] font-extrabold leading-tight text-[#2B2366]">{showWords ? <Highlighted text={bubbleText} words={foodWords} /> : bubbleText}</p>
            <span aria-hidden="true" className="absolute -bottom-2 left-[22%] h-5 w-5 rotate-45 bg-white" />
          </div>
          <div
            className="relative mt-3"
            onDragOver={(e) => { if (ready) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const k = e.dataTransfer.getData("text/plain"); if (k) choose(k); }}
          >
            <PaoPose pose={pose} width="min(380px, 62vw)" />
            {/* Pao's plate: glows while a food is being dragged */}
            <div aria-hidden="true" className={`pointer-events-none absolute left-[12%] right-[12%] rounded-[50%] transition-all ${dragging ? "bg-[#7C5CFF]/20 ring-4 ring-[#7C5CFF]" : ""}`} style={{ top: "66%", height: "15%" }} />
          </div>

          {(state.given.length > 0 || state.refused.length > 0) && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2" aria-label="Pao's plate">
              {state.given.map((k) => {
                const opt = round.options.find((o) => o.key === k);
                return opt?.image_url
                  ? <img key={k} src={opt.image_url} alt={givenLabel(k)} className="h-[44px] w-[44px] object-contain" />
                  : <span key={k} aria-hidden="true" className="text-[28px]">{FOOD_EMOJI[k] || "🍽️"}</span>;
              })}
              {state.refused.length > 0 && <span className="rounded-full bg-[#FFF7E6] px-3 py-1 text-[13px] font-extrabold text-[#92400E]" style={HEADING}>Sometimes foods: {state.refused.map(givenLabel).join(", ")}</span>}
            </div>
          )}
        </div>

        {/* Right: instruction card, food cards, helper buttons */}
        <div className="flex w-full flex-1 flex-col gap-4">
          {correctBanner ? (
            <div className="flex items-center gap-4 rounded-[28px] border-[3px] border-[#3FB36B] bg-[#E3F4E8] px-6 py-5 shadow-[0_6px_0_rgba(63,179,107,.25)]" style={HEADING} role="status">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#3FB36B] text-[28px] font-extrabold text-white" aria-hidden="true">✓</span>
              <p className="text-[clamp(22px,3vw,36px)] font-extrabold text-[#1F7A45]">Yes! That&apos;s the {givenLabel(chosenKey)}!</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4 rounded-[28px] bg-white px-5 py-4 shadow-[0_6px_0_rgba(43,35,102,.12)]">
              <span className="flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-[22px] bg-[#FFF3D9]">
                {pictureOpt?.image_url
                  ? <img src={pictureOpt.image_url} alt="" className="h-[64px] w-[64px] object-contain" />
                  : <span className="text-[48px]" aria-hidden="true">{FOOD_EMOJI[pictureOpt?.key] || "🍽️"}</span>}
              </span>
              <div className="min-w-[200px] flex-1" style={HEADING}>
                <p className="text-[13px] font-extrabold tracking-[.16em] text-[#7C5CFF]">TAP OR DRAG TO PAO&apos;S PLATE</p>
                <p className="text-[clamp(26px,3.4vw,44px)] font-extrabold leading-tight text-[#2B2366]">{showWords ? instruction : "Listen to Pao…"}</p>
              </div>
              <button type="button" onClick={hearAgain} className="flex h-14 items-center gap-2 rounded-2xl bg-[#7C5CFF] px-6 text-[19px] font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}><Volume2 size={22} aria-hidden="true" /> Hear again</button>
            </div>
          )}

          {round.mode === "healthy" && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: round.need }, (_, i) => {
                const filled = Boolean(state.given[i]);
                return <span key={i} className={`rounded-full px-3 py-1 text-[14px] font-extrabold ${filled ? "bg-[#2F8A4C] text-white" : "bg-white text-[#5b21b6]"}`} style={HEADING}>Healthy food{filled ? ` · ${givenLabel(state.given[i])}` : ""}</span>;
              })}
            </div>
          )}
          {round.mode !== "healthy" && round.wanted.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {round.wanted.map((k, i) => {
                const filled = state.given.includes(k);
                return <span key={k} className={`rounded-full px-3 py-1 text-[14px] font-extrabold ${filled ? "bg-[#2F8A4C] text-white" : "bg-white text-[#5b21b6]"}`} style={HEADING}>{i === 0 ? "1 First" : `${i + 1} Then`}{filled ? ` · ${givenLabel(k)}` : ""}</span>;
              })}
            </div>
          )}

          <div className={`grid gap-4 ${tall ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
            {round.options.map((opt) => {
              const { refused, chosen, faded } = cardStatus(opt);
              const glow = state.glowKey === opt.key && !state.roundDone;
              const shaking = shakeKey === opt.key;
              return (
                <div
                  key={opt.key}
                  className={`relative ${faded ? "opacity-45" : ""} transition-opacity`}
                  style={shaking ? { animation: "fpShake .45s" } : undefined}
                >
                  {chosen && <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#3FB36B] px-3 py-0.5 text-[14px] font-extrabold text-white" style={HEADING}>+1 star</span>}
                  {refused && <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#D97706] px-3 py-0.5 text-[13px] font-extrabold text-white" style={HEADING}>Sometimes food</span>}
                  <button
                    type="button"
                    aria-label={opt.label}
                    draggable={ready && !state.roundDone}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", opt.key); setDragging(true); }}
                    onDragEnd={() => setDragging(false)}
                    disabled={state.roundDone || !ready}
                    onClick={() => choose(opt.key)}
                    className={`flex w-full flex-col items-center justify-center gap-2 rounded-[34px] border-[4px] bg-white p-4 shadow-[0_8px_0_#DDD6F3] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] ${chosen ? "border-[#3FB36B]" : glow ? "border-[#3FB36B] ring-8 ring-[#3FB36B]/25" : "border-transparent"}`}
                    style={{ minHeight: tall ? 250 : 270 }}
                  >
                    {opt.image_url
                      ? <img src={opt.image_url} alt="" draggable={false} className="h-[140px] w-full object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      : <span className="text-[88px]" aria-hidden="true">{FOOD_EMOJI[opt.key] || "🍽️"}</span>}
                    {showWords && <span className="text-[clamp(26px,3vw,40px)] font-extrabold leading-none text-[#2B2366]" style={HEADING}>{opt.label}</span>}
                  </button>
                  <button type="button" onClick={() => readOnly(opt.label)} aria-label={`Say ${opt.label}`} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#EFEAFF] text-[#7C5CFF] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"><Volume2 size={18} aria-hidden="true" /></button>
                </div>
              );
            })}
          </div>

          <div className="mt-auto flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={readFoods} className="flex h-14 items-center gap-2 rounded-2xl bg-white px-6 text-[19px] font-extrabold text-[#2B2366] shadow-[0_5px_0_rgba(43,35,102,.12)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}><Volume2 size={20} aria-hidden="true" /> Read foods</button>
            <button type="button" onClick={onHint} disabled={!ready || state.roundDone} className="flex h-14 items-center gap-2 rounded-2xl bg-[#FFD36B] px-6 text-[19px] font-extrabold text-[#2B2366] shadow-[0_5px_0_#E0A92F] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] disabled:opacity-60" style={HEADING}><Lightbulb size={20} aria-hidden="true" /> Hint</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-y-auto overscroll-contain motion-reduce:[&_*]:!transition-none" style={BODY}>
      <SunnyScenery />
      <div className="relative z-10 flex min-h-full flex-col">{children}</div>
    </div>
  );
}
