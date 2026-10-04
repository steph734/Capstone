import { useEffect, useState } from "react";
import FeedPao from "../../components/feed-pao/FeedPao.jsx";
import { useGameSession } from "../../hooks/useGameSession";

// Feed Pao: loads the game from the database, shows its start screen, plays
// it, and reports the finished game to Pao.
const PREVIEW = {
  name: "Feed Pao",
  description: "Listen to Pao, then give him the right food, one step at a time.",
  pointsPerPlay: 100,
  color: "#16a34a",
  levels: [],
};

const PILLS = ["1. Listen", "2. Find the food", "3. Feed Pao"];

export default function FeedPaoPage({ onExit }) {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const gameSession = useGameSession({ gameName: "Feed Pao" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/games/by-name?name=" + encodeURIComponent("Feed Pao"))
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => { if (!cancelled) (ok ? setGame(b.game) : setError(b.error || "Could not load Feed Pao.")) })
      .catch(() => { if (!cancelled) setError("Could not load Feed Pao.") });
    return () => { cancelled = true };
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[#87ceeb] p-6 text-center" style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }}>
        <p className="text-[18px] font-bold text-[#2B2A4C]">{error}</p>
        <button type="button" onClick={onExit} className="h-14 rounded-2xl bg-[#F59E0B] px-8 text-[18px] font-extrabold text-[#2B2A4C]">Back to games</button>
      </div>
    );
  }

  if (!started) {
    const shown = game || PREVIEW;
    const gains = Object.entries(shown.statGains || {}).filter(([, v]) => v > 0);
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(60,50,90,0.45)] p-4 backdrop-blur-sm" style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }}>
        <div role="dialog" aria-modal="true" aria-labelledby="fp-title" className="max-h-[95vh] w-[400px] max-w-[92vw] overflow-y-auto rounded-[28px] border-[1.5px] border-[#16a34a40] bg-gradient-to-br from-white to-[#fdf3e3] p-7 shadow-2xl">
          <h2 id="fp-title" className="text-center text-[24px] font-extrabold text-[#3a2e6b]" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>{shown.name}</h2>
          <p className="mt-2 text-center text-[14px] leading-relaxed text-[#3a2e6b]/75">{shown.description}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {PILLS.map((p) => <span key={p} className="rounded-full bg-[#ede9fe] px-3 py-1 text-[12px] font-extrabold text-[#5b21b6]">{p}</span>)}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
            <Card label="Badge" value="Good Listener" tint="#FFF0CC" />
            <Card label="Points" value={`+${shown.pointsPerPlay ?? 100} XP`} tint="#E3F4E8" />
            <Card label="Pao stats" value={gains.length ? gains.map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)} +${v}`).join(" · ") : "Stronger Pao"} tint="#ede9fe" />
          </div>
          <div className="mt-4 rounded-2xl border-2 border-[#A9D8B6] bg-[#E3F4E8] p-4">
            <p className="text-[12px] font-extrabold tracking-wider text-[#2F8A4C]">WHY THIS HELPS</p>
            <p className="mt-1 text-[14px] leading-relaxed text-[#2B2A4C]">
              Builds listening and following one-step and two-step directions, and remembering the order of what Pao asks for.
            </p>
          </div>
          <button type="button" disabled={!game} onClick={() => setStarted(true)} className="mt-5 h-14 w-full rounded-2xl bg-[#F59E0B] text-[20px] font-extrabold text-[#2B2A4C] disabled:opacity-60" style={{ boxShadow: "0 5px 0 #C97A00" }}>
            Start Game
          </button>
          <button type="button" onClick={onExit} className="mt-2.5 h-12 w-full rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670]">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!game) return null;

  return <FeedPao game={game} onExit={onExit} onComplete={(result) => { gameSession.finish(result) }} />;
}

function Card({ label, value, tint }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl p-3" style={{ background: tint }}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#5A5670]">{label}</span>
      <span className="text-[13px] font-extrabold text-[#2B2A4C]" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>{value}</span>
    </div>
  );
}
