import { t } from "../i18n";
import { inputSource, setInputSource } from "../store/appState";

export function InputSourcePanel() {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t("Источник ввода")}</h2>
      </div>
      <div className="stacked-buttons">
        <ToggleButton active={inputSource.value === "joystick"} label={t("Джойстик")} onClick={() => setInputSource("joystick")} />
        <ToggleButton
          active={inputSource.value === "keyboard_mouse"}
          label={t("Клавиатура + мышь")}
          onClick={() => setInputSource("keyboard_mouse")}
        />
        <ToggleButton active={inputSource.value === "sliders"} label={t("Слайдеры")} onClick={() => setInputSource("sliders")} />
      </div>
    </section>
  );
}

function ToggleButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={props.active ? "stack-button active" : "stack-button"} onClick={props.onClick} type="button">
      {props.label}
    </button>
  );
}
