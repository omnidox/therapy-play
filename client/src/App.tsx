import { useEffect, useMemo, useRef, useState } from "react";
import type { CreateRoomResponse } from "@therapy-play/shared";
import { Board } from "./Board";
import { DemoBanner } from "./DemoBanner";
import { Editor } from "./Editor";
import { JoinForm, OwnNames, PlayersPanel } from "./Players";
import { purgeOldKeys, readKey, saveKey } from "./storage";
import { useConfig } from "./useConfig";
import { readSeat, useRoom, type JoinParams } from "./useRoom";

const page: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  padding: 16,
  maxWidth: 640,
  margin: "0 auto",
  fontSize: 18,
};
const button: React.CSSProperties = {
  minHeight: 48,
  padding: "0 20px",
  fontSize: 18,
  borderRadius: 8,
  border: "1px solid #888",
  cursor: "pointer",
};

// The therapist's private key for her room, kept on this computer so closing the
// browser does not lock her out of her own room.
function readHostKey(code: string): string | undefined {
  return readKey(`hostKey:${code}`);
}

// Clear out anything old left on this device by rooms that were never closed.
purgeOldKeys();

// A soft two-note chime, played when a screen starts waiting.
function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.4);
    });
  } catch {
    // No sound is fine; the banner still shows.
  }
}

// Copies text. The browser's clipboard feature only works on secure pages (https or
// localhost), so a plain-http network address needs the older method.
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the older method.
  }
  try {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  } catch {
    return false;
  }
}

// Shown while the connection is being restored; the seat and score are kept.
function ReconnectBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="status" className="banner">
      Reconnecting... your seat is saved.
    </p>
  );
}

// The home page. Only the host creates rooms; when the server has a host passcode, it is asked for here.
export function Home({ go = (path: string) => location.assign(path) }: { go?: (path: string) => void }) {
  const config = useConfig();
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [asked, setAsked] = useState(false); // the server asked for a passcode even though the config did not
  const needsPasscode = config.passcodeRequired || asked;

  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    try {
      const res = await fetch(
        "/rooms",
        needsPasscode
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ passcode }),
            }
          : { method: "POST" },
      );
      if (res.status === 401) {
        setAsked(true);
        setProblem(passcode ? "That passcode is not right." : "Enter the passcode to create a room.");
        return;
      }
      if (res.status === 429) {
        const minutes = Math.max(1, Math.ceil(Number(res.headers.get("Retry-After") ?? 60) / 60));
        const wait = `${minutes} minute${minutes === 1 ? "" : "s"}`;
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setProblem(
          body.error === "too_many_rooms"
            ? `A lot of rooms were created from your connection. Please wait ${wait} and try again.`
            : `Too many tries. Please wait ${wait} and try again.`,
        );
        return;
      }
      if (res.status === 503) {
        setProblem("The site is busy right now. Please try again in a few minutes.");
        return;
      }
      if (!res.ok) {
        setProblem("Could not create a room. Please try again.");
        return;
      }
      const { code, hostKey } = (await res.json()) as CreateRoomResponse;
      saveKey(`hostKey:${code}`, hostKey);
      go(`/host/${code}`);
    } catch {
      setProblem("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={page}>
      <h1>therapy-play</h1>
      <form onSubmit={start}>
        {needsPasscode && (
          <p>
            <label>
              Therapist passcode
              <br />
              <input
                type="password"
                name="passcode"
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                style={{ fontSize: 18, padding: 8, width: "100%", boxSizing: "border-box" }}
              />
            </label>
          </p>
        )}
        {problem && (
          <p role="alert" className="privacy-note">
            {problem}
          </p>
        )}
        <button type="submit" style={button} disabled={busy || (needsPasscode && passcode === "")}>
          New room
        </button>
      </form>
    </main>
  );
}

// Ending a room cannot be undone, so it takes two clicks.
function EndRoomButton({ onEnd }: { onEnd: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button
      style={{
        ...button,
        borderColor: "#b3261e",
        color: armed ? "white" : "#b3261e",
        background: armed ? "#b3261e" : "white",
      }}
      onClick={() => (armed ? onEnd() : setArmed(true))}
    >
      {armed ? "Click again to end the room" : "End room"}
    </button>
  );
}

