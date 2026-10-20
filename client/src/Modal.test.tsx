import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

afterEach(cleanup);

function Harness({ onEscape }: { onEscape: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      <button>Behind</button>
      {open && (
        <Modal
          label="Test pop-up"
          onEscape={() => {
            onEscape();
            setOpen(false);
          }}
        >
          <button>One</button>
          <button>Two</button>
        </Modal>
      )}
    </div>
  );
}

test("focus moves into the pop-up, stays inside it, and wraps both ways", async () => {
  const user = userEvent.setup();
  render(<Harness onEscape={() => {}} />);
  await user.click(screen.getByText("Open"));
  expect(screen.getByRole("dialog", { name: "Test pop-up" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByText("One"));
  await user.tab();
  expect(document.activeElement).toBe(screen.getByText("Two"));
  await user.tab(); // past the last button: back to the first, never to the page behind
  expect(document.activeElement).toBe(screen.getByText("One"));
  await user.tab({ shift: true }); // before the first button: round to the last
  expect(document.activeElement).toBe(screen.getByText("Two"));
});

test("Escape closes the pop-up and focus returns to the button that opened it", async () => {
  const user = userEvent.setup();
  const onEscape = vi.fn();
  render(<Harness onEscape={onEscape} />);
  await user.click(screen.getByText("Open"));
  await user.keyboard("{Escape}");
  expect(onEscape).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(screen.getByText("Open"));
});
