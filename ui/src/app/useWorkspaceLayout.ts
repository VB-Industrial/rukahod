import { useEffect, useRef, useState } from "preact/hooks";

export type ResizeAxis = "topVertical" | "bottomVertical" | "leftHorizontal" | "rightHorizontal";

type WorkspaceLayout = {
  topX: number;
  bottomX: number;
  leftY: number;
  rightY: number;
  sharedAxis: "horizontal" | "vertical";
};

const STORAGE_KEY = "rukahod.workspace.layout.v1";
const DEFAULT_LAYOUT: WorkspaceLayout = { topX: 0.5, bottomX: 0.5, leftY: 0.65, rightY: 0.65, sharedAxis: "horizontal" };

function loadLayout(): WorkspaceLayout {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && (saved.sharedAxis === "horizontal" || saved.sharedAxis === "vertical") &&
      ["topX", "bottomX", "leftY", "rightY"].every((key) =>
        Number.isFinite(saved[key]) && saved[key] >= 0.15 && saved[key] <= 0.85)) {
      return saved as WorkspaceLayout;
    }
  } catch {
    // Ignore browser storage restrictions and invalid saved layouts.
  }
  return { ...DEFAULT_LAYOUT };
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

export function useWorkspaceLayout() {
  const workspaceRef = useRef<HTMLElement>(null);
  const activeAxis = useRef<ResizeAxis | null>(null);
  const [layout, setLayout] = useState<WorkspaceLayout>(loadLayout);
  const layoutRef = useRef(layout);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const observer = new ResizeObserver(() => {
      if (!window.matchMedia("(min-width: 1501px) and (min-height: 560px)").matches) return;
      const { width, height } = workspace.getBoundingClientRect();
      if (!width || !height) return;
      const previous = layoutRef.current;
      const next = {
        ...previous,
        topX: clamp(previous.topX, 340 / width, 1 - 340 / width),
        bottomX: clamp(previous.bottomX, 700 / width, 1 - 500 / width),
        leftY: clamp(previous.leftY, 180 / height, 1 - 260 / height),
        rightY: clamp(previous.rightY, 180 / height, 1 - 260 / height),
      };
      if (next.sharedAxis === "horizontal") next.rightY = next.leftY;
      else next.bottomX = next.topX;
      if (next.topX !== previous.topX || next.bottomX !== previous.bottomX ||
          next.leftY !== previous.leftY || next.rightY !== previous.rightY) {
        layoutRef.current = next;
        setLayout(next);
      }
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  const update = (axis: ResizeAxis, rawValue: number) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const previous = layoutRef.current;
    const next = { ...previous };
    if (axis === "topVertical") {
      next.sharedAxis = "horizontal";
      next.leftY = next.rightY = (previous.leftY + previous.rightY) / 2;
      next.topX = clamp(rawValue, 340 / rect.width, 1 - 340 / rect.width);
    } else if (axis === "bottomVertical") {
      next.sharedAxis = "horizontal";
      next.leftY = next.rightY = (previous.leftY + previous.rightY) / 2;
      next.bottomX = clamp(rawValue, 700 / rect.width, 1 - 500 / rect.width);
    } else if (axis === "leftHorizontal") {
      next.sharedAxis = "vertical";
      next.topX = next.bottomX = (previous.topX + previous.bottomX) / 2;
      next.leftY = clamp(rawValue, 180 / rect.height, 1 - 260 / rect.height);
    } else {
      next.sharedAxis = "vertical";
      next.topX = next.bottomX = (previous.topX + previous.bottomX) / 2;
      next.rightY = clamp(rawValue, 180 / rect.height, 1 - 260 / rect.height);
    }
    layoutRef.current = next;
    setLayout(next);
  };

  const start = (axis: ResizeAxis, event: PointerEvent) => {
    activeAxis.current = axis;
    event.currentTarget instanceof Element && event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const move = (event: PointerEvent) => {
    const axis = activeAxis.current;
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!axis || !rect) return;
    const value = axis.endsWith("Vertical")
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
    update(axis, value);
  };

  const stop = () => {
    if (!activeAxis.current) return;
    activeAxis.current = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutRef.current)); } catch { /* storage unavailable */ }
  };

  const keyboardResize = (axis: ResizeAxis, event: KeyboardEvent) => {
    const horizontal = axis.endsWith("Vertical");
    const step = event.shiftKey ? 0.04 : 0.01;
    const direction = horizontal
      ? event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0
      : event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!direction) return;
    event.preventDefault();
    const key = axis === "topVertical" ? "topX" : axis === "bottomVertical" ? "bottomX" :
      axis === "leftHorizontal" ? "leftY" : "rightY";
    update(axis, layoutRef.current[key] + direction * step);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutRef.current)); } catch { /* storage unavailable */ }
  };

  const reset = () => {
    const next = { ...DEFAULT_LAYOUT };
    layoutRef.current = next;
    setLayout(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  return { workspaceRef, layout, start, move, stop, keyboardResize, reset };
}
