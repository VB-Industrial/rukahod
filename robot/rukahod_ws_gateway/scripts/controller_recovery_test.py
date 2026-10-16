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
    # Startup failure: recover only once both launch-owned controllers are
    # configured, and never race the normal active-HW startup sequence.
    gate._components = 'components'
    gate._recover_initial = False
    gate._seen_ready = False
    gate._last_recovery = 0
    gate._recovery_task = None
    states = S(component=[S(name='Ruka2System', state=S(id=State.PRIMARY_STATE_UNCONFIGURED))])
    controllers = S(controller=[])
    recovered = []
    async def status_call(client, request, timeout=1):
        return states if client == 'components' else controllers
    async def recover(*args):
        recovered.append(args)
    gate._call = status_call
    gate._recover = recover
    assert not await gate.is_ready()
    assert gate._recovery_task is None, 'Raced controller spawning'
    controllers.controller = [S(name='ruka_arm_controller', state='inactive'),
                              S(name='joint_state_broadcaster', state='inactive')]
    states.component[0].state.id = State.PRIMARY_STATE_ACTIVE
    assert not await gate.is_ready()
    assert gate._recovery_task is None, 'Raced normal activation'
    states.component[0].state.id = State.PRIMARY_STATE_UNCONFIGURED
    assert not await gate.is_ready()
    await gate._recovery_task
    assert len(recovered) == 1, 'Failed to recover first startup timeout'
    print('PASS lifecycle recovery, startup timeout recovery and startup race guards')

asyncio.run(main())
