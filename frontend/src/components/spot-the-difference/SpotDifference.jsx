import { useMemo, useRef, useState, useEffect } from "react";
import { SkyBackground, GhostButton } from "../picture-word-game/ui";
import { PwModal, PwSky } from "../picture-word-game/pwUi";
import usePwStage from "../picture-word-game/usePwStage";
import { speakPao, stopPaoVoice } from "../../utils/paoVoice";
import { buildLevels, initLevel, tapPicture, helpPress, nextUnfound } from "./spotDifference";
import { PaoBubble, PaoStage, useSpotPao } from "./SpotPao";
import { SPOT_PROP_CSS } from "../../games/spotDifference/spotCostume";
import { PAO_PROP_CSS as PICTURE_WORD_PROP_CSS } from "../../games/pictureWord/PaoProps";
import { STREAK_EVERY, ENCOURAGE_AFTER } from "../../games/spotDifference/paoReactions";
import "../picture-word-game/pictureWord.css";
import "./spotDifference.css";

// Spot the Difference (Hard): compare two pictures and tap what is different.
// Rules live in spotDifference.js (unchanged); this file only draws, positions, speaks and reacts.
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" };
const SPEECH = { rate: 0.85, pitch: 1.15 };
const DONE_DELAY_MS = 1200;
const MISS_RING_MS = 1200;
const BURST_MS = 600;
const COLS = 16; // keyboard grid: about 40px cells on a 620px card
const ROWS = 10;
const HEIGHT_PER_WIDTH = 5 / 3;

