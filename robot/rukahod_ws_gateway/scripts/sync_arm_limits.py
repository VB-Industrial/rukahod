#!/usr/bin/env python3
"""Read-only Cyphal calibration snapshot; never invokes motion registers."""
import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
from datetime import datetime, timezone

p = argparse.ArgumentParser()
p.add_argument('--interface', default='vcan1.0')
p.add_argument('--output', required=True)
p.add_argument('--yakut', default='/usr/local/bin/y')
a = p.parse_args()
env = dict(os.environ, UAVCAN__CAN__IFACE='socketcan:' + a.interface)
def read(register):
    result = subprocess.run([a.yakut, 'r', '21-27', register], env=env, capture_output=True, text=True, timeout=30, check=True)
    return json.loads(result.stdout)
limits, calibration = read('limits'), read('cal_data')
joints = {}
for index, node in enumerate(range(21,27), 1):
    v, cal = limits[str(node)], calibration[str(node)]
    if len(v) != 9 or len(cal) < 8 or cal[0] != 1 or v[0] != 1 or not all(math.isfinite(x) for x in v):
        raise SystemExit(f'Node {node}: missing calibration/localization or unsupported register contract')
    physical_lo, physical_hi = v[1], v[6]
    hard_lo, soft_lo, soft_hi, hard_hi = v[2:6]
    if not physical_lo < physical_hi or not hard_lo <= soft_lo < soft_hi <= hard_hi:
        raise SystemExit(f'Node {node}: inconsistent bounds')
    lo, hi = max(physical_lo, soft_lo), min(physical_hi, soft_hi)
    if lo >= hi: raise SystemExit(f'Node {node}: empty allowed range')
    joints[f'joint_{index}'] = dict(node_id=node, min_position=lo, max_position=hi,
        physical_lower=physical_lo, physical_upper=physical_hi, hard_lower=hard_lo,
        hard_upper=hard_hi, soft_lower=soft_lo, soft_upper=soft_hi, raw_limits=v, raw_calibration=cal)
output = Path(a.output);output.parent.mkdir(parents=True, exist_ok=True)
data = dict(schema_version=1, interface=a.interface, captured_at=datetime.now(timezone.utc).isoformat(), joint_limits=joints)
with tempfile.NamedTemporaryFile('w', dir=output.parent, delete=False) as f:
    json.dump(data,f,indent=2);f.write('\n');tmp=f.name
os.replace(tmp,output)
print(json.dumps({k:[v['min_position'],v['max_position']] for k,v in joints.items()}))