function HostView({ code }: { code: string }) {
  // Read once: the key is cleared from this device when the room ends, and the page must still say so.
  const [hostKey] = useState(() => readHostKey(code));
  const join = useMemo<JoinParams | null>(() => (hostKey ? { hostKey } : null), [hostKey]);
  const room = useRoom(code, join);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const linkInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const link = `${location.origin}/r/${code}`;
  const waitingBefore = useRef(0);

  const waiting = room.state?.screens.filter((s) => s.status === "waiting").length ?? 0;
  useEffect(() => {
    if (waiting > waitingBefore.current) chime();
    waitingBefore.current = waiting;
  }, [waiting]);

  if (!hostKey) return <main style={page}>This tab is not the host of this room.</main>;
  if (room.ended) return <main style={page}>Room ended. The link no longer works.</main>;
  if (room.error) return <main style={page}>Could not open this room ({room.error}).</main>;

  return (
    <main className="host-page">
      <ReconnectBanner show={room.reconnecting} />
      <header className="host-header">
        <h1>Your room</h1>
        <div className="link-row">
          <input readOnly aria-label="Link to email" value={link} onFocus={(e) => e.currentTarget.select()} />
          <button
            style={button}
            onClick={async () => {
              const ok = await copyText(link);
              setCopy(ok ? "copied" : "failed");
              if (!ok) linkInput.current?.select(); // so Ctrl+C works
            }}
          >
            {copy === "copied" ? "Copied" : "Copy link"}
          </button>
        </div>
        {copy === "failed" && (
          <p role="status" className="copy-note">
            Could not copy automatically. The link is selected: press Ctrl+C (Cmd+C on a Mac).
          </p>
        )}
        <EndRoomButton onEnd={() => room.send({ type: "end" })} />
      </header>

      <div className="host-layout">
        <aside className="controls" aria-label="Room controls">
          {room.state && (
            <PlayersPanel state={room.state} mine={room.mine} notice={room.notice} send={room.send} />
          )}

          <label>
            <input
              type="checkbox"
              checked={room.state?.admitRequired ?? true}
              onChange={(e) => room.send({ type: "setAdmitRequired", value: e.target.checked })}
            />{" "}
            I admit each screen before it comes in
          </label>

          <label>
            <input
              type="checkbox"
              checked={room.game?.scoring.enabled ?? false}
              onChange={(e) => room.send({ type: "setScoring", value: e.target.checked })}
            />{" "}
            Keep score
          </label>

          {room.board && (
            <button style={button} onClick={() => setEditing(true)}>
              Edit board
            </button>
          )}
        </aside>

        <section className="board-area" aria-label="Game">
          {room.game && room.state && (
            <Board
              game={room.game}
              role="host"
              players={room.state.players}
              mine={room.mine}
              send={room.send}
            />
          )}
        </section>
      </div>

      {editing && room.board && (
        <Editor
          initial={room.board}
          onClose={() => setEditing(false)}
          onUse={(board) => {
            room.send({ type: "setBoard", board });
            setEditing(false);
          }}
        />
      )}
    </main>
  );
}

function ChildView({ code }: { code: string }) {
  // A refreshed page returns to its seat with the token; otherwise it asks who is playing.
  const [join, setJoin] = useState<JoinParams | null>(() => {
    // Adding ?fresh to the link starts as a new player (handy for testing in one browser).
    if (new URLSearchParams(location.search).has("fresh")) return null;
    const token = readSeat(code);
    return token ? { token } : null;
  });
  const room = useRoom(code, join);

  if (room.ended) return <main style={page}>This room has ended.</main>;
  if (room.error === "not_found") return <main style={page}>This room is not available.</main>;

  const needsForm = join === null || room.error === "seat_gone" || room.error === "room_full";
  if (needsForm) {
    const message =
      room.error === "seat_gone"
        ? "Your seat was closed. Join again to keep playing."
        : room.error === "room_full"
          ? "There are not enough free seats for that many players."
          : undefined;
    return (
      <main style={page}>
        <JoinForm
          code={code}
          message={message}
          onSubmit={(names) => {
            history.replaceState(null, "", location.pathname); // a refresh then reclaims this seat
            setJoin({ names });
          }}
        />
      </main>
    );
  }
  if (room.error) return <main style={page}>Something went wrong.</main>;
  if (!room.state) return <main style={page}>Connecting...</main>;

  const myScreen = room.state.screens.find((s) => s.playerIds.some((id) => room.mine.includes(id)));
  if (myScreen?.status === "admitted" && room.game) {
    return (
      <main style={page}>
        <ReconnectBanner show={room.reconnecting} />
        <OwnNames state={room.state} mine={room.mine} send={room.send} />
        <Board game={room.game} role="child" players={room.state.players} mine={room.mine} send={room.send} />
      </main>
    );
  }
  return (
    <main style={page}>
      <ReconnectBanner show={room.reconnecting} />
      <p>Your therapist will let you in soon.</p>
      <OwnNames state={room.state} mine={room.mine} send={room.send} />
    </main>
  );
}

export function App() {
  const path = location.pathname.split("/").filter(Boolean);
  let page = <Home />;
  if (path[0] === "host" && path[1]) page = <HostView code={path[1]} />;
  else if (path[0] === "r" && path[1]) page = <ChildView code={path[1]} />;
  return (
    <>
      <DemoBanner />
      {page}
    </>
  );
}
