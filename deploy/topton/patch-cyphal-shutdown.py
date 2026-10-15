#!/usr/bin/env python3
"""Fix shutdown of a Linux CyphalInterface used without background threads."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
for relative in ('cyphal/cyphal.h', 'src/cyphal.h'):
    path = root / relative
    if not path.exists():
        continue
    data = path.read_bytes()
    for name in ('is_rx_terminated', 'is_tx_terminated'):
        old = f'std::atomic<bool> {name};'.encode()
        new = f'std::atomic<bool> {name}{{true}};'.encode()
        if old not in data and new not in data:
            raise RuntimeError(f'Unexpected thread flag declaration: {path}: {name}')
        data = data.replace(old, new)
    path.write_bytes(data)
for relative in ('cyphal/cyphal.cpp', 'src/cyphal.cpp'):
    path = root / relative
    if not path.exists():
        continue
    data = path.read_bytes()
    newline = b'\r\n' if b'\r\n' in data else b'\n'
    marker = b'void CyphalInterface::start_threads(uint64_t tx_delay_micros) {' + newline
    reset = b'    is_rx_terminated.store(false);' + newline + b'    is_tx_terminated.store(false);' + newline
    if marker not in data:
        raise RuntimeError(f'Unexpected start_threads definition: {path}')
    if marker + reset not in data:
        data = data.replace(marker, marker + reset, 1)
    path.write_bytes(data)
print('Cyphal shutdown flags patched (idempotent)')
