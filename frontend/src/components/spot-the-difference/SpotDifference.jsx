import { useMemo, useRef, useState, useEffect } from "react";
import PandaMascot from "../../pages/games/PandaMascot";
import GameFinishScreen from "../GameFinishScreen";
import { SkyBackground, PressableButton, GhostButton, ModalShell, CloseButton } from "../picture-word-game/ui";
import { speakPao, stopPaoVoice } from "../../utils/paoVoice";
import { buildLevels, initLevel, tapPicture, helpPress, nextUnfound } from "./spotDifference";

// Spot the Difference (Hard): compare two pictures and tap what is different.
// Rules live in spotDifference.js; this file only draws, positions and speaks.
const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" };
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" };
const SPEECH = { rate: 0.85, pitch: 1.15 };
const DONE_DELAY_MS = 1200;

// A circle of radius r (% of width) centred at (x, y) (% of the picture).
// Heights are 3/5 of widths in the 5:3 picture, so the top offset is scaled.
function ringStyle(d) {
  return {
    left: `${d.x - d.r}%`,
    top: `${d.y - d.r * (5 / 3)}%`,
    width: `${d.r * 2}%`,
    aspectRatio: "1 / 1",
  };
}

export default function SpotDifference({ game, onExit, onComplete }) {
  const levels = useMemo(() => buildLevels(game), [game]);
  const [started, setStarted] = useState(false);
  const [levelIdx, setLevelIdx] = useState(0);
  const [s, setS] = useState(initLevel);
  const [levelDone, setLevelDone] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const results = useRef([]);       // one entry per finished level
  const reportedRef = useRef(false);
  const timers = useRef([]);

  const level = levels[levelIdx];
  const total = level?.differences.length ?? 0;

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // Clear every timeout and speech on unmount, so nothing fires after leaving.
  useEffect(() => () => { clearTimers(); stopPaoVoice(); }, []);

  // Report the whole game once, when the last level is done.
  useEffect(() => {
    if (!allDone || reportedRef.current) return;
    reportedRef.current = true;
    const sum = (key) => results.current.reduce((n, r) => n + r[key], 0);
    onComplete?.({
      correct: sum("found"),
      attempts: sum("attempts"),
      hints_used: sum("hints"),
      stars: sum("stars"),
      detail: { level_order: level.order, misses: sum("misses"), shows_used: sum("shows") },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const beginLevel = (idx) => {
    clearTimers();
    stopPaoVoice();
    setLevelDone(false);
    setLevelIdx(idx);
    setS(initLevel());
  };

  const start = () => { setStarted(true); beginLevel(0); };

  // Pictures are buttons; the tap is turned into % of the clicked picture.
  const tapAt = (e) => {
    if (!level || s.phase !== "play") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const next = tapPicture(s, level, x, y);
    if (next === s) return;
    speakPao(next.message?.text || "", SPEECH);
    setS(next);
    if (next.phase === "done") {
      later(() => finishLevel(next), DONE_DELAY_MS);
    }
  };

  const finishLevel = (finalState) => {
    results.current.push({
      found: finalState.found.length,
      attempts: finalState.attempts,
      hints: finalState.hints,
      misses: finalState.totalMisses,
      shows: finalState.shows,
      stars: finalState.stars,
    });
    setLevelDone(true);
    if (levelIdx === levels.length - 1) setAllDone(true);
  };

  const help = () => {
    if (!level || s.phase !== "play") return;
    const next = helpPress(s, level);
    if (next === s) return;
    speakPao(next.message?.text || "", SPEECH);
    setS(next);
  };

  const leave = () => { clearTimers(); stopPaoVoice(); onExit?.(); };

  if (!levels.length) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 p-6 text-center" style={BODY}>
        <SkyBackground />
        <p className="text-[18px] font-bold text-[#2B2A4C]">Spot the Difference has no scenes yet.</p>
        <GhostButton className="h-14 px-8 text-[16px]" onClick={onExit}>Back to games</GhostButton>
      </div>
    );
  }

  if (!started) return <StartModal game={game} levels={levels} onStart={start} onCancel={leave} />;

  const nextIdx = nextUnfound(s, level);
  const foundLabels = s.found.map((i) => level.differences[i].say);
  const isLast = levelIdx === levels.length - 1;

  return (
    <div className="sd-screen fixed inset-0 z-[9999] overflow-y-auto" style={BODY}>
      <style>{`
        .sd-ring { position:absolute; border-radius:50%; pointer-events:none; }
        .sd-ring--found { border:4px solid #16A34A; box-shadow:0 0 12px rgba(22,163,74,.6); }
        .sd-ring--show { border:4px dashed #F59E0B; box-shadow:0 0 16px rgba(245,158,11,.8); }
        @keyframes sdPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        .sd-ring--show { animation: sdPulse 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sd-ring--show { animation:none; } }
        .sd-pic { width:100%; max-width:520px; aspect-ratio:5 / 3; }
      `}</style>
      <SkyBackground />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1200px] flex-col gap-3 px-3 pb-6 pt-3 md:px-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={leave} className="flex h-11 items-center rounded-full bg-white px-4 text-[15px] font-extrabold text-[#2B2366] shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>← Games</button>
          <div className="order-last flex w-full flex-wrap items-center justify-center gap-2 rounded-full bg-white px-4 py-2 shadow-md md:order-none md:w-auto" style={HEADING}>
            <span className="text-[16px] font-extrabold text-[#2B2366]">Spot the Difference</span>
            <span className="rounded-full bg-[#DC2626] px-2.5 py-0.5 text-[13px] font-extrabold text-white">Hard</span>
            <span className="text-[13px] font-bold text-[#5b21b6]">{level.name} · {level.label}</span>
          </div>
          <div className="flex h-11 items-center rounded-full bg-white px-4 text-[17px] font-extrabold text-[#C97A00] shadow-md" style={HEADING} aria-label={`${s.stars} stars`}>⭐ {s.stars}</div>
        </header>

        <h1 className="text-center text-[20px] font-extrabold text-[#2B2366] md:text-[24px]" style={HEADING}>Hard · find all {total} differences</h1>

        <div className="flex flex-col items-center gap-3 md:flex-row md:items-start md:justify-center md:gap-5">
          {[
            { label: "Picture A", src: level.imageA, id: "a" },
            { label: "Picture B", src: level.imageB, id: "b" },
          ].map((pic) => (
            <div key={pic.id} className="flex w-full max-w-[520px] flex-col items-center gap-2">
              <span className="rounded-full bg-white px-3 py-0.5 text-[14px] font-extrabold text-[#2B2366] shadow" style={HEADING}>{pic.label}</span>
              <button
                type="button"
                aria-label={pic.label}
                onClick={tapAt}
                disabled={s.phase !== "play"}
                className="sd-pic relative overflow-hidden rounded-[26px] border-[6px] border-white bg-white shadow-lg focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
              >
                <img src={pic.src} alt="" className="absolute inset-0 h-full w-full object-cover" draggable="false" />
                {s.found.map((i) => (
                  <span key={`f${i}`} className="sd-ring sd-ring--found" style={ringStyle(level.differences[i])} aria-hidden="true" />
                ))}
                {s.glow >= 0 && (
                  <span key="glow" className="sd-ring sd-ring--show" style={ringStyle(level.differences[s.glow])} aria-hidden="true" />
                )}
              </button>
            </div>
          ))}
        </div>

        <ul className="sr-only" aria-label="Found differences">
          {foundLabels.map((text, i) => <li key={i}>Found: {text}</li>)}
        </ul>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow" style={HEADING}>
            <span className="text-[14px] font-extrabold text-[#2B2366]">Found {s.found.length} of {total}</span>
            <span className="flex gap-1.5" aria-hidden="true">
              {level.differences.map((_, i) => (
                <span key={i} className={`h-3.5 w-3.5 rounded-full ${s.found.includes(i) ? "bg-[#16A34A]" : "bg-[#D6D3E0]"}`} />
              ))}
            </span>
          </div>
          <button
            type="button"
            onClick={help}
            disabled={s.phase !== "play" || nextIdx < 0}
            className="h-12 rounded-2xl border-2 border-dashed border-[#D97706] bg-[#FFF7E6] px-5 text-[15px] font-extrabold text-[#92400E] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] disabled:opacity-60"
            style={HEADING}
          >
            {s.helpStage === 0 ? "Help me" : "Show me"}
          </button>
        </div>

        <div className="flex flex-col items-start gap-2 md:flex-row md:items-end md:justify-center">
          <PandaMascot entered pandaState="normal" pxWidth={120} />
          <div
            aria-live="polite"
            className={`max-w-[520px] rounded-[18px] border-2 px-4 py-2.5 text-[16px] font-bold ${s.message?.tone === "try" ? "border-[#F59E0B] bg-[#FFF4D6] text-[#92400E]" : "border-[#E4DFCE] bg-white text-[#2B2A4C]"}`}
            style={BODY}
          >
            {s.message?.text || level.question}
          </div>
        </div>
      </div>

      {levelDone && (
        <GameFinishScreen
          title={isLast ? "Eagle eyes!" : "Great looking!"}
          subtitle={`You found all ${total} differences in ${level.label}.`}
          badgeFallback={isLast ? { emoji: "🦅", name: game?.badge?.name || "Eagle Eyes" } : null}
          xp={game?.points_per_play ?? 150}
          chips={isLast ? Object.entries(game?.stat_gains || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)} +${v}`) : []}
          stars={s.stars}
          replayLabel={isLast ? "Play again" : "Next level"}
          onReplay={() => {
            if (isLast) { results.current = []; reportedRef.current = false; setAllDone(false); beginLevel(0) }
            else { setLevelDone(false); beginLevel(levelIdx + 1) }
          }}
          onExit={leave}
        />
      )}
    </div>
  );
}

function StartModal({ game, levels, onStart, onCancel }) {
  const first = levels[0];
  const gains = Object.entries(game?.stat_gains || {}).filter(([, v]) => v > 0);
  return (
    <ModalShell onClose={onCancel} label="Spot the Difference">
      <CloseButton onClose={onCancel} />
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex gap-2">
          <img src={first.imageA} alt="" className="h-[72px] w-[120px] rounded-xl border-2 border-white object-cover shadow" />
          <img src={first.imageB} alt="" className="h-[72px] w-[120px] rounded-xl border-2 border-white object-cover shadow" />
        </div>
        <h2 className="text-[30px] font-extrabold text-[#2B2366]" style={HEADING}>Spot the Difference</h2>
        <span className="rounded-full bg-[#DC2626] px-3 py-1 text-[13px] font-extrabold text-white">Hard · Ages 12-19</span>
        <p className="text-[16px] text-[#2B2A4C]">{game?.description || "Compare the two pictures and tap what is different."}</p>
        <div className="flex flex-wrap justify-center gap-2 text-[14px] font-extrabold" style={HEADING}>
          <span className="rounded-full bg-[#FEF3C7] px-3 py-1 text-[#92400E]">1. Look</span>
          <span className="rounded-full bg-[#EDE9FE] px-3 py-1 text-[#5b21b6]">2. Compare</span>
          <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[#166534]">3. Tap</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-[14px] font-bold text-[#2B2A4C]">
          <span className="rounded-full bg-white px-3 py-1 shadow">🦅 {game?.badge?.name || "Eagle Eyes"}</span>
          <span className="rounded-full bg-white px-3 py-1 shadow">⭐ +{game?.points_per_play ?? 150} XP</span>
          {gains.map(([k, v]) => (
            <span key={k} className="rounded-full bg-white px-3 py-1 shadow">{k[0].toUpperCase()}{k.slice(1)} +{v}</span>
          ))}
        </div>
        <div className="w-full rounded-2xl border-2 border-[#86EFAC] bg-[#F0FDF4] p-3 text-left text-[14px] text-[#14532D]">
          <p className="font-extrabold" style={HEADING}>Why this helps</p>
          <p>Builds visual attention and noticing details. Pao names each difference, so it also grows vocabulary. No timer, gentle hints.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <PressableButton color="#F59E0B" shadow="#C97A00" className="h-14 flex-1 text-[18px]" onClick={onStart}>Start Game</PressableButton>
          <GhostButton className="h-14 flex-1 text-[16px]" onClick={onCancel}>Cancel</GhostButton>
        </div>
      </div>
    </ModalShell>
  );
}
