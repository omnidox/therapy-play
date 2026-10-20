# 0008: Pop-ups are accessible, and Escape is the safe action

**Status:** accepted

## Situation

The clue screen and the board editor cover the page. For keyboard and screen reader users they must behave like proper dialogs, and Escape, which people press by reflex, must never cost them something.

## Decision

- One shared `Modal` component handles focus: it moves focus in when it opens, keeps Tab inside it, closes on Escape, and returns focus to where it came from. When the opening control is gone (a used-up tile), focus goes to the first free tile.
- On a clue, Escape means **Put back**: the clue closes and the tile stays available. **Done** is the separate action that uses the tile up.
- In the editor, closing with unsaved edits asks "Discard your changes?" first.
- Revealed answers, score changes and "a screen is waiting" are announced through live regions.
- Tests check the focus behaviour and run an automated accessibility scan (axe) on every screen.

## Consequences

- Colour contrast needs a real browser to measure, and real screen reader testing is still to do. Both are listed as known limits.
- Put back is one more server action, which also helps in practice: a host can try another clue without losing the first.
