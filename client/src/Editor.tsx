import { useState } from "react";
import { Modal } from "./Modal";
import {
  boardToFileText,
  LIMITS,
  parseBoardFile,
  starterBoards,
  validateBoard,
  type BoardData,
} from "@therapy-play/shared";

// Not in every browser's type definitions yet.
type SaveFileHandle = {
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
};
declare global {
  interface Window {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<SaveFileHandle>;
  }
}

type Props = {
  initial: BoardData;
  onUse: (board: BoardData) => void;
  onClose: () => void;
};

const button: React.CSSProperties = {
  minHeight: 48,
  padding: "0 16px",
  fontSize: 16,
  borderRadius: 8,
  border: "1px solid #888",
  cursor: "pointer",
  background: "white",
};
const primary: React.CSSProperties = { ...button, background: "#1f4fa3", color: "white", border: "none" };
const field: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 16,
  fontFamily: "inherit",
  padding: 8,
};
const card: React.CSSProperties = {
  border: "1px solid #bbb",
  borderRadius: 10,
  padding: 12,
  margin: "12px 0",
};

function fileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "board"}.json`;
}

// Edits a copy of the board. Nothing changes in the room until "Use this board".
export function Editor({ initial, onUse, onClose }: Props) {
  const [draft, setDraft] = useState<BoardData>(() => structuredClone(initial));
  const [message, setMessage] = useState("");
  const [askDiscard, setAskDiscard] = useState(false);
  const [starter, setStarter] = useState(starterBoards[0].name);

  // Closing (button or Escape) asks first if there are unsaved edits; Escape on the question backs out.
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const requestClose = () => {
    if (askDiscard) setAskDiscard(false);
    else if (dirty) setAskDiscard(true);
    else onClose();
  };

  const rows = draft.categories[0]?.clues.length ?? 0;
  const values = draft.categories[0]?.clues.map((c) => c.value) ?? [];

  const update = (change: (b: BoardData) => void) => {
    const next = structuredClone(draft);
    change(next);
    setDraft(next);
    setMessage("");
  };

  const addCategory = () =>
    update((b) => {
      b.categories.push({
        name: "",
        clues: values.map((value) => ({ value, question: "", answer: "" })),
      });
    });

  const addRow = () =>
    update((b) => {
      const next = (values[values.length - 1] ?? 0) + 100;
      b.categories.forEach((c) => c.clues.push({ value: next, question: "", answer: "" }));
    });

  const removeLastRow = () => update((b) => b.categories.forEach((c) => c.clues.pop()));

  const use = () => {
    const clean = validateBoard(draft);
    if (clean === null) {
      setMessage(
        "Every name, question and answer needs some text, and points must be whole numbers. Fix the empty boxes and try again.",
      );
      return;
    }
    onUse(clean);
  };

  const save = async () => {
    const clean = validateBoard(draft);
    if (clean === null) {
      setMessage("Fill in every empty box before saving.");
      return;
    }
    const text = boardToFileText(clean);
    // Chrome and Edge on a computer can open a "Save as" window so she picks the folder.
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName(clean.name),
          types: [{ description: "Board file", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        setMessage("Saved. Nothing was sent anywhere.");
      } catch (error) {
        // Closing the window without saving is not an error.
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMessage("Could not save the file. Try again.");
        }
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName(clean.name);
    a.click();
    URL.revokeObjectURL(url);
    setMessage(
      "Saved to your Downloads folder (your browser may have asked where). Nothing was sent anywhere.",
    );
  };

  const load = async (file: File | undefined) => {
    if (!file) return;
    const board = parseBoardFile(await file.text());
    if (board === null) {
      setMessage("That file is not a board from this app, or it is damaged.");
      return;
    }
    setDraft(board);
    setMessage(`Loaded "${board.name}". Press "Use this board" to play it.`);
  };

  return (
    <Modal
      label="Edit board"
      onEscape={requestClose}
      fallbackFocus="button"
      style={{ position: "fixed", inset: 0, background: "white", overflowY: "auto", padding: 16, zIndex: 10 }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, sans-serif", fontSize: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>Edit board</h1>
          <button style={button} onClick={requestClose}>
            Close
          </button>
        </div>

        {askDiscard && (
          <div role="alert" style={{ background: "#fff3c4", padding: 12, borderRadius: 8, margin: "12px 0" }}>
            <strong>Discard your changes?</strong>{" "}
            <button style={button} onClick={() => setAskDiscard(false)}>
              Keep editing
            </button>{" "}
            <button style={button} onClick={onClose}>
              Discard changes
            </button>
          </div>
        )}

        <p role="note" className="privacy-note">
          Do not put real names or personal details about a child in a board. The server holds the board in
          memory while the room is open, and a saved file stays on your own device.
        </p>

        <div style={card}>
          <strong>Start from</strong>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <select
              aria-label="Starter board"
              value={starter}
              onChange={(e) => setStarter(e.target.value)}
              style={{ ...field, width: "auto", flex: 1, minHeight: 48 }}
            >
              {starterBoards.map((b) => (
                <option key={b.name}>{b.name}</option>
              ))}
            </select>
            <button
              style={button}
              onClick={() => {
                const found = starterBoards.find((b) => b.name === starter);
                if (found) {
                  setDraft(structuredClone(found));
                  setMessage("");
                }
              }}
            >
              Use as starting point
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 14 }}>
            The starter boards are placeholder examples. Change any of the words.
          </p>
        </div>

        <label>
          Board name
          <input
            style={field}
            value={draft.name}
            maxLength={LIMITS.boardName}
            onChange={(e) => update((b) => void (b.name = e.target.value))}
          />
        </label>

        <div style={card}>
          <strong>Points for each row</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
            {values.map((v, ri) => (
              <input
                key={ri}
                aria-label={`Points for row ${ri + 1}`}
                type="number"
                min={1}
                max={LIMITS.maxValue}
                value={v}
                style={{ ...field, width: 80 }}
                onChange={(e) =>
                  update((b) => b.categories.forEach((c) => (c.clues[ri].value = Number(e.target.value))))
                }
              />
            ))}
          </div>
          <button style={button} onClick={addRow} disabled={rows >= LIMITS.maxRows}>
            Add row
          </button>{" "}
          <button style={button} onClick={removeLastRow} disabled={rows <= 1}>
            Remove last row
          </button>
        </div>

        <div className="editor-grid">
          {draft.categories.map((cat, ci) => (
            <div key={ci} style={card}>
              <label>
                Category {ci + 1} name
                <input
                  style={field}
                  value={cat.name}
                  maxLength={LIMITS.categoryName}
                  onChange={(e) => update((b) => void (b.categories[ci].name = e.target.value))}
                />
              </label>
              {cat.clues.map((clue, ri) => (
                <div key={ri} style={{ marginTop: 12 }}>
                  <strong>{clue.value} points</strong>
                  <textarea
                    aria-label={`${cat.name || `Category ${ci + 1}`}, ${clue.value} question`}
                    placeholder="Question or prompt"
                    style={{ ...field, minHeight: 64 }}
                    value={clue.question}
                    maxLength={LIMITS.question}
                    onChange={(e) =>
                      update((b) => void (b.categories[ci].clues[ri].question = e.target.value))
                    }
                  />
                  <input
                    aria-label={`${cat.name || `Category ${ci + 1}`}, ${clue.value} answer`}
                    placeholder='Answer (for open prompts, write something like "Any answer works")'
                    style={field}
                    value={clue.answer}
                    maxLength={LIMITS.answer}
                    onChange={(e) => update((b) => void (b.categories[ci].clues[ri].answer = e.target.value))}
                  />
                </div>
              ))}
              <p>
                <button
                  style={button}
                  disabled={draft.categories.length <= 1}
                  onClick={() => update((b) => void b.categories.splice(ci, 1))}
                >
                  Remove this category
                </button>
              </p>
            </div>
          ))}
        </div>

        <p>
          <button
            style={button}
            onClick={addCategory}
            disabled={draft.categories.length >= LIMITS.maxCategories}
          >
            Add category
          </button>
        </p>

        {message && (
          <p role="status" style={{ background: "#fff3c4", padding: 12, borderRadius: 8 }}>
            {message}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 32px" }}>
          <button style={primary} onClick={use}>
            Use this board (starts a new game)
          </button>
          <button style={button} onClick={() => void save()}>
            Save to my device
          </button>
          <label className="file-button" style={{ ...button, display: "inline-flex", alignItems: "center" }}>
            Load from file
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                void load(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </Modal>
  );
}
