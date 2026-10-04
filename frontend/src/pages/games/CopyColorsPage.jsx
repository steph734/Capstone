import { useEffect, useState } from "react";
import CopyColors from "../../components/copy-the-colors/CopyColors.jsx";
import { useGameSession } from "../../hooks/useGameSession";
import { SkyBackground } from "../../components/picture-word-game/ui";

// Loads the Copy the Colors game document (pads and pattern lengths) and starts
// a play session for it. The patterns themselves are random and never stored.
const GAME_NAME = "Copy the Colors";

export default function CopyColorsPage({ onExit }) {
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
        else setError(b.error || "Could not load Copy the Colors.");
      })
      .catch(() => { if (!cancelled) setError("Could not load Copy the Colors."); });
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

  return <CopyColors game={game} onExit={onExit} onComplete={(result) => gameSession.finish(result)} />;
}
