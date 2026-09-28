import { signal } from "@preact/signals";

export const settingsOpen = signal(false);
export const healthClock = signal(Date.now());

export function toggleSettings(): void {
  settingsOpen.value = !settingsOpen.value;
}
