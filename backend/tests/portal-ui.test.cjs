const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../public/admin.js'), 'utf8');

function element(initial = {}) {
  return {textContent: '', disabled: false, dataset: {}, listeners: {}, children: [],
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { this[name] = value; },
    replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); },
    ...initial};
}
function launch({authenticated = false, fetch = async () => { throw Error('Offline'); }} = {}) {
  const input = element({type: 'password'}), toggle = element({dataset: {passwordToggle: 'password', showLabel: 'Show', hideLabel: 'Hide'}});
  const nodes = {'#admin-messages': element({textContent: '{}'}), '#password': input};
  if (authenticated) for (const name of ['notices', 'notification-status', 'refresh-notices', 'enable-push', 'push-status', 'unread', 'notice-list', 'notices-button']) nodes['#' + name] = element();
  const document = {visibilityState: 'visible', querySelector: selector => nodes[selector], getElementById: id => nodes['#' + id],
    querySelectorAll: selector => selector === '[data-password-toggle]' ? [toggle] : [], createElement: () => element()};
  vm.runInNewContext(script, {document, fetch, window: {addEventListener() {}}, setInterval() {}, confirm: () => true, console});
  return {nodes, input, toggle};
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test('guest login can reveal and hide its password without notification calls', async () => {
  let calls = 0;
  const {input, toggle} = launch({fetch: async () => { calls++; }});
  toggle.listeners.click(); assert.equal(input.type, 'text'); assert.equal(toggle.textContent, 'Hide');
  toggle.listeners.click(); assert.equal(input.type, 'password');
  await settled(); assert.equal(calls, 0);
});

test('notification outage retains notices and Retry restores normal updates', async () => {
  let healthy = true;
  const response = () => ({ok: true, headers: {get: () => 'application/json'}, json: async () => ({unread: 1, notices: [{id: 1, payment_id: 'test-only', created_at: 'today'}]})});
  const {nodes} = launch({authenticated: true, fetch: async () => { if (!healthy) throw Error('Offline'); return response(); }});
  await settled(); assert.equal(nodes['#notice-list'].children.length, 1);
  healthy = false; await nodes['#refresh-notices'].listeners.click();
  assert.match(nodes['#notification-status'].textContent, /Unable to refresh/);
  assert.equal(nodes['#notice-list'].children.length, 1); assert.equal(nodes['#refresh-notices'].disabled, false);
  healthy = true; await nodes['#refresh-notices'].listeners.click();
  assert.equal(nodes['#notification-status'].textContent, 'Notifications are up to date.');
});

test('hosting HTML is reported as a connection failure without replacing notices', async () => {
  const {nodes} = launch({authenticated: true, fetch: async () => ({ok: true, headers: {get: () => 'text/html'}, json: async () => { throw Error('Must not parse HTML as JSON'); }})});
  await settled(); assert.match(nodes['#notification-status'].textContent, /Please retry/);
  assert.equal(nodes['#refresh-notices'].disabled, false);
});
