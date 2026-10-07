#!/usr/bin/env python3
"""Read-only startup check: wait for all six motor heartbeats."""
import socket
import struct
import time

iface = "vcan2.0"
expected = set(range(1, 7))
seen = {}
sock = socket.socket(socket.PF_CAN, socket.SOCK_RAW, socket.CAN_RAW)
sock.setsockopt(socket.SOL_CAN_RAW, socket.CAN_RAW_FD_FRAMES, 1)
sock.bind((iface,))
sock.settimeout(0.5)
deadline = time.monotonic() + 30
while time.monotonic() < deadline:
    try:
        frame = sock.recv(72)
    except socket.timeout:
        continue
    can_id, length = struct.unpack_from("=IB", frame)
    if can_id & (1 << 25) or ((can_id >> 8) & 8191) != 7509 or length < 8:
        continue
    node = can_id & 127
    data = frame[8:8 + length]
    if node in expected and data[4] & 3 == 0 and data[5] & 7 == 0:
        seen[node] = time.monotonic()
    now = time.monotonic()
    if all(now - seen.get(node, -100) < 3 for node in expected):
        print("All rover motor heartbeats present", flush=True)
        break
else:
    raise SystemExit("Rover heartbeat startup timeout")
