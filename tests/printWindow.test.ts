import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPrintWindow } from '../src/lib/printWindow';

function setup() {
  const app = new EventTarget();
  const popup = new EventTarget();
  let closed = false;
  let focused = 0;
  let script = '';
  Object.assign(popup, {
    get closed() { return closed; },
    close: () => { closed = true; },
    document: {
      write: () => {}, close: () => {},
      createElement: () => ({ textContent: '' }),
      head: { prepend: () => {} },
      body: { appendChild: (element: { textContent: string }) => { script = element.textContent; } },
    },
  });
  Object.assign(app, { open: () => popup, focus: () => { focused++; }, location: { href: 'http://localhost:8080/' } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: app });
  return { app, popup, closed: () => closed, focused: () => focused, script: () => script };
}

test('finishing or cancelling native print closes the popup and restores app focus once', () => {
  const state = setup();
  let started = 0;
  openPrintWindow('<html><body>invoice</body></html>', () => { started++; });
  state.popup.dispatchEvent(new Event('beforeprint'));
  state.popup.dispatchEvent(new Event('afterprint'));
  state.popup.dispatchEvent(new Event('afterprint'));
  assert.equal(started, 1);
  assert.equal(state.closed(), true);
  assert.equal(state.focused(), 1);
});

test('returning to the app cleans up when afterprint is missing, but not before print starts', () => {
  const state = setup();
  openPrintWindow('<html><body>invoice</body></html>');
  state.app.dispatchEvent(new Event('focus'));
  assert.equal(state.closed(), false);
  state.popup.dispatchEvent(new Event('beforeprint'));
  state.app.dispatchEvent(new Event('focus'));
  assert.equal(state.closed(), true);
  assert.equal(state.focused(), 1);
});

test('a blocked popup does not release the invoice dialog', () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { open: () => null } });
  let started = false;
  assert.equal(openPrintWindow('', () => { started = true; }), null);
  assert.equal(started, false);
});