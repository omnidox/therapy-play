import { useEffect, useState } from "react";
import {
  PLAYER_LIMITS,
  type ClientMessage,
  type ErrorReason,
  type PlayerInfo,
  type RoomInfoResponse,
  type RoomState,
} from "@therapy-play/shared";

type Send = (msg: ClientMessage) => void;

const button: React.CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  fontSize: 16,
  borderRadius: 8,
  border: "1px solid #888",
  background: "white",
  cursor: "pointer",
};
const input: React.CSSProperties = {
  fontSize: 16,
  padding: 8,
  boxSizing: "border-box",
  fontFamily: "inherit",
  minWidth: 0,
};

export function noticeText(reason: ErrorReason): string {
  switch (reason) {
    case "room_full":
      return "No free seat. Raise the number of players first.";
    case "not_allowed":
    case "not_host":
      return "That is not allowed.";
    default:
      return "That did not work. Try again.";
  }
}

// A name box. The name is sent when the person leaves the box or presses Enter.
export function NameInput({ player, send, label }: { player: PlayerInfo; send: Send; label?: string }) {
  return (
    <input
      key={`${player.id}-${player.name}`}
      aria-label={label ?? `Name of ${player.name}`}
      defaultValue={player.name}
      maxLength={PLAYER_LIMITS.nameLength}
      style={{ ...input, width: 150 }}
      onBlur={(e) => {
        const name = e.target.value.trim();
        if (name && name !== player.name) send({ type: "renamePlayer", playerId: player.id, name });
        else e.target.value = player.name;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

// "Who is playing on this screen?" Shown before a new screen joins.
export function JoinForm({
  code,
  message,
  onSubmit,
}: {
  code: string;
  message?: string;
  onSubmit: (names: string[]) => void;
}) {
  const [free, setFree] = useState<number | null | "missing">(null);
  const [count, setCount] = useState(1);
  const [names, setNames] = useState<string[]>(["", "", "", ""]);

  useEffect(() => {
    let active = true;
    fetch(`/rooms/${code}`)
      .then(async (res) => {
        if (!res.ok) return active && setFree("missing");
        const info = (await res.json()) as RoomInfoResponse;
        if (active) setFree(info.freeSlots);
      })
      .catch(() => active && setFree("missing"));
    return () => {
      active = false;
    };
  }, [code, message]);

  if (free === null) return <p>Checking the room...</p>;
  if (free === "missing") return <p>This room is not available.</p>;
  if (free === 0) return <p>This room is full.</p>;

  const most = Math.min(PLAYER_LIMITS.maxPerScreen, free);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(names.slice(0, count));
      }}
    >
      <h1>Join the game</h1>
      {message && <p style={{ background: "#fff3c4", padding: 12, borderRadius: 8 }}>{message}</p>}
      <label>
        How many people are playing on this screen?{" "}
        <select
          aria-label="Players on this screen"
          value={Math.min(count, most)}
          onChange={(e) => setCount(Number(e.target.value))}
          style={{ ...input, minHeight: 44 }}
        >
          {Array.from({ length: most }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      <p style={{ fontSize: 15 }}>Names are optional. A blank name becomes Player 1, Player 2, and so on.</p>
      <p role="note" className="privacy-note">
        Please do not type real names or personal details. A nickname, or just Player 1, is best.
      </p>
      {Array.from({ length: Math.min(count, most) }, (_, i) => (
        <p key={i}>
          <input
            aria-label={`Name for player ${i + 1}`}
            placeholder={`Player ${i + 1}`}
            value={names[i]}
            maxLength={PLAYER_LIMITS.nameLength}
            style={{ ...input, width: "100%" }}
            onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
          />
        </p>
      ))}
      <button type="submit" style={{ ...button, background: "#1f4fa3", color: "white", border: "none" }}>
        Join
      </button>
    </form>
  );
}

// On a player's own screen: change the names of the people playing here.
export function OwnNames({ state, mine, send }: { state: RoomState; mine: number[]; send: Send }) {
  const [editing, setEditing] = useState(false);
  const players = state.players.filter((p) => mine.includes(p.id));
  if (players.length === 0) return null;
  return (
    <div className="names-row">
      {editing ? (
        <>
          {players.map((p) => (
            <NameInput key={p.id} player={p} send={send} label={`Your name: ${p.name}`} />
          ))}
          <button style={button} onClick={() => setEditing(false)}>
            Done
          </button>
        </>
      ) : (
        <>
          <span>Playing as</span>
          {players.map((p) => (
            <span key={p.id} className="chip">
              {p.name}
            </span>
          ))}
          <button style={button} onClick={() => setEditing(true)}>
            Change names
          </button>
        </>
      )}
    </div>
  );
}

const STATUS_TEXT = { waiting: "Waiting", admitted: "In the game", away: "Disconnected" } as const;

// The therapist's panel: how many players, who is here, admit and remove.
export function PlayersPanel({
  state,
  mine,
  notice,
  send,
}: {
  state: RoomState;
  mine: number[];
  notice: ErrorReason | null;
  send: Send;
}) {
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const waiting = state.screens.filter((s) => s.status === "waiting").length;
  const hostPlayer = state.hostPlays ? byId.get(mine[0]) : undefined;
  const card: React.CSSProperties = {
    border: "1px solid #bbb",
    borderRadius: 10,
    padding: 12,
    margin: "12px 0",
  };
  return (
    <section style={card} aria-label="Players">
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          Players{" "}
          <select
            aria-label="Number of players"
            value={state.maxPlayers}
            onChange={(e) => send({ type: "setMaxPlayers", value: Number(e.target.value) })}
            style={{ ...input, minHeight: 44 }}
          >
            {Array.from({ length: PLAYER_LIMITS.maxPlayers }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: 15 }}>
          {state.players.length} of {state.maxPlayers} seats used
        </span>
        <label>
          <input
            type="checkbox"
            checked={state.hostPlays}
            onChange={(e) => send({ type: "setHostPlays", value: e.target.checked })}
          />{" "}
          I'm playing too
        </label>
      </div>

      {notice && (
        <p role="status" style={{ background: "#fff3c4", padding: 8, borderRadius: 8 }}>
          {noticeText(notice)}
        </p>
      )}

      {hostPlayer && (
        <p>
          You (therapist): <NameInput player={hostPlayer} send={send} label="Your name as a player" />
        </p>
      )}

      {waiting > 0 && (
        <p role="status" style={{ background: "#fff3c4", padding: 12, borderRadius: 8 }}>
          <strong>{waiting === 1 ? "A screen is waiting." : `${waiting} screens are waiting.`}</strong>{" "}
          <button style={button} onClick={() => send({ type: "admit" })}>
            {waiting === 1 ? "Admit" : "Admit all"}
          </button>
        </p>
      )}

      {state.screens.length === 0 && <p>No one has joined yet.</p>}
      {state.screens.map((screen, i) => (
        <div
          key={screen.id}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "8px 0" }}
        >
          <strong>Screen {i + 1}</strong>
          <span style={{ fontSize: 14 }}>({STATUS_TEXT[screen.status]})</span>
          {screen.playerIds.map((id) => {
            const player = byId.get(id);
            return player ? <NameInput key={id} player={player} send={send} /> : null;
          })}
          {screen.status === "waiting" && (
            <button style={button} onClick={() => send({ type: "admit", screenId: screen.id })}>
              Admit
            </button>
          )}
          <button style={button} onClick={() => send({ type: "removeScreen", screenId: screen.id })}>
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}
