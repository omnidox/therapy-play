import { TRAY, clampPosition, findFigure, type TrayView } from "@therapy-play/shared";

export type TrayState = { items: { id: number; figureId: string; x: number; y: number }[]; nextId: number };

export function emptyTray(): TrayState {
  return { items: [], nextId: 1 };
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// Each action returns false when it does not apply (unknown figure, tray full, no such item),
// like the game rules. A placed or moved figure goes to the front.

export function placeFigure(tray: TrayState, figureId: unknown, x: unknown, y: unknown): boolean {
  if (!findFigure(figureId) || !isNumber(x) || !isNumber(y)) return false;
  if (tray.items.length >= TRAY.maxItems) return false;
  tray.items.push({ id: tray.nextId++, figureId: figureId as string, ...clampPosition(x, y) });
  return true;
}

export function moveItem(tray: TrayState, itemId: unknown, x: unknown, y: unknown): boolean {
  if (!isNumber(x) || !isNumber(y)) return false;
  const index = tray.items.findIndex((item) => item.id === itemId);
  if (index === -1) return false;
  const [item] = tray.items.splice(index, 1);
  tray.items.push({ ...item, ...clampPosition(x, y) });
  return true;
}

export function removeItem(tray: TrayState, itemId: unknown): boolean {
  const index = tray.items.findIndex((item) => item.id === itemId);
  if (index === -1) return false;
  tray.items.splice(index, 1);
  return true;
}

export function clearTray(tray: TrayState): void {
  tray.items = [];
}

export function toView(tray: TrayState): TrayView {
  return { items: tray.items.map((item) => ({ ...item })) };
}
