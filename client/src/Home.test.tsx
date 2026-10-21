import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { accessibilityProblems } from "./a11y";
import { Home } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

// Stubs the two requests the home page makes: /config and POST /rooms.
function stubServer(config: object, rooms: Reply = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === "/config") return { ok: true, status: 200, json: async () => config };
      const status = rooms.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name: string) => rooms.headers?.[name] ?? null },
        json: async () => rooms.body ?? { code: "ROOM123", hostKey: "KEY456" },
      };
    }),
  );
  return calls;
}

test("without a passcode requirement there is no passcode field, and a room is created", async () => {
  const calls = stubServer({ demo: true, passcodeRequired: false });
  const go = vi.fn();
  render(<Home go={go} />);
  expect(screen.queryByLabelText(/passcode/i)).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "New room" }));
  expect(go).toHaveBeenCalledWith("/host/ROOM123");
  expect(calls.find((c) => c.url === "/rooms")?.init?.body).toBeUndefined();
  expect(JSON.parse(localStorage.getItem("hostKey:ROOM123")!).value).toBe("KEY456");
});

test("when a passcode is required, the field shows and the button waits for it", async () => {
  const calls = stubServer({ demo: false, passcodeRequired: true });
  const go = vi.fn();
  const user = userEvent.setup();
  const { container } = render(<Home go={go} />);
  const field = await screen.findByLabelText("Therapist passcode");
  expect((field as HTMLInputElement).type).toBe("password");
  const button = screen.getByRole("button", { name: "New room" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(await accessibilityProblems(container)).toEqual([]);
  await user.type(field, "a-long-passcode");
  expect(button.disabled).toBe(false);
  await user.click(button);
  const post = calls.find((c) => c.url === "/rooms");
  expect(JSON.parse(post!.init!.body as string)).toEqual({ passcode: "a-long-passcode" });
  expect(go).toHaveBeenCalledWith("/host/ROOM123");
});

test("a wrong passcode shows a message and does not create a room", async () => {
  stubServer({ passcodeRequired: true }, { status: 401, body: { error: "passcode" } });
  const go = vi.fn();
  const user = userEvent.setup();
  render(<Home go={go} />);
  await user.type(await screen.findByLabelText("Therapist passcode"), "not-the-right-one");
  await user.click(screen.getByRole("button", { name: "New room" }));
  expect((await screen.findByRole("alert")).textContent).toContain("not right");
  expect(go).not.toHaveBeenCalled();
});

test("too many tries tells the person how long to wait", async () => {
  stubServer({ passcodeRequired: true }, { status: 429, headers: { "Retry-After": "900" } });
  const user = userEvent.setup();
  render(<Home go={() => {}} />);
  await user.type(await screen.findByLabelText("Therapist passcode"), "whatever-it-is");
  await user.click(screen.getByRole("button", { name: "New room" }));
  expect((await screen.findByRole("alert")).textContent).toContain("15 minutes");
});

test("if the server asks for a passcode the page did not expect, the field appears", async () => {
  stubServer({ passcodeRequired: false }, { status: 401 });
  const user = userEvent.setup();
  render(<Home go={() => {}} />);
  await user.click(screen.getByRole("button", { name: "New room" }));
  expect(await screen.findByLabelText("Therapist passcode")).toBeTruthy();
  expect((await screen.findByRole("alert")).textContent).toContain("Enter the passcode");
});

test("a room-creation limit and a busy server each get their own plain message", async () => {
  const user = userEvent.setup();
  stubServer(
    { demo: true, passcodeRequired: false },
    { status: 429, body: { error: "too_many_rooms" }, headers: { "Retry-After": "600" } },
  );
  const { unmount } = render(<Home go={() => {}} />);
  await user.click(screen.getByRole("button", { name: "New room" }));
  expect((await screen.findByRole("alert")).textContent).toContain("rooms were created");
  expect((await screen.findByRole("alert")).textContent).toContain("10 minutes");
  unmount();
  vi.unstubAllGlobals();

  stubServer({ demo: true, passcodeRequired: false }, { status: 503, body: { error: "busy" } });
  render(<Home go={() => {}} />);
  await user.click(screen.getByRole("button", { name: "New room" }));
  expect((await screen.findByRole("alert")).textContent).toContain("busy");
});
