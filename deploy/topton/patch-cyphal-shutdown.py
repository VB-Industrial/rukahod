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
# This library permits one provider at a time. Release its allocator on teardown
# so a later configure() doesn't flag legitimate reconstruction as a duplicate.
for relative in ('cyphal/providers/provider.cpp', 'src/cyphal.cpp'):
    path = root / relative
    if not path.exists():
        continue
    data = path.read_bytes()
    newline = b'\r\n' if b'\r\n' in data else b'\n'
    old = b'AbstractCANProvider::~AbstractCANProvider() = default;'
    new = newline.join((b'AbstractCANProvider::~AbstractCANProvider() {',
                        b'    clear_queue();', b'    _alloc_ptr.reset();', b'}'))
    if old not in data and new not in data:
        raise RuntimeError(f'Unexpected provider destructor: {path}')
    path.write_bytes(data.replace(old, new))
# The Linux provider also owns its SocketCAN descriptor.
for relative in ('cyphal/providers/LinuxCAN.h',):
    path = root / relative
    if not path.exists():
        continue
    data = path.read_bytes()
    marker = b'    uint32_t len_to_dlc(size_t len) override;'
    declaration = b'    ~LinuxCAN() override;'
    if declaration not in data:
        if marker not in data:
            raise RuntimeError(f'Unexpected LinuxCAN declaration: {path}')
        newline = b'\r\n' if b'\r\n' in data else b'\n'
        data = data.replace(marker, declaration + newline + marker, 1)
    path.write_bytes(data)
for relative in ('cyphal/providers/LinuxCAN.cpp',):
    path = root / relative
    if not path.exists():
        continue
    data = path.read_bytes()
    marker = b'int LinuxCAN::write_frame('
    if b'LinuxCAN::~LinuxCAN()' not in data:
        if marker not in data:
            raise RuntimeError(f'Unexpected LinuxCAN implementation: {path}')
        newline = b'\r\n' if b'\r\n' in data else b'\n'
        destructor = newline.join((b'LinuxCAN::~LinuxCAN() {',
            b'    if (socketcan_handler >= 0) ::close(socketcan_handler);', b'}', b'', b''))
        data = data.replace(marker, destructor + marker, 1)
    path.write_bytes(data)
print('Cyphal allocator and SocketCAN cleanup patched (idempotent)')
