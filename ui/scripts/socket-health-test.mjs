import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for (const file of ['src/transport/robotSocket.ts', 'src/rover/transport/robotSocket.ts']) {
  let now = 0;
  const timers = new Map();
  let nextTimer = 1;
  class Socket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;
    static instances = [];
    readyState = 0;
    listeners = {};
    constructor() { Socket.instances.push(this); }
    addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
    emit(name, event = {}) { for (const fn of this.listeners[name] ?? []) fn(event); }
    send() {}
    close() { this.readyState = Socket.CLOSED; }
  }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, WebSocket: Socket, Date: { now: () => now }, Event,
    setInterval: fn => { const id = nextTimer++; timers.set(id, fn); return id; },
    clearInterval: id => timers.delete(id),
  });
  const tick = () => { for (const fn of [...timers.values()]) fn(); };
  let errors = 0, messages = 0;
  const client = new exports.RobotSocketClient('ws://test', {
    onError: () => errors++, onMessage: () => messages++,
  });
  client.connect();
  const old = Socket.instances.at(-1);
  old.readyState = Socket.OPEN; old.emit('open');
  client.send('ping', { heartbeat_id: 'a' });
  now = 8000; old.emit('message', { data: JSON.stringify({ type: 'pong', payload: { heartbeat_id: 'a' } }) });
  now = 15000; tick(); assert.equal(errors, 0);
  // An unrelated pong must not keep a dead session alive.
  old.emit('message', { data: JSON.stringify({ type: 'pong', payload: { heartbeat_id: 'unknown' } }) });
  now = 21000; tick(); assert.equal(errors, 1); assert.equal(client.isConnected(), false);
  const count = messages;
  old.emit('message', { data: JSON.stringify({ type: 'pong', payload: { heartbeat_id: 'a' } }) });
  assert.equal(messages, count);
  client.connect();
  now = 32000; tick(); assert.equal(errors, 2); // Opening timeout.
  client.connect(); client.disconnect(); now = 50000; tick(); assert.equal(errors, 2);
  assert.equal(timers.size, 0);
  console.log('PASS', file, 'pong timeout, stale socket, opening timeout, manual disconnect');
}
