import { ArmPowerControl } from "../components/ArmPowerControl";
import { armPowerCommanded, armPowerAvailable, setArmPowerFromUi } from "../rover/transport/robotConnectionStore";

export function ArmPowerPanel() {
  const commanded = armPowerCommanded.value;
  return <section className="panel arm-power-panel"><ArmPowerControl
    state={commanded === null ? "unknown" : commanded ? "on" : "off"}
    available={armPowerAvailable.value} onSetPower={setArmPowerFromUi} /></section>;
}
