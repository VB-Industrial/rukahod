import { useRef, useState } from "preact/hooks";
import { t } from "../i18n";
import "./ArmPowerControl.css";

export type ArmPowerState = "on" | "off" | "unknown";
export type ArmPowerControlProps = {
  /** Last commanded relay state, never inferred from the arm WebSocket connection. */
  state: ArmPowerState;
  /** Availability of power control through the rover endpoint. */
  available: boolean;
  /** Resolve only after backend acknowledgment; update state via telemetry. */
  onSetPower: (enabled: boolean) => Promise<void>;
};

/** Shared power controls for desktop and mobile consoles. */
export function ArmPowerControl({ state, available, onSetPower }: ArmPowerControlProps) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const disabled = !available || pending;


  async function requestPower(enabled: boolean) {
    if (disabled || inFlight.current) return;
    if (!enabled && !window.confirm(t("Отключение питания снимет удержание руки."))) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
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

  return (
    <div className="arm-power-control" role="group" aria-label={t("Питание руки")} aria-busy={pending}>
      <div className="arm-power-buttons">
        <button type="button" className="arm-power-button arm-power-button--off"
          disabled={disabled} onClick={() => void requestPower(false)}>{t("Выкл")}</button>
        <button type="button" className="arm-power-button arm-power-button--on"
          disabled={disabled} onClick={() => void requestPower(true)}>{t("Вкл")}</button>
      </div>
      <span className="arm-power-status" role="status" title={t("Показана команда реле, аппаратной обратной связи нет")}>
        {t(pending ? "Переключение питания…" : !available ? "Управление питанием недоступно" : state === "unknown" ? "Состояние питания неизвестно" : state === "on" ? "Задано: Вкл" : "Задано: Выкл")}
      </span>
      {failed && <span role="alert">{t("Не удалось переключить питание руки")}</span>}
    </div>
  );
}
