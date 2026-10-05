import { useEffect, useState } from "react";
import SpotDifference from "../../components/spot-the-difference/SpotDifference.jsx";
import { useGameSession } from "../../hooks/useGameSession";
import { SkyBackground } from "../../components/picture-word-game/ui";

// Loads the Spot the Difference game document (scenes and their differences)
// and starts a play session for it.
const GAME_NAME = "Spot the Difference";

export default function SpotDifferencePage({ onExit }) {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const gameSession = useGameSession({ gameName: GAME_NAME });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/games/by-name?name=" + encodeURIComponent(GAME_NAME))
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (cancelled) return;
        if (ok) setGame(b.game);
        else setError(b.error || "Could not load Spot the Difference.");
      })
      .catch(() => { if (!cancelled) setError("Could not load Spot the Difference."); });
    return () => { cancelled = true };
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }}>
        <SkyBackground />
        <p className="text-[18px] font-bold text-[#2B2A4C]">{error}</p>
        <button type="button" onClick={onExit} className="h-14 rounded-2xl bg-[#F59E0B] px-8 text-[18px] font-extrabold text-[#2B2A4C]">Back to games</button>
      </div>
    );
  }

  if (!game) return null;

  return <SpotDifference game={game} onExit={onExit} onComplete={(result) => gameSession.finish(result)} />;
}
