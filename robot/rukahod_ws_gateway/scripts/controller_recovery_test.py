#!/usr/bin/env python3
"""Lifecycle recovery contract with fake ROS services; never accesses hardware."""
import asyncio
from types import SimpleNamespace as S
from lifecycle_msgs.msg import State
from rukahod_ws_gateway.core.controller_gate import ControllerGate

async def main():
    gate = object.__new__(ControllerGate)
    gate._hardware = 'Ruka2System'
    gate._controller = 'ruka_arm_controller'
    gate._auxiliary_controllers = ('joint_state_broadcaster',)
    for name in ('set_hardware', 'switch', 'load', 'configure', 'controllers'):
        setattr(gate, '_' + name, name)
    calls = []
    async def call(client, request, timeout=1):
        calls.append((client, request))
        if client == 'controllers':
            return S(controller=[S(name='joint_state_broadcaster', state='inactive')])
        return S(ok=True)
    gate._call = call
    await gate._recover_lifecycle(S(state=S(id=State.PRIMARY_STATE_UNCONFIGURED)),
                                  S(state='inactive'), False, False)
    transitions = [r.target_state.id for c, r in calls if c == 'set_hardware']
    assert transitions == [State.PRIMARY_STATE_INACTIVE, State.PRIMARY_STATE_ACTIVE], transitions
    switches = [r for c, r in calls if c == 'switch']
    assert len(switches) == 1
    assert switches[0].activate_controllers == ['ruka_arm_controller', 'joint_state_broadcaster']
    calls.clear()
    async def failed(client, request, timeout=1):
        calls.append((client, request))
        return S(ok=False)
    gate._call = failed
    await gate._recover_lifecycle(S(state=S(id=State.PRIMARY_STATE_INACTIVE)),
                                  S(state='inactive'), False, False)
    assert not any(c == 'switch' for c, _ in calls), 'Activated controller after HW activation failed'
    print('PASS HW lifecycle ordering, both controllers restored, failed activation blocks controller start')

asyncio.run(main())
