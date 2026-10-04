import { useEffect, useMemo, useRef, useState } from "react";
import SunnyScenery from "../../pages/games/SunnyScenery";
import PandaMascot from "../../pages/games/PandaMascot";
import { buildRounds, initRound, pick } from "./feedPao";

// Feed Pao: listen to a direction, then give Pao the right food, in order.
// Rules and wording live in feedPao.js; this file only draws and speaks.
const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" };
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" };
const FOOD_EMOJI = { banana: "🍌", milk: "🥛", carrot: "🥕", bread: "🍞", water: "💧", apple: "🍎", "red apple": "🍎", "green apple": "🍏" };
const MOOD_PANDA = { hungry: "sad", eating: "excited", happy: "happy" };
const SPEECH_RATE = 0.8;
const SPEECH_PITCH = 1.15;

function speak(text, enabled = true) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = SPEECH_RATE;
    u.pitch = SPEECH_PITCH;
    window.speechSynthesis.speak(u);
  } catch { /* read-aloud is best-effort */ }
}

export default function FeedPao({ game, onExit, onComplete }) {
  const rounds = useMemo(() => buildRounds(game), [game]);
  const showWordsDefault = game.typeSettings?.choose_picture?.show_words_default !== false;
  const readAloud = game.support?.read_aloud !== false;

  const [roundIdx, setRoundIdx] = useState(0);
  const [state, setState] = useState(initRound);
  const [showWords, setShowWords] = useState(showWordsDefault);
  const [done, setDone] = useState(false);
  const [stars, setStars] = useState(0);
  const totals = useRef({ attempts: 0, hints: 0 });
  const reportedRef = useRef(false);
  const timer = useRef(null);

  const round = rounds[roundIdx];
  const levelRounds = rounds.filter((r) => r.levelOrder === round?.levelOrder);
  const levelIndex = levelRounds.indexOf(round);

  // Read each new direction aloud, outside any state updater.
  useEffect(() => {
    if (round && showWords === false) speak("Listen to Pao.", readAloud);
    if (round) speak(round.direction, readAloud);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx]);

  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);

  const choose = (key) => {
    if (!round || state.roundDone) return;
    const next = pick(state, round, key);
    if (next === state) return;
    totals.current.attempts = next.attempts;
    totals.current.hints = next.hints;
    setState(next);
    speak(next.message?.text, readAloud);

    if (next.roundDone) {
      setStars((n) => n + 1);
      const isLastRound = roundIdx === rounds.length - 1;
      if (isLastRound) {
        if (!reportedRef.current) {
          reportedRef.current = true;
          timer.current = setTimeout(() => {
            setDone(true);
            onComplete?.({
              correct: rounds.length,
              attempts: totals.current.attempts,
              hints_used: totals.current.hints,
              stars: rounds.length,
              detail: { show_words: showWords },
            });
          }, 1900);
        }
      } else {
        timer.current = setTimeout(() => {
          setRoundIdx((i) => i + 1);
          setState(initRound());
        }, 1900);
      }
    }
  };

  const hearAgain = () => speak(round?.direction, readAloud);

  if (done) {
    return (
      <Shell>
        <div className="flex w-full max-w-[520px] flex-col items-center gap-3 rounded-[32px] bg-[#FFF8EC] p-7 text-center shadow-xl" style={BODY} role="dialog" aria-modal="true" aria-label="Pao is full">
          <PandaMascot entered pandaState="happy" pxWidth={150} />
          <h2 className="text-[30px] font-extrabold text-[#2B2366]" style={HEADING}>Pao is full!</h2>
          <div className="flex flex-wrap justify-center gap-2 text-[14px] font-bold">
            <span className="rounded-full bg-[#E3F4E8] px-3 py-1.5 text-[#2F8A4C]">+{game.pointsPerPlay ?? 100} XP for Pao</span>
            {Object.entries(game.statGains || {}).filter(([, v]) => v > 0).map(([k, v]) => (
              <span key={k} className="rounded-full bg-[#ede9fe] px-3 py-1.5 text-[#5b21b6]">{k[0].toUpperCase() + k.slice(1)} +{v}</span>
            ))}
          </div>
          <div className="mt-2 flex w-full flex-col gap-2.5">
            <button type="button" onClick={() => { reportedRef.current = false; totals.current = { attempts: 0, hints: 0 }; setDone(false); setRoundIdx(0); setState(initRound()); setStars(0) }} className="h-14 rounded-2xl bg-[#6D4AE0] text-[18px] font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">Play again</button>
            <button type="button" onClick={onExit} className="h-12 rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">All games</button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!round) return null;

  const tall = round.options.length <= 4;
  const plateLabels = round.wanted.map((k) => round.options.find((o) => o.key === k)?.label || k);
  const givenLabel = (k) => round.options.find((o) => o.key === k)?.label || k;
  const bubble = state.message?.text || (showWords ? round.direction : "Listen to Pao…");
  const bubbleTone = state.message?.tone === "try" ? "border-[#F59E0B] bg-[#FFF4D6] text-[#92400E]" : "border-[#E4DFCE] bg-white text-[#2B2A4C]";

  return (
    <Shell>
      {/* Top bar */}
      <div className="relative z-10 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button type="button" onClick={onExit} className="flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-extrabold text-[#2B2366] shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>← Games</button>
        <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-md" style={HEADING}>
          <span className="text-[16px] font-extrabold text-[#2B2366]">Feed Pao</span>
          <span className="rounded-full bg-[#ede9fe] px-2.5 py-0.5 text-[13px] font-bold text-[#5b21b6]">Level {round.levelOrder} · {round.levelName}</span>
          <span className="flex gap-1" aria-label={`Direction ${levelIndex + 1} of ${levelRounds.length}`}>
            {levelRounds.map((r, i) => (
              <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < levelIndex ? "bg-[#2F8A4C]" : i === levelIndex ? "bg-[#6D4AE0]" : "bg-[#D6D3E0]"}`} />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={showWords} onClick={() => setShowWords((v) => !v)} className="h-12 rounded-full bg-white px-4 text-[14px] font-extrabold text-[#2B2366] shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>
            Words: {showWords ? "on" : "off"}
          </button>
          <div className="flex h-12 items-center rounded-full bg-white px-4 text-[17px] font-extrabold text-[#C97A00] shadow-md" style={HEADING} aria-label={`${stars} stars`}>⭐ {stars}</div>
        </div>
      </div>

      <div className="relative z-10 mx-4 flex flex-1 flex-col gap-4 pb-4 md:flex-row">
        {/* Left: Pao, bubble, plate */}
        <div className="flex flex-col items-center gap-3 md:w-[40%]">
          <div aria-live="polite" className={`max-w-[360px] rounded-[18px] border-2 px-4 py-2.5 text-center text-[17px] font-bold ${bubbleTone}`} style={BODY}>{bubble}</div>
          <PandaMascot entered pandaState={MOOD_PANDA[state.mood] || "happy"} pxWidth={180} />
          <div className="flex min-h-[64px] min-w-[220px] flex-wrap items-center justify-center gap-2 rounded-[50%] border-[3px] border-dashed border-[#8A5A3B] bg-white/80 px-6 py-3">
            {state.given.length === 0
              ? <span className="text-[14px] font-bold text-[#5A5670]" style={BODY}>Pao’s plate</span>
              : state.given.map((k) => (
                <span key={k} className="flex items-center gap-1 text-[15px] font-extrabold text-[#2B2A4C]" style={HEADING}>
                  <span aria-hidden="true">{FOOD_EMOJI[k] || "🍽️"}</span>{givenLabel(k)}
                </span>
              ))}
          </div>
        </div>

        {/* Right: direction + food */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-[28px] bg-white p-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[20px] font-extrabold text-[#2B2366]" style={HEADING}>{showWords ? round.direction : "Listen to Pao…"}</p>
              <button type="button" onClick={hearAgain} className="h-12 rounded-2xl border-2 border-[#E4DFCE] bg-white px-4 text-[15px] font-bold text-[#5A5670] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">🔊 Hear again</button>
            </div>
            {round.wanted.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {round.wanted.map((k, i) => {
                  const filled = state.given.includes(k);
                  return (
                    <span key={k} className={`rounded-full px-3 py-1 text-[13px] font-extrabold ${filled ? "bg-[#2F8A4C] text-white" : "bg-[#EDE9FE] text-[#5b21b6]"}`} style={HEADING}>
                      {i === 0 ? "1 First" : `${i + 1} Then`}{filled ? ` · ${FOOD_EMOJI[k] || ""} ${givenLabel(k)}` : ""}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`grid gap-3 ${tall ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
            {round.options.map((opt) => {
              const gone = state.wrongKeys.includes(opt.key) || state.given.includes(opt.key);
              const glow = state.glowKey === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-label={opt.label}
                  disabled={state.roundDone}
                  onClick={() => choose(opt.key)}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-[24px] border-[3px] bg-white p-3 shadow-md transition-opacity focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] ${glow ? "border-[#F59E0B] ring-4 ring-[#F59E0B]" : "border-transparent"} ${gone ? "opacity-30" : ""}`}
                  style={{ minHeight: tall ? 230 : 170 }}
                >
                  {glow && <span className="absolute -top-3 rounded-full bg-[#F59E0B] px-2 py-0.5 text-[12px] font-extrabold text-white">This one</span>}
                  {opt.image_url
                    ? <img src={opt.image_url} alt="" className="h-[110px] w-full object-contain" onError={(e) => { e.currentTarget.style.display = "none" }} />
                    : <span className="text-[72px]" aria-hidden="true">{FOOD_EMOJI[opt.key] || "🍽️"}</span>}
                  <span className="text-[16px] font-extrabold text-[#2B2A4C]" style={HEADING}>{opt.label}</span>
                </button>
              );
            })}
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
