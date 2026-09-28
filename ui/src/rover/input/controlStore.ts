import { signal } from "@preact/signals";

export type InputHint = {
  title: string;
  text: string;
};

export const keyboardHint = signal<InputHint>({
  title: "Клавиатура",
  text: "WASD для движения, Shift для boost, Space для STOP, F для света, Q/E для P-1-2-3.",
});

export const gamepadHint = signal<InputHint>({
  title: "Джойстик",
  text: "Ось X рулит, ось Y задаёт ход, ось Z выбирает P-1-2-3, кнопка 0 делает STOP, кнопка 2 переключает фары.",
});
