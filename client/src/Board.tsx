import type { ClientMessage, GameView, PlayerInfo } from "@therapy-play/shared";
import { Modal } from "./Modal";

type Props = {
  game: GameView;
  role: "host" | "child";
  players: PlayerInfo[];
  mine: number[]; // player ids on this screen
  send: (msg: ClientMessage) => void;
};

const bigButton: React.CSSProperties = {
  minHeight: 56,
  padding: "0 28px",
  fontSize: 20,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: "#1f4fa3",
  color: "white",
};

const smallButton: React.CSSProperties = {
  minHeight: 40,
  padding: "0 12px",
  fontSize: 15,
  borderRadius: 8,
  border: "1px solid #888",
  background: "white",
  cursor: "pointer",
};

// Phone first: five equal columns that fit a portrait screen; tiles are at least 48px tall.
export function Board({ game, role, players, mine, send }: Props) {
  const rows = game.categories[0]?.values.length ?? 0;
  const { scoring } = game;
  const isHost = role === "host";
  const step = Math.min(...game.categories.flatMap((c) => c.values), 100);
  return (
    <section aria-label={game.boardName}>
      {scoring.enabled && (
        <div role="group" aria-label="Score" aria-live="polite" aria-relevant="text">
          <div className={isHost ? "scoreboard host" : "scoreboard"}>
            {players.map((p) => (
              <div key={p.id} className={mine.includes(p.id) ? "score-card mine" : "score-card"}>
                <div className="score-name">
                  {p.name}
                  {mine.includes(p.id) && <span className="sr-only"> (you)</span>}
                </div>
                <div className="score-value">{scoring.scores[p.id] ?? 0}</div>
                {isHost && (
                  <div className="score-buttons">
                    <button
                      aria-label={`Take ${step} from ${p.name}`}
                      style={smallButton}
                      onClick={() => send({ type: "adjustScore", playerId: p.id, delta: -step })}
                    >
                      −{step}
                    </button>
                    <button
                      aria-label={`Add ${step} to ${p.name}`}
                      style={smallButton}
                      onClick={() => send({ type: "adjustScore", playerId: p.id, delta: step })}
                    >
                      +{step}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {isHost && (
            <div className="reset-row">
              <button style={smallButton} onClick={() => send({ type: "resetScores" })}>
                Reset scores
              </button>
            </div>
          )}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${game.categories.length}, minmax(0, 1fr))`,
          gap: 4,
        }}
      >
        {game.categories.map((c, ci) => (
          <div
            key={`h${ci}`}
            style={{
              background: "#1f4fa3",
              color: "white",
              fontSize: "clamp(10px, 2.8vw, 16px)",
              fontWeight: 600,
              textAlign: "center",
              padding: "8px 2px",
              borderRadius: 6,
              overflowWrap: "anywhere",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {c.name}
          </div>
        ))}
        {Array.from({ length: rows }).map((_, ri) =>
          game.categories.map((c, ci) => {
            const used = game.used[ci][ri];
            return (
              <button
                key={`${ci}-${ri}`}
                data-tile={`${ci}-${ri}`}
                disabled={used || game.open !== null}
                aria-label={`${c.name} ${c.values[ri]}${used ? " (used)" : ""}`}
                onClick={() => send({ type: "openTile", cat: ci, clue: ri })}
                style={{
                  minHeight: 56,
                  fontSize: "clamp(14px, 4vw, 24px)",
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "none",
                  cursor: used ? "default" : "pointer",
                  background: used ? "#d8d8d8" : "#2f6fd6",
                  color: used ? "#d8d8d8" : "white",
                }}
              >
                {used ? "" : c.values[ri]}
              </button>
            );
          }),
        )}
      </div>

      {game.open && (
        <Modal
          label={`Clue: ${game.open.category} for ${game.open.value}`}
          onEscape={() => send({ type: "putBack" })}
          fallbackFocus={[
            `button[data-tile="${game.open.cat}-${game.open.clue}"]`,
            "section[aria-label] button:not([disabled])",
          ]}
          style={{
            position: "fixed",
            inset: 0,
            background: "#12306b",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: 24,
            textAlign: "center",
            overflowY: "auto",
          }}
        >
          <div className="sr-only" aria-live="polite">
            {game.open.answer !== null ? `Answer: ${game.open.answer}` : ""}
          </div>
          <div style={{ fontSize: 18, opacity: 0.85 }}>
            {game.open.category} for {game.open.value}
          </div>
          <div style={{ fontSize: "clamp(26px, 7vw, 44px)", lineHeight: 1.3, maxWidth: 800 }}>
            {game.open.question}
          </div>
          {game.open.answer !== null && (
            <div
              style={{
                fontSize: "clamp(24px, 6vw, 40px)",
                fontWeight: 700,
                background: "#fff3c4",
                color: "#222",
                padding: "12px 20px",
                borderRadius: 10,
              }}
            >
              {game.open.answer}
            </div>
          )}
          {isHost && scoring.enabled && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {players.map((p) => (
                <button
                  key={p.id}
                  style={{ ...bigButton, background: "#6a3fb5", fontSize: 18, padding: "0 20px" }}
                  onClick={() => send({ type: "adjustScore", playerId: p.id, delta: game.open!.value })}
                >
                  Give {game.open!.value} to {p.name}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            {game.open.answer === null && (
              <button style={bigButton} onClick={() => send({ type: "showAnswer" })}>
                Show answer
              </button>
            )}
            <button
              style={{ ...bigButton, background: "#2e7d32" }}
              onClick={() => send({ type: "closeTile" })}
            >
              Done
            </button>
            <button
              style={{ ...bigButton, background: "transparent", border: "2px solid white" }}
              onClick={() => send({ type: "putBack" })}
            >
              Put back
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
