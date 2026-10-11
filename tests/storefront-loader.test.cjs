const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The runtime stands in for assets/react/storefront.js: it counts loads and mounts.
const runtimeSource = 'globalThis.loads = (globalThis.loads || 0) + 1; window.FlexStorefront = { mount(name, element, props) { globalThis.mounts.push([name, props.initialValue]); return true; } };';
// A new URL per test, since a module runs only once per URL.
const runtimeUrl = () => 'data:text/javascript;base64,' + Buffer.from(runtimeSource + '//' + Math.random()).toString('base64');

async function loader({ lazyClients = false, cartButton = true, value = '' } = {}) {
  globalThis.loads = 0;
  globalThis.mounts = [];
  const url = runtimeUrl();
  const listeners = {};
  const input = { value, selectionStart: value.length };
  const search = {
    querySelector: () => input,
    addEventListener: (type, listener) => { listeners[type] = listener; },
  };
  global.window = lazyClients ? { FlexStorefrontLazyClients: true } : {};
  global.document = {
    activeElement: null,
    querySelector: (selector) => selector.startsWith('script[') ? { dataset: { flexStorefrontRuntime: url } } : (cartButton ? {} : null),
    querySelectorAll: () => [search],
  };
  global.requestAnimationFrame = () => 0;
  const source = fs.readFileSync(path.join(__dirname, '../assets/storefront-loader.js'), 'utf8');
  await import('data:text/javascript;base64,' + Buffer.from(source + '\n//' + Math.random()).toString('base64'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { listeners, input };
}

test('the runtime is not loaded until something needs it', async () => {
  await loader({ lazyClients: true });
  assert.equal(globalThis.loads, 0);
  assert.equal(typeof window.FlexStorefrontLoader.load, 'function');
  const runtime = await window.FlexStorefrontLoader.load();
  await window.FlexStorefrontLoader.load();
  assert.equal(globalThis.loads, 1, 'loaded once');
  assert.equal(runtime, window.FlexStorefront);
});

test('the header search loads the runtime when the visitor turns to it and keeps the text', async () => {
  const { listeners, input } = await loader({ lazyClients: true, value: 'ча' });
  assert.equal(globalThis.loads, 0);
  input.value = 'чаш';
  listeners.pointerenter();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(globalThis.loads, 1);
  assert.deepEqual(globalThis.mounts, [['shop-search', 'чаш']]);
});

test('older plugins that wait for the runtime get it at once', async () => {
  await loader({ lazyClients: false, cartButton: true });
  assert.equal(globalThis.loads, 1);
  await loader({ lazyClients: false, cartButton: false });
  assert.equal(globalThis.loads, 0, 'pages without such plugins stay without React');
});
