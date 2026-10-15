import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../i18n";
import "./ArmPowerControl.css";

export type ArmPowerState = "on" | "off" | "unknown";
export type ArmPowerControlProps = {
  /** Relay telemetry, never inferred from the arm WebSocket connection. */
  state: ArmPowerState;
  /** Availability of power control through the rover endpoint. */
  available: boolean;
  /** Resolve only after backend acknowledgment; update state via telemetry. */
  onSetPower: (enabled: boolean) => Promise<void>;
};

/** Prepared for placement in either console; not mounted on a page yet. */
export function ArmPowerControl({ state, available, onSetPower }: ArmPowerControlProps) {
  const [pending, setPending] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const disabled = !available || state === "unknown" || pending;

  useEffect(() => { setConfirmOff(false); }, [available, state]);

  async function requestPower(enabled: boolean) {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    setConfirmOff(false);
    try {
      await onSetPower(enabled);
      // The callback doesn't prove physical power: display telemetry only.
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const label = pending ? "Переключение питания…" : state === "on" ? "Выключить руку" : state === "off" ? "Включить руку" : "Питание руки";
  return (
    <div className="arm-power-control" role="group" aria-label={t("Питание руки")} aria-busy={pending}>
      <span className={`arm-power-status arm-power-status--${available ? state : "unknown"}`} role="status">
        {t(!available ? "Управление питанием недоступно" : state === "unknown" ? "Состояние питания неизвестно" : state === "on" ? "Питание руки включено" : "Питание руки выключено")}
      </span>
      <button type="button" className={`arm-power-button${state === "on" ? " arm-power-button--off" : ""}`}
        disabled={disabled || confirmOff} onClick={() => state === "on" ? setConfirmOff(true) : void requestPower(true)}>
        {t(label)}
      </button>
      {confirmOff && available && state === "on" && (
        <div className="arm-power-confirm">
          <span>{t("Отключение питания снимет удержание руки.")}</span>
          <button type="button" disabled={pending} onClick={() => void requestPower(false)}>{t("Подтвердить отключение")}</button>
          <button type="button" onClick={() => setConfirmOff(false)}>{t("Отмена")}</button>
        </div>
      )}
      {failed && <span role="alert">{t("Не удалось переключить питание руки")}</span>}
    </div>
  );
}