// A circle of radius r (% of width) centred at (x, y) (% of the picture); heights are 3/5 of widths in the 5:3 picture.
function ringStyle(d) {
  return { left: `${d.x - d.r}%`, top: `${d.y - d.r * HEIGHT_PER_WIDTH}%`, width: `${d.r * 2}%`, aspectRatio: "1 / 1" };
}
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const I = ({ size = 22, children, sw = 2.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ArrowLeft = (p) => <I {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></I>;
const ArrowRight = (p) => <I {...p}><path d="M5 12h14M13 6l6 6-6 6" /></I>;
const Check = (p) => <I {...p} sw={3.4}><path d="M5 13l4 4L19 7" /></I>;
const Search = (p) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></I>;
const Replay = (p) => <I {...p}><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></I>;
const Home = (p) => <I {...p}><path d="M4 11l8-7 8 7v9H4z" /></I>;
const Clock = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>;
const InfoI = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></I>;
const StarI = ({ size = 24, className = "", filled = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6 6.1 20.6l1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z" /></svg>
);

// 3 stars for no hints and 2 or fewer retries, 2 for one hint or up to 4 retries, otherwise 1.
export function rating(hints, retries) {
  if (hints === 0 && retries <= 2) return 3;
  if (hints <= 1 || retries <= 4) return 2;
  return 1;
}

// A square crop of the picture around a difference (used on the results screen).
function cropStyle(src, d) {
  const w = 0.3; // fraction of the picture width shown
  const vis = (w * 5) / 3; // visible fraction of the picture height for a square crop of a 5:3 picture
  const px = Math.min(100, Math.max(0, ((d.x / 100 - w / 2) / (1 - w)) * 100));
  const py = Math.min(100, Math.max(0, ((d.y / 100 - vis / 2) / (1 - vis)) * 100));
  return { backgroundImage: `url(${src})`, backgroundSize: `${100 / w}% auto`, backgroundPosition: `${px}% ${py}%` };
}

export default function SpotDifference({ game, onExit, onComplete, preview = false, patientName = "friend" }) {
  const levels = useMemo(() => buildLevels(game), [game]);
  const stage = usePwStage();
  const [levelIdx, setLevelIdx] = useState(0);
  const [s, setS] = useState(initLevel);
  const [levelDone, setLevelDone] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [miss, setMiss] = useState(null); // { x, y, pic } the soft orange ring + tip after a wrong tap
  const [burst, setBurst] = useState(null); // { i, key } stars around a fresh find
  const [head, setHead] = useState(null); // { text, tone } headline override
  const [announce, setAnnounce] = useState("");
  const [kf, setKf] = useState(null); // keyboard focus cell { pic, cx, cy }
  const [secs, setSecs] = useState(0);
  const results = useRef([]); // one entry per finished level
  const reportedRef = useRef(false);
  const timers = useRef([]);
  const missRef = useRef(null);
  const wrongRun = useRef(0); // wrong taps in a row
  const cleanRun = useRef(0); // finds in a row with no wrong tap
  const startedAt = useRef(Date.now());

  const level = levels[levelIdx];
  const total = level?.differences.length ?? 0;
  const pao = useSpotPao({ total, name: String(patientName).split(" ")[0] });

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // Clear every timeout and speech on unmount, so nothing fires after leaving.
  useEffect(() => () => { clearTimers(); stopPaoVoice(); }, []);

  // Report the whole game once, when the last level is done.
  useEffect(() => {
    if (!allDone || reportedRef.current) return;
    reportedRef.current = true;
    const sum = (key) => results.current.reduce((n, r) => n + r[key], 0);
    const seconds = results.current.reduce((n, r) => n + (r.seconds || 0), 0);
    onComplete?.({
      correct: sum("found"),
      attempts: sum("attempts"),
      hints_used: sum("hints"),
      stars: sum("stars"),
      detail: { level_order: level.order, misses: sum("misses"), shows_used: sum("shows"), ...(seconds ? { duration_seconds: seconds } : {}) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const beginLevel = (idx) => {
    clearTimers();
    stopPaoVoice();
    missRef.current = null;
    wrongRun.current = 0;
    cleanRun.current = 0;
    startedAt.current = Date.now();
    setMiss(null); setBurst(null); setHead(null); setAnnounce(""); setKf(null);
    setLevelDone(false);
    setLevelIdx(idx);
    setS(initLevel());
  };

  // Greet when a picture appears.
  useEffect(() => {
    if (level) pao.fx("ready", { total: level.differences.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIdx, levels.length]);

  const react = (next, prev, x, y, pic) => {
    const ev = next.event;
    if (ev === "found" || ev === "done") {
      wrongRun.current = 0;
      cleanRun.current += 1;
      const idx = next.found[next.found.length - 1];
      const left = total - next.found.length;
      const say = next.message.text;
      setHead({ text: "You found it!", tone: "good" });
      setBurst({ i: idx, key: Date.now() });
      later(() => setBurst(null), BURST_MS);
      setAnnounce(`Found. ${next.found.length} of ${total}`);
      if (ev === "done") pao.fx("finished", {}, pao.lineFor("finished", { name: String(patientName).split(" ")[0] }));
      else if (left === 1) pao.fx("oneToGo");
      else if (cleanRun.current % STREAK_EVERY === 0) pao.fx("streak");
      else pao.fx("found", {}, `Yes! ${say} ${left} to go!`);
    } else if (ev === "miss" || ev === "auto-clue") {
      wrongRun.current += 1;
      cleanRun.current = 0;
      missRef.current = { x, y, pic };
      setMiss({ x, y, pic });
      later(() => { missRef.current = null; setMiss(null); }, MISS_RING_MS);
      setAnnounce("Not a difference");
      if (ev === "auto-clue") {
        setHead({ text: `Clue: ${lowerFirst(next.message.text).replace(/\.$/, "")}`, tone: "clue" });
        pao.fx("hint", {}, next.message.text);
      } else if (wrongRun.current % ENCOURAGE_AFTER === 0) pao.fx("encourage");
      else pao.fx("notQuite");
    } else if (ev === "already") {
      setAnnounce("Already found");
      pao.say(next.message.text);
    }
    void prev;
  };

  // The tap, already turned into % of the picture. Taps are ignored while the soft ring is showing.
  const tapPct = (x, y, pic) => {
    if (!level || s.phase !== "play" || missRef.current) return;
    const next = tapPicture(s, level, x, y);
    if (next === s) return;
    speakPao(next.message?.text || "", SPEECH);
    setS(next);
    react(next, s, x, y, pic);
    if (next.phase === "done") later(() => finishLevel(next), DONE_DELAY_MS);
  };

  const finishLevel = (finalState) => {
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    setSecs(seconds);
    results.current.push({
      found: finalState.found.length,
      attempts: finalState.attempts,
      hints: finalState.hints,
      misses: finalState.totalMisses,
      shows: finalState.shows,
      stars: finalState.stars,
      seconds,
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
    if (next.event === "clue") {
      setHead({ text: `Clue: ${lowerFirst(next.message.text).replace(/\.$/, "")}`, tone: "clue" });
      pao.fx("hint", {}, next.message.text);
      setAnnounce(`Hint: ${next.message.text}`);
    } else {
      pao.fx("hint", {}, "Look here!");
      setAnnounce("Hint: the next difference is highlighted");
    }
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

  const nextIdx = nextUnfound(s, level);
  const isLast = levelIdx === levels.length - 1;
  const glowing = s.glow >= 0 ? level.differences[s.glow] : null;
  const headline = miss
    ? { text: "Not quite. Try another spot", tone: "" }
    : head || { text: `Find all ${total} differences`, tone: "" };
  const helpDisabled = s.phase !== "play" || nextIdx < 0 || s.glow >= 0;
  const helpLabel = s.glow >= 0 ? "Hint used" : s.helpStage === 0 ? "Help me" : "Show me";

  const pics = [
    { id: "a", tag: "A", name: "Picture A", src: level.imageA, color: "#6366F1" },
    { id: "b", tag: "B", name: "Picture B", src: level.imageB, color: "#EC4899" },
  ];

  const onPicClick = (e, pic) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (e.detail === 0 && kf && kf.pic === pic.id) { // keyboard (Enter / Space): tap the middle of the focused cell
      tapPct(((kf.cx + 0.5) / COLS) * 100, ((kf.cy + 0.5) / ROWS) * 100, pic.id);
      return;
    }
    tapPct(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100, pic.id);
  };
  const onPicKey = (e, pic) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    setKf((cur) => {
      const c = cur && cur.pic === pic.id ? cur : { pic: pic.id, cx: Math.floor(COLS / 2), cy: Math.floor(ROWS / 2) };
      return { pic: pic.id, cx: Math.min(COLS - 1, Math.max(0, c.cx + d[0])), cy: Math.min(ROWS - 1, Math.max(0, c.cy + d[1])) };
    });
  };

  const burstDots = (d) => Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return <i key={i} className="sd-burst" style={{ left: `${d.x}%`, top: `${d.y}%`, "--dx": `${Math.cos(a) * 46}px`, "--dy": `${Math.sin(a) * 46}px`, color: ["#FFD43B", "#4ADE80", "#F472B6", "#38BDF8"][i % 4] }}><StarI size={18} /></i>;
  });

  const retries = s.totalMisses;
  const stars = rating(s.hints, retries);

  return (
    <div className="sd-root">
      <style>{SPOT_PROP_CSS + PICTURE_WORD_PROP_CSS}</style>
      <PwSky />
      <div className={`sd-stage${stage.narrow ? " narrow" : ""}`} style={stage.style}>
        <button type="button" className="sd-pill sd-back" onClick={leave}><ArrowLeft size={18} /> Games</button>

        <div className="sd-title">
          <strong>Spot the Differences</strong><span className="sd-sep" />
          <em>{level.label}</em>
          <span className="sd-diff">Hard <i /><i /><i /></span>
        </div>
        {preview && <div className="sd-preview"><InfoI size={13} /> Preview mode: scores are not saved</div>}
        <div className="sd-pill sd-stars" aria-label={`${s.stars} stars`}><StarI size={26} className="sd-star-gold" /> {s.stars}</div>

        <h1 className={`sd-headline ${headline.tone}`}>{headline.tone === "good" && <StarI size={36} className="sd-star-gold" />}{headline.text}</h1>

        {pics.map((pic) => (
          <div key={pic.id} className={`sd-pic-wrap ${pic.id}`}>
            <span className="sd-pic-tag"><b style={{ background: pic.color }}>{pic.tag}</b> {pic.name}</span>
            <div className="sd-frame">
              <button
                type="button"
                className="sd-pic"
                aria-label={`${pic.name}: ${level.label}. Tap what looks different. Arrow keys move, Enter taps.`}
                onClick={(e) => onPicClick(e, pic)}
                onKeyDown={(e) => onPicKey(e, pic)}
                onFocus={() => setKf((c) => c || { pic: pic.id, cx: Math.floor(COLS / 2), cy: Math.floor(ROWS / 2) })}
                onBlur={() => setKf(null)}
                disabled={s.phase !== "play"}
              >
                <img src={pic.src} alt="" draggable="false" />
                {glowing && (
                  <>
                    <span className="sd-dim" style={{ background: `radial-gradient(ellipse ${glowing.r + 3}% ${(glowing.r + 3) * HEIGHT_PER_WIDTH}% at ${glowing.x}% ${glowing.y}%, transparent 90%, rgba(27,43,107,.42) 100%)` }} aria-hidden="true" />
                    <span className="sd-ring hint" style={ringStyle({ ...glowing, r: glowing.r + 3 })} aria-hidden="true" />
                  </>
                )}
                {s.found.map((i) => {
                  const d = level.differences[i];
                  return (
                    <span key={`f${i}`}>
                      <span className="sd-ring found" style={ringStyle(d)} aria-hidden="true" />
                      <span className="sd-check" style={{ left: `calc(${d.x + d.r * 0.72}% - 15px)`, top: `calc(${d.y - d.r * 0.72 * HEIGHT_PER_WIDTH}% - 15px)` }} aria-hidden="true"><Check size={16} /></span>
                    </span>
                  );
                })}
                {burst && burstDots(level.differences[burst.i])}
                {miss && miss.pic === pic.id && (
                  <>
                    <span className="sd-ring miss" style={{ left: `${miss.x - 4.8}%`, top: `${miss.y - 4.8 * HEIGHT_PER_WIDTH}%`, width: "9.6%", aspectRatio: "1 / 1" }} aria-hidden="true" />
                    <span className="sd-misstip" style={{ left: `${Math.min(80, Math.max(20, miss.x))}%`, top: `${Math.min(88, miss.y + 12)}%` }}>Those two match</span>
                  </>
                )}
                {kf && kf.pic === pic.id && (
                  <span className="sd-kfocus" style={{ left: `${(kf.cx / COLS) * 100}%`, top: `${(kf.cy / ROWS) * 100}%`, width: `${100 / COLS}%`, height: `${100 / ROWS}%` }} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        ))}

        <div className="sd-bottom">
          <div className="sd-found">
            <span>Found {s.found.length} of {total}</span>
            <span className="sd-dots" aria-hidden="true">
              {level.differences.map((_, i) => <i key={i} className={s.found.includes(i) ? "on" : ""}>{s.found.includes(i) && <Check size={20} />}</i>)}
            </span>
          </div>
          <button type="button" className="sd-help" onClick={help} disabled={helpDisabled}><Search size={24} /> {helpLabel}</button>
        </div>

        <div className="sd-pao-wrap">
          <PaoStage view={pao.view} height={stage.narrow ? 150 : 300} />
          <PaoBubble text={pao.line || level.question} />
        </div>
      </div>

      <div className="sd-sr" aria-live="polite">{announce}</div>

      {levelDone && (
        <PwModal onClose={leave} width={1070} label="Results" className="sd-results">
          <h2 className="sd-res-title">You spotted all {total} differences!</h2>
          <p className="sd-res-says">Pao says: &ldquo;{pao.lineFor("finished", { name: String(patientName).split(" ")[0] })}&rdquo;</p>
          <div className="sd-res-hero">
            <div className="sd-res-pao"><PaoStage view="finished" height={220} /></div>
            <div className="sd-res-stars" role="img" aria-label={`${stars} out of 3 stars`}>
              {[1, 2, 3].map((n) => <StarI key={n} size={n === 2 ? 110 : 82} className={n <= stars ? "sd-gold" : "sd-dark"} />)}
            </div>
          </div>
          <div className="sd-stat-grid">
            <div><span className="sd-tile-i" style={{ background: "#22C55E" }}><Check size={26} /></span><b>{s.found.length} of {total}</b><small>Found</small></div>
            <div><span className="sd-tile-i" style={{ background: "#6366F1" }}><Clock size={24} /></span><b>{clock(secs)}</b><small>Time</small></div>
            <div><span className="sd-tile-i" style={{ background: "#F59E0B" }}><Search size={24} /></span><b>{s.hints}</b><small>Hints used</small></div>
            <div><span className="sd-tile-i" style={{ background: "#F97316" }}><Replay size={24} /></span><b>{retries}</b><small>Retries</small></div>
          </div>
          <div className="sd-label">What you found</div>
          <div className="sd-crops" style={{ gridTemplateColumns: `repeat(${Math.min(total, 4) || 1}, 1fr)` }}>
            {level.differences.map((d, i) => (
              <div key={i} className="sd-crop">
                <div className="sd-crop-img">
                  <span style={cropStyle(level.imageA, d)} role="img" aria-label="Picture A" />
                  <span style={cropStyle(level.imageB, d)} role="img" aria-label="Picture B" />
                </div>
                <b>{d.say}</b>
              </div>
            ))}
          </div>
          <div className="sd-res-btns" style={{ gridTemplateColumns: isLast ? "1fr 1fr" : "1.1fr 1.1fr 1fr" }}>
            <button
              type="button" className="sd-btn green" data-autofocus
              onClick={() => {
                if (isLast) { results.current = []; reportedRef.current = false; setAllDone(false); beginLevel(0); }
                else { results.current.pop(); beginLevel(levelIdx); } // replay this picture; only the last attempt counts
              }}
            ><Replay size={22} /> Play again</button>
            {!isLast && <button type="button" className="sd-btn indigo" onClick={() => beginLevel(levelIdx + 1)}>Next picture <ArrowRight size={22} /></button>}
            <button type="button" className="sd-btn light" onClick={leave}><Home size={22} /> All games</button>
          </div>
          {preview && <p className="sd-foot">Preview mode: this score was not saved</p>}
        </PwModal>
      )}
    </div>
  );
}
