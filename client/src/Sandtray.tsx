import { useRef, useState } from "react";
import {
  FIGURES,
  FIGURE_CATEGORIES,
  TRAY,
  clampPosition,
  findFigure,
  type ClientMessage,
  type FigureCategory,
  type TrayItem,
  type TrayView,
} from "@therapy-play/shared";

type Props = { tray: TrayView; send: (msg: ClientMessage) => void };

const SEND_EVERY_MS = 50; // while dragging, tell the others at most 20 times a second
const DRAG_START_PX = 6; // movement smaller than this is a tap, not a drag
const STEP = 0.02; // arrow keys move a figure this far (Shift: five times as far)

const word = (value: number, low: string, high: string) =>
  value < 0.34 ? low : value > 0.66 ? high : "middle";

type Dragging = { itemId: number; x: number; y: number };
type ShelfDrag = { figureId: string; startX: number; startY: number; moved: boolean };

// The sandtray: a sand-coloured tray on top and a shelf of figures below it.
// Drag a figure from the shelf onto the sand, or tap it and then tap the sand, or press Enter on it.
export function Sandtray({ tray, send }: Props) {
  const trayRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const lastSent = useRef(0);
  const shelfDrag = useRef<ShelfDrag | null>(null);
  const suppressClick = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const [category, setCategory] = useState<FigureCategory>("animals");
  const [picked, setPicked] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const [overShelf, setOverShelf] = useState(false);
  const [ghost, setGhost] = useState<{ figureId: string; x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const full = tray.items.length >= TRAY.maxItems;

  // Where on the tray (a fraction 0 to 1, kept inside the edges) a point on the screen is.
  const toTray = (clientX: number, clientY: number) => {
    const rect = trayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0.5, y: 0.5 };
    return clampPosition((clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height);
  };
  const inside = (el: HTMLElement | null, x: number, y: number) => {
    const r = el?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  const nameOf = (figureId: string) => findFigure(figureId)?.name ?? "Figure";

  const place = (figureId: string, x: number, y: number) => {
    if (full) return setAnnouncement("The tray is full. Put a figure away first.");
    send({ type: "placeFigure", figureId, x, y });
    setAnnouncement(`${nameOf(figureId)} placed`);
  };

  // --- the shelf -----------------------------------------------------------------------------
  const shelfDown = (e: React.PointerEvent<HTMLButtonElement>, figureId: string) => {
    if (full) return;
    shelfDrag.current = { figureId, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const shelfMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = shelfDrag.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_START_PX) return;
    drag.moved = true;
    setGhost({ figureId: drag.figureId, x: e.clientX, y: e.clientY });
  };
  const shelfUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = shelfDrag.current;
    shelfDrag.current = null;
    setGhost(null);
    if (!drag?.moved) return;
    suppressClick.current = true; // the click that follows a drag must not also pick the figure up
    if (inside(trayRef.current, e.clientX, e.clientY)) {
      const { x, y } = toTray(e.clientX, e.clientY);
      place(drag.figureId, x, y);
    }
  };
  const shelfClick = (e: React.MouseEvent<HTMLButtonElement>, figureId: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (full) return;
    if (e.detail === 0) {
      // From the keyboard: put it near the middle, a little apart from the others.
      const n = tray.items.length;
      place(figureId, 0.5 + ((n % 5) - 2) * 0.04, 0.5 + ((Math.floor(n / 5) % 3) - 1) * 0.05);
    } else {
      const next = picked === figureId ? null : figureId;
      setPicked(next);
      setAnnouncement(
        next ? `${nameOf(figureId)} picked up. Tap the tray to place it.` : "Put back on the shelf",
      );
    }
  };

  // --- the tray ------------------------------------------------------------------------------
  const trayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-item]")) return;
    if (!picked) return setSelected(null);
    const { x, y } = toTray(e.clientX, e.clientY);
    place(picked, x, y);
    setPicked(null);
  };

  const itemDown = (e: React.PointerEvent<HTMLButtonElement>, item: TrayItem) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDragging({ itemId: item.id, x: item.x, y: item.y });
  };
  const itemMove = (e: React.PointerEvent<HTMLButtonElement>, item: TrayItem) => {
    if (!dragging || dragging.itemId !== item.id || !dragStart.current) return;
    if (Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) < DRAG_START_PX) return;
    const { x, y } = toTray(e.clientX, e.clientY);
    setDragging({ itemId: item.id, x, y });
    setOverShelf(inside(shelfRef.current, e.clientX, e.clientY));
    const now = e.timeStamp; // the event's own clock
    if (now - lastSent.current >= SEND_EVERY_MS) {
      lastSent.current = now;
      send({ type: "moveItem", itemId: item.id, x, y });
    }
  };
  const itemUp = (e: React.PointerEvent<HTMLButtonElement>, item: TrayItem) => {
    const start = dragStart.current;
    dragStart.current = null;
    setDragging(null);
    setOverShelf(false);
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_START_PX) {
      setSelected(selected === item.id ? null : item.id); // a tap chooses the figure
      return;
    }
    if (inside(shelfRef.current, e.clientX, e.clientY)) {
      send({ type: "removeItem", itemId: item.id });
      setAnnouncement(`${nameOf(item.figureId)} put away`);
      return;
    }
    const { x, y } = toTray(e.clientX, e.clientY);
    send({ type: "moveItem", itemId: item.id, x, y });
  };
  const itemKey = (e: React.KeyboardEvent<HTMLButtonElement>, item: TrayItem) => {
    const step = e.shiftKey ? STEP * 5 : STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      send({ type: "moveItem", itemId: item.id, x: item.x + dx, y: item.y + dy });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      send({ type: "removeItem", itemId: item.id });
      setAnnouncement(`${nameOf(item.figureId)} put away`);
    }
  };
  const putAway = () => {
    const item = tray.items.find((i) => i.id === selected);
    if (!item) return;
    send({ type: "removeItem", itemId: item.id });
    setAnnouncement(`${nameOf(item.figureId)} put away`);
    setSelected(null);
  };

  const shown = FIGURES.filter((f) => f.category === category);
  const tabKey = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = FIGURE_CATEGORIES[(index + delta + FIGURE_CATEGORIES.length) % FIGURE_CATEGORIES.length];
    setCategory(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <section
      className="sandtray"
      aria-label="Sandtray"
      onKeyDown={(e) => {
        if (e.key === "Escape" && picked) {
          setPicked(null);
          setAnnouncement("Cancelled");
        }
      }}
    >
      <div className="sand-status">
        <span>
          {tray.items.length} of {TRAY.maxItems} figures
        </span>
        {picked && <span className="sand-hint">Tap the tray to place {nameOf(picked)}</span>}
        {full && <span className="sand-hint">The tray is full</span>}
        {selected !== null && (
          <button type="button" className="sand-button" onClick={putAway}>
            Put away
          </button>
        )}
      </div>

      <div
        ref={trayRef}
        className={`sand${picked ? " placing" : ""}`}
        role="group"
        aria-label="Sand tray"
        onClick={trayClick}
        style={{ aspectRatio: String(TRAY.aspect) }}
      >
        {tray.items.map((item) => {
          const figure = findFigure(item.figureId);
          if (!figure) return null;
          const pos = dragging?.itemId === item.id ? dragging : item;
          return (
            <button
              key={item.id}
              type="button"
              data-item={item.id}
              className={`sand-figure${selected === item.id ? " selected" : ""}${dragging?.itemId === item.id ? " dragging" : ""}`}
              aria-label={`${figure.alt}, ${word(pos.x, "left", "right")}, ${word(pos.y, "top", "bottom")}`}
              aria-pressed={selected === item.id}
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${TRAY.figureWidth * 100}%` }}
              onPointerDown={(e) => itemDown(e, item)}
              onPointerMove={(e) => itemMove(e, item)}
              onPointerUp={(e) => itemUp(e, item)}
              onPointerCancel={() => {
                dragStart.current = null;
                setDragging(null);
                setOverShelf(false);
              }}
              onKeyDown={(e) => itemKey(e, item)}
            >
              <img src={`/figures/${figure.file}`} alt="" draggable={false} />
            </button>
          );
        })}
      </div>

      <div ref={shelfRef} className={`shelf${overShelf ? " drop" : ""}`}>
        <div role="tablist" aria-label="Figure categories" className="shelf-tabs">
          {FIGURE_CATEGORIES.map((c, i) => (
            <button
              key={c.id}
              id={`tab-${c.id}`}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              aria-controls="shelf-figures"
              tabIndex={category === c.id ? 0 : -1}
              className="shelf-tab"
              onClick={() => setCategory(c.id)}
              onKeyDown={(e) => tabKey(e, i)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div id="shelf-figures" role="tabpanel" aria-labelledby={`tab-${category}`} className="shelf-figures">
          {overShelf && <p className="shelf-drop-hint">Drop here to put it away</p>}
          {shown.map((figure) => (
            <button
              key={figure.id}
              type="button"
              className="shelf-figure"
              aria-label={`${figure.name}${picked === figure.id ? " (picked up)" : ""}`}
              aria-pressed={picked === figure.id}
              disabled={full}
              onPointerDown={(e) => shelfDown(e, figure.id)}
              onPointerMove={shelfMove}
              onPointerUp={shelfUp}
              onPointerCancel={() => {
                shelfDrag.current = null;
                setGhost(null);
              }}
              onClick={(e) => shelfClick(e, figure.id)}
            >
              <img src={`/figures/${figure.file}`} alt="" draggable={false} />
            </button>
          ))}
        </div>
      </div>

      {ghost && (
        <img
          className="sand-ghost"
          src={`/figures/${findFigure(ghost.figureId)?.file}`}
          alt=""
          style={{ left: ghost.x, top: ghost.y }}
        />
      )}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </section>
  );
}
