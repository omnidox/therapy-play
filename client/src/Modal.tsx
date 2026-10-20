import { useEffect, useRef } from "react";

type Props = {
  label: string;
  onEscape: () => void;
  // Where focus goes when the pop-up closes and the control that opened it is gone or disabled:
  // the first of these selectors that matches an enabled control.
  fallbackFocus?: string | string[];
  style?: React.CSSProperties;
  children: React.ReactNode;
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// A pop-up that covers the page and behaves well with a keyboard or a screen reader:
// focus moves in when it opens, Tab stays inside it, Escape closes it, and focus goes
// back to where it came from.
export function Modal({ label, onEscape, fallbackFocus, style, children }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const escape = useRef(onEscape);
  const fallback = useRef(fallbackFocus);
  useEffect(() => {
    escape.current = onEscape;
    fallback.current = fallbackFocus; // read when the pop-up closes, so it must be the latest
  });

  useEffect(() => {
    const dialog = node.current;
    if (!dialog) return;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;
    const items = () =>
      [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("disabled"));

    (items()[0] ?? dialog).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        escape.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && opener.isConnected && !opener.hasAttribute("disabled")) {
        opener.focus();
        return;
      }
      for (const selector of [fallback.current ?? []].flat()) {
        const target = document.querySelector<HTMLElement>(selector);
        if (target && !target.hasAttribute("disabled")) {
          target.focus();
          return;
        }
      }
    };
  }, []);

  return (
    <div ref={node} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={style}>
      {children}
    </div>
  );
}
