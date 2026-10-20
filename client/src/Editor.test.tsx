import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { feelingsBoard } from "@therapy-play/shared";
import { accessibilityProblems } from "./a11y";
import { Editor } from "./Editor";

afterEach(cleanup);

test("Escape closes the editor straight away when nothing was changed", async () => {
  const onClose = vi.fn();
  render(<Editor initial={feelingsBoard} onUse={() => {}} onClose={onClose} />);
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("with unsaved changes, Escape asks first; Escape again backs out; Discard closes", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<Editor initial={feelingsBoard} onUse={() => {}} onClose={onClose} />);
  await user.type(screen.getByLabelText("Board name"), " extra");

  await user.keyboard("{Escape}");
  expect(screen.getByText("Discard your changes?")).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();

  await user.keyboard("{Escape}"); // backs out of the question
  expect(screen.queryByText("Discard your changes?")).toBeNull();
  expect(onClose).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Close" }));
  await user.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the editor reminds the host not to put personal details in a board", () => {
  render(<Editor initial={feelingsBoard} onUse={() => {}} onClose={() => {}} />);
  expect(screen.getByRole("note").textContent).toContain("Do not put real names");
});

test("the file picker can be reached with the keyboard", () => {
  render(<Editor initial={feelingsBoard} onUse={() => {}} onClose={() => {}} />);
  const picker = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  expect(picker.style.display).not.toBe("none"); // a display:none input cannot take focus
  expect(picker.className).toContain("sr-only");
});

test("the editor has no accessibility problems", async () => {
  render(<Editor initial={feelingsBoard} onUse={() => {}} onClose={() => {}} />);
  expect(await accessibilityProblems(document.body)).toEqual([]);
});
