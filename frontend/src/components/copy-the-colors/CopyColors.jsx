import { useEffect, useMemo, useRef, useState } from "react";
import PandaMascot from "../../pages/games/PandaMascot";
import { SkyBackground, PressableButton, GhostButton, ModalShell, CloseButton, useSpeech } from "../picture-word-game/ui";
import { buildConfig, fullName, startGame, showFinished, replay, tapPad, hintPad, initGame, SPEEDS } from "./copyColors";

// Copy the Colors: Pao lights up a pattern of pads, the patient taps the same
// pads in the same order, and the pattern grows by one each time.
// Rules live in copyColors.js; this file only draws, times and speaks.
const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" };
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" };
const FLASH_MS = 250;
const GROW_MS = 1800;
const MISS_MS = 1500;

// White shape drawn in code, so every pad has a shape as well as a colour.
function ShapeIcon({ shape, size = 52 }) {
  const common = { fill: "#fff", stroke: "none" };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {shape === "circle" && <circle cx="32" cy="32" r="22" {...common} />}
      {shape === "square" && <rect x="12" y="12" width="40" height="40" rx="4" {...common} />}
      {shape === "triangle" && <polygon points="32,10 56,52 8,52" {...common} />}
      {shape === "star" && <polygon points="32,6 39,25 60,25 43,37 49,58 32,46 15,58 21,37 4,25 25,25" {...common} />}
    </svg>
  );
}

export default function CopyColors({ game, onExit, onComplete }) {
  const cfg = useMemo(() => buildConfig(game), [game]);
  const [started, setStarted] = useState(false);
  const [levelIdx, setLevelIdx] = useState(0);
  const [speed, setSpeed] = useState(cfg.speed);
  const [s, setS] = useState(initGame);
  const [lit, setLit] = useState(-1);
  const [flash, setFlash] = useState(-1);
  const [bubble, setBubble] = useState("Let's play! Watch what I do.");
  const [tone, setTone] = useState("good");
  const [finished, setFinished] = useState(false);
  const reportedRef = useRef(false);
  const timers = useRef([]);
  const { speak, cancel } = useSpeech(game?.support?.read_aloud !== false);

  const level = cfg.levels[levelIdx];
  const padCount = cfg.pads.length;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Web layout (md and up) opens the How-to card and uses bigger shapes; phones collapse the card.
  const [isDesktop] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 768px)").matches);
  const hint = hintPad(s, level);
  const timing = SPEEDS[speed];

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id; };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // Clear every timeout and speech on unmount, so nothing fires after leaving.
  useEffect(() => () => { clearTimers(); cancel(); }, [cancel]);

  // Pao plays the pattern: each pad lights up, and Pao says its name.
  useEffect(() => {
    if (!started || s.phase !== "show") return undefined;
    let t = 600;
    s.seq.forEach((p) => {
      later(() => { setLit(p); speak(fullName(cfg.pads[p])); }, t);
      t += timing.on;
      later(() => setLit(-1), t);
      t += timing.off;
    });
    later(() => {
      setLit(-1);
      setBubble("Your turn! Copy me.");
      setTone("good");
      setS((prev) => showFinished(prev));
    }, t);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, s.phase, s.seq, speed]);

  // After a copy or a miss, wait a moment, then replay the pattern.
  useEffect(() => {
    if (!started) return undefined;
    if (s.phase === "feedback" && s.event === "grow") {
      setBubble("Yes! You copied it! Now the pattern gets longer.");
      setTone("good");
      later(() => setS((prev) => replay(prev)), GROW_MS);
    } else if (s.phase === "feedback" && s.event === "miss") {
      setBubble("Almost! Watch again.");
      setTone("try");
      later(() => setS((prev) => replay(prev)), MISS_MS);
    } else if (s.phase === "done") {
      setBubble(`Super memory! You copied ${s.seq.length} shapes.`);
      setTone("good");
      later(() => setFinished(true), 600);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.event, s.attempts, started]);

  // Report the finished goal once, through the game session.
  useEffect(() => {
    if (!finished || reportedRef.current) return;
    reportedRef.current = true;
    onComplete?.({
      correct: s.stars,
      attempts: s.attempts,
      hints_used: s.hints,
      stars: s.stars,
      detail: { longest_pattern: s.longest, level_order: level.order, speed },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const beginLevel = (idx) => {
    clearTimers();
    cancel();
    reportedRef.current = false;
    setFinished(false);
    setLevelIdx(idx);
    setBubble("Let's play! Watch what I do.");
    setTone("good");
    const next = cfg.levels[idx];
    setS(startGame(initGame(), next, padCount, Math.random));
  };

  const start = () => { setStarted(true); beginLevel(levelIdx); };

  const tap = (p) => {
    if (s.phase !== "input") return;
    const next = tapPad(s, level, p, padCount, Math.random);
    if (next === s) return;
    const name = fullName(cfg.pads[p]);
    setFlash(p);
    later(() => setFlash(-1), FLASH_MS);
    if (next.event === "miss") {
      setBubble("Almost! Watch again.");
      setTone("try");
      speak(name);
    } else {
      setBubble(`${name}!`);
      setTone("good");
      speak(name);
    }
    setS(next);
  };

  const showAgain = () => {
    clearTimers();
    cancel();
    setS((prev) => replay(prev));
  };

  const leave = () => { clearTimers(); cancel(); onExit?.(); };

  if (!started) return <StartModal game={game} cfg={cfg} onStart={start} onCancel={leave} />;

  const bannerLook = s.phase === "show"
    ? { text: "Watch Pao", color: "#F59E0B", icon: "👀" }
    : s.phase === "input"
      ? { text: "Your turn", color: "#7C3AED", icon: "✋" }
      : s.event === "done" ? { text: "Great!", color: "#16A34A", icon: "⭐" }
      : s.event === "miss" ? { text: "Watch again", color: "#F59E0B", icon: "👀" }
      : { text: "Great!", color: "#16A34A", icon: "⭐" };

  const copiedCount = s.phase === "input" ? s.pos : 0;

  return (
    <div className="cc-screen fixed inset-0 z-[9999] overflow-y-auto" style={BODY}>
      <style>{`
        .cc-pao { transform-origin: top center; }
        @media (max-width: 767px) { .cc-pao { zoom: .72; } }
      `}</style>
      <SkyBackground />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1100px] flex-col gap-3 px-3 pb-6 pt-3 md:px-6">
        {/* Top bar: one row on web; on phones the title drops to its own row */}
        <header className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={leave} className="flex h-11 items-center rounded-full bg-white px-4 text-[15px] font-extrabold text-[#2B2366] shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>← Games</button>
          <h1 className="order-last flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[16px] font-extrabold text-[#2B2366] shadow-md md:order-none md:w-auto md:justify-start" style={HEADING}>
            Copy the Colors
            <span className="rounded-full bg-[#ede9fe] px-2.5 py-0.5 text-[13px] font-bold text-[#5b21b6]">Pattern of {s.seq.length} · goal {level.goal}</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={speed === "normal"}
              onClick={() => setSpeed((v) => (v === "slow" ? "normal" : "slow"))}
              className="h-11 rounded-full bg-white px-4 text-[14px] font-extrabold text-[#2B2366] shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
              style={HEADING}
            >
              Speed: {speed}
            </button>
            <div className="flex h-11 items-center rounded-full bg-white px-4 text-[17px] font-extrabold text-[#C97A00] shadow-md" style={HEADING} aria-label={`${s.stars} stars`}>⭐ {s.stars}</div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-start">
          {/* Left: banner, bubble, Pao, how to play */}
          <aside className="flex w-full flex-col items-center gap-2 md:w-[340px] md:flex-shrink-0 md:gap-3">
            <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[15px] font-extrabold text-white shadow-md" style={{ ...HEADING, background: bannerLook.color }}>
              <span aria-hidden="true">{bannerLook.icon}</span>{bannerLook.text}
            </div>
            <div aria-live="polite" className={`w-full max-w-[360px] rounded-[18px] border-2 px-4 py-2 text-center text-[16px] font-bold ${tone === "try" ? "border-[#F59E0B] bg-[#FFF4D6] text-[#92400E]" : "border-[#E4DFCE] bg-white text-[#2B2A4C]"}`} style={BODY}>{bubble}</div>
            <div className="cc-pao">
              <PandaMascot entered pandaState={s.phase === "input" ? "happy" : "normal"} pxWidth={150} />
            </div>

            <details open={isDesktop} className="w-full max-w-[360px] rounded-[20px] bg-white p-4 shadow-md">
              <summary className="cursor-pointer text-[15px] font-extrabold text-[#2B2366]" style={HEADING}>How to play</summary>
              <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[14px] text-[#2B2A4C]">
                <li>Watch the shapes light up.</li>
                <li>Say each one: “red circle, blue square”.</li>
                <li>Tap the same shapes in the same order.</li>
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                {cfg.pads.map((p) => (
                  <span key={p.key} className="flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-[12px] font-extrabold text-[#2B2A4C]" style={{ borderColor: p.color, ...HEADING }}>
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: p.color }} aria-hidden="true" />{fullName(p)}
                  </span>
                ))}
              </div>
            </details>
            {s.phase === "input" && (
              <button type="button" onClick={showAgain} className="h-12 w-full max-w-[360px] rounded-2xl border-2 border-[#E4DFCE] bg-white px-4 text-[15px] font-bold text-[#5A5670] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">🔊 Show me again</button>
            )}
          </aside>

          {/* Right: pattern track + pads */}
          <main className="flex w-full min-w-0 flex-1 flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-[22px] bg-white p-4 shadow-lg">
              <p className="text-[15px] font-extrabold text-[#2B2366]" style={HEADING}>Pattern</p>
              <div className="flex min-h-[44px] flex-wrap gap-2" aria-label="Pattern">
                {s.seq.map((p, i) => {
                  const filled = i < copiedCount;
                  const next = s.phase === "input" && i === s.pos;
                  return (
                    <span
                      key={i}
                      className={`flex h-11 w-11 items-center justify-center rounded-full md:h-12 md:w-12 ${filled ? "" : "border-[3px] border-dashed border-[#B9B3CF]"} ${next ? "ring-4 ring-[#7C3AED]" : ""}`}
                      style={filled ? { background: cfg.pads[p].color } : undefined}
                      aria-hidden="true"
                    >
                      {filled && <ShapeIcon shape={cfg.pads[p].shape} size={24} />}
                    </span>
                  );
                })}
              </div>
            </section>

            <div className="grid w-full grid-cols-2 gap-3 md:gap-4">
              {cfg.pads.map((p, i) => {
                const isLit = lit === i || flash === i;
                const isHint = hint === i;
                const disabled = s.phase !== "input";
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-label={fullName(p)}
                    disabled={disabled}
                    onClick={() => tap(i)}
                    className={`relative flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-[28px] p-3 text-white transition-transform focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] disabled:cursor-default md:min-h-[170px] md:rounded-[32px] ${isLit && !reduced ? "scale-[1.04]" : ""}`}
                    style={{
                      background: isLit ? p.lit : p.color,
                      border: `4px solid ${isLit ? "#fff" : p.ring}`,
                      boxShadow: isLit ? `0 0 22px ${p.lit}` : `0 7px 0 ${p.ring}`,
                      opacity: disabled && !isLit ? 0.85 : 1,
                    }}
                  >
                    {isHint && <span className="absolute -top-3 rounded-full bg-[#F59E0B] px-2 py-0.5 text-[12px] font-extrabold text-white">Next one</span>}
                    <ShapeIcon shape={p.shape} size={isDesktop ? 56 : 42} />
                    <span className="text-[17px] font-extrabold md:text-[20px]" style={HEADING}>{p.label}</span>
                    <span className="text-[13px] font-bold opacity-90 md:text-[15px]">{p.shape}</span>
                  </button>
                );
              })}
            </div>
          </main>
        </div>
      </div>

      {finished && (
        <SuperMemoryModal
          count={s.seq.length}
          xp={game?.points_per_play ?? 100}
          stats={game?.stat_gains || {}}
          hasNext={levelIdx < cfg.levels.length - 1}
          onNext={() => { setFinished(false); beginLevel(levelIdx + 1) }}
          onReplay={() => { setFinished(false); beginLevel(levelIdx) }}
          onExit={leave}
        />
      )}
    </div>
  );
}

function StartModal({ game, cfg, onStart, onCancel }) {
  const gains = Object.entries(game?.stat_gains || {}).filter(([, v]) => v > 0);
  return (
    <ModalShell onClose={onCancel} label="Copy the Colors">
      <CloseButton onClose={onCancel} />
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid grid-cols-2 gap-2">
          {cfg.pads.map((p) => (
            <span key={p.key} className="flex h-14 w-14 items-center justify-center rounded-[18px]" style={{ background: p.color, border: `3px solid ${p.ring}` }} aria-hidden="true">
              <ShapeIcon shape={p.shape} size={30} />
            </span>
          ))}
        </div>
        <h2 className="text-[30px] font-extrabold text-[#2B2366]" style={HEADING}>Copy the Colors</h2>
        <p className="text-[16px] text-[#2B2A4C]">{game?.description || "Watch Pao, then copy the pattern in the same order."}</p>
        <div className="flex flex-wrap justify-center gap-2 text-[14px] font-extrabold" style={HEADING}>
          <span className="rounded-full bg-[#FEF3C7] px-3 py-1 text-[#92400E]">1. Watch</span>
          <span className="rounded-full bg-[#EDE9FE] px-3 py-1 text-[#5b21b6]">2. Remember</span>
          <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[#166534]">3. Copy</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-[14px] font-bold text-[#2B2A4C]">
          <span className="rounded-full bg-white px-3 py-1 shadow">🏅 {game?.badge?.name || "Memory Master"}</span>
          <span className="rounded-full bg-white px-3 py-1 shadow">⭐ +{game?.points_per_play ?? 100} XP</span>
          {gains.map(([k, v]) => (
            <span key={k} className="rounded-full bg-white px-3 py-1 shadow">{k[0].toUpperCase()}{k.slice(1)} +{v}</span>
          ))}
        </div>
        <div className="w-full rounded-2xl border-2 border-[#86EFAC] bg-[#F0FDF4] p-3 text-left text-[14px] text-[#14532D]">
          <p className="font-extrabold" style={HEADING}>Why this helps</p>
          <p>Builds visual working memory and attention, and gives practice in holding a sequence in mind.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <PressableButton color="#F59E0B" shadow="#C97A00" className="h-14 flex-1 text-[18px]" onClick={onStart}>Start Game</PressableButton>
          <GhostButton className="h-14 flex-1 text-[16px]" onClick={onCancel}>Cancel</GhostButton>
        </div>
      </div>
    </ModalShell>
  );
}

function SuperMemoryModal({ count, xp, stats, hasNext, onNext, onReplay, onExit }) {
  const gains = Object.entries(stats).filter(([, v]) => v > 0);
  return (
    <ModalShell onClose={onExit} label="Super memory">
      <div className="flex flex-col items-center gap-4 text-center">
        <PandaMascot entered pandaState="happy" pxWidth={150} />
        <h2 className="text-[32px] font-extrabold text-[#2B2366]" style={HEADING}>Super memory!</h2>
        <p className="text-[16px] text-[#2B2A4C]">You copied a pattern of {count} shapes.</p>
        <div className="flex flex-wrap justify-center gap-2 text-[14px] font-bold text-[#2B2A4C]">
          <span className="rounded-full bg-white px-3 py-1 shadow">⭐ +{xp} XP</span>
          {gains.map(([k, v]) => (
            <span key={k} className="rounded-full bg-white px-3 py-1 shadow">{k[0].toUpperCase()}{k.slice(1)} +{v}</span>
          ))}
        </div>
        <div className="flex w-full flex-col gap-2">
          {hasNext
            ? <PressableButton color="#16A34A" shadow="#15803D" className="h-14 text-[18px]" onClick={onNext}>Next level</PressableButton>
            : <PressableButton color="#16A34A" shadow="#15803D" className="h-14 text-[18px]" onClick={onReplay}>Play again</PressableButton>}
          <GhostButton className="h-12 text-[16px]" onClick={onExit}>All games</GhostButton>
        </div>
      </div>
    </ModalShell>
  );
}
