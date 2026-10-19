import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createRenderer, h, nextTick, ref } from 'vue'
import { singaporeDate } from '../src/utils/salesAnalytics.js'

// Exercise the real SFC with Vue's renderer and in-memory HTTP fixtures. No browser,
// socket connection, credentials, or database writes are needed for these checks.
const state = {
  currentUser: ref(null), calls: [], redirects: [],
  get: async () => { throw new Error('Unexpected HTTP request') },
}
globalThis.__salesAnalyticsViewTests = state
globalThis.Document = class Document {}
globalThis.document = Object.assign(new Document(), { activeElement: null })

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

const mocks = {
  '@/utils/auth': moduleUrl(`
    import { computed } from ${JSON.stringify(import.meta.resolve('vue'))};
    const state = globalThis.__salesAnalyticsViewTests;
    export const currentUser = state.currentUser;
    export const isLoggedIn = computed(() => !!currentUser.value);
    export const isSeller = computed(() => currentUser.value?.role === 'seller');
    export function clearUser() { currentUser.value = null; }
  `),
  'vue-router': moduleUrl(`
    export function useRouter() { return {
      replace(path) { globalThis.__salesAnalyticsViewTests.redirects.push(path); },
      push(path) { globalThis.__salesAnalyticsViewTests.redirects.push(path); }
    }; }
  `),
  'axios': moduleUrl(`export default { get(...args) {
    globalThis.__salesAnalyticsViewTests.calls.push(args);
    return globalThis.__salesAnalyticsViewTests.get(...args);
  } };`),
  '@/utils/socket': moduleUrl('export const socket = { on() {}, off() {} };'),
}

async function compileView(relativePath) {
  const filename = new URL(relativePath, import.meta.url)
  const source = await readFile(filename, 'utf8')
  const { descriptor } = parse(source, { filename: filename.pathname })
  const compiled = compileScript(descriptor, { id: relativePath, inlineTemplate: true })
  const code = compiled.content.replace(/(^import[^\n]*?\bfrom )(['"])([^'"]+)\2/gm, (match, prefix, quote, specifier) => {
    const url = mocks[specifier] || (specifier.startsWith('@/')
      ? new URL(`../src/${specifier.slice(2)}.js`, import.meta.url).href
      : import.meta.resolve(specifier))
    return `${prefix}${JSON.stringify(url)}`
  })
  return (await import(moduleUrl(code))).default
}

function node(type, text = '') {
  const element = { type, text, children: [], props: {}, listeners: {}, parent: null, tagName: type.toUpperCase() }
  element.addEventListener = (name, handler) => { element.listeners[name] = handler }
  element.removeEventListener = (name) => { delete element.listeners[name] }
  element.getRootNode = () => globalThis.document
  Object.defineProperty(element, 'options', { get: () => element.children.filter((child) => child.type === 'option') })
  return element
}

function remove(element) {
  if (!element.parent) return
  const siblings = element.parent.children
  const index = siblings.indexOf(element)
  if (index !== -1) siblings.splice(index, 1)
  element.parent = null
}

const renderer = createRenderer({
  remove,
  createElement: (type) => node(type),
  createText: (text) => node('#text', text),
  createComment: () => node('#comment'),
  setText: (element, text) => { element.text = text },
  setElementText: (element, text) => { element.text = text; element.children = [] },
  parentNode: (element) => element.parent,
  nextSibling: (element) => element.parent?.children[element.parent.children.indexOf(element) + 1] || null,
  patchProp(element, key, previous, value) {
    element.props[key] = value
    if (key === 'value') { element.value = value; element._value = value }
  },
  insert(element, parent, anchor = null) {
    remove(element)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, element)
    element.parent = parent
  },
})
const Dashboard = await compileView('../src/views/seller/SalesAnalyticsView.vue')
const NavBar = await compileView('../src/components/NavBar.vue')
const apps = []
const seller = { _id: 'seller-fixture', name: 'Test seller', role: 'seller' }
const shop = { _id: 'shop-fixture', name: 'Fixture Bakes' }
const today = singaporeDate()
const completed = {
  createdAt: `${today}T10:00:00+08:00`, status: 'completed', quantity: 3, totalPrice: 45,
  product: { _id: 'cake', name: 'Chocolate cake' },
}

function mount(component = Dashboard, user = seller) {
  state.currentUser.value = user
  state.calls = []
  state.redirects = []
  const root = node('root')
  const app = renderer.createApp(component)
  app.component('RouterLink', { props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) })
  app.mount(root)
  apps.push(app)
  return root
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve))
  await nextTick()
}

function text(root) { return [root.text, ...root.children.map(text)].join(' ') }
function find(root, predicate) {
  if (predicate(root)) return root
  for (const child of root.children) { const result = find(child, predicate); if (result) return result }
  return null
}
function button(root, label) { return find(root, (element) => element.type === 'button' && text(element).trim() === label) }
function byId(root, id) { return find(root, (element) => element.props.id === id) }
function respondWith(orders = [completed]) {
  state.get = async (url) => ({ data: url.includes('/shops/mine/') ? shop : url.includes('/chats/unread/') ? { unread: 0 } : orders })
}

afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

test('guest and buyer visits redirect before any shop or order requests', async () => {
  mount(Dashboard, null)
  await settle()
  assert.deepEqual(state.redirects, ['/login'])
  assert.equal(state.calls.length, 0)
  apps.pop().unmount()
  mount(Dashboard, { _id: 'buyer', role: 'buyer' })
  await settle()
  assert.deepEqual(state.redirects, ['/home'])
  assert.equal(state.calls.length, 0)
})

test('renders loading, then the seller overview, chart, data table, and product totals', async () => {
  respondWith()
  const root = mount()
  assert.match(text(root), /Loading your sales analytics/)
  await settle()
  assert.match(text(root), /Fixture Bakes/)
  assert.match(text(root), /45\.00/)
  assert.match(text(root), /Chocolate cake/)
  assert.match(text(root), /Completed orders, grouped by order placed date/)
  assert.ok(find(root, (element) => element.type === 'svg' && element.props.role === 'img'))
  assert.ok(find(root, (element) => element.type === 'details'))
  assert.equal(state.calls.length, 2)
  assert.ok(state.calls[0][0].endsWith('/shops/mine/seller-fixture'))
  assert.ok(state.calls[1][0].endsWith('/orders/shop/shop-fixture'))
})

test('date filters recalculate locally and invalid custom dates preserve the applied period', async () => {
  respondWith()
  const root = mount()
  await settle()
  const period = byId(root, 'sales-period')
  period.props['onUpdate:modelValue']('7')
  period.props.onChange()
  await settle()
  assert.equal(state.calls.length, 2)
  period.props['onUpdate:modelValue']('custom')
  period.props.onChange()
  await settle()
  byId(root, 'sales-start').props['onUpdate:modelValue']('2026-12-31')
  byId(root, 'sales-end').props['onUpdate:modelValue']('2026-01-01')
  button(root, 'Apply').parent.props.onSubmit({ preventDefault() {} })
  await settle()
  assert.match(text(root), /Start date must be on or before/)
  assert.match(text(root), /Chocolate cake/)
  byId(root, 'sales-start').props['onUpdate:modelValue']('2020-01-01')
  byId(root, 'sales-end').props['onUpdate:modelValue']('2020-01-02')
  button(root, 'Apply').parent.props.onSubmit({ preventDefault() {} })
  await settle()
  assert.match(text(root), /No orders were placed in this period/)
  assert.doesNotMatch(text(root), /Chocolate cake/)
  assert.equal(state.calls.length, 2)
})

test('refresh fetches updated order statuses', async () => {
  respondWith([{ ...completed, status: 'accepted' }])
  const root = mount()
  await settle()
  assert.match(text(root), /no completed sales yet/)
  respondWith()
  button(root, 'Refresh').props.onClick()
  await settle()
  assert.doesNotMatch(text(root), /no completed sales yet/)
  assert.match(text(root), /Chocolate cake/)
  assert.equal(state.calls.length, 4)
})

test('failed order requests show Retry, which recovers without keeping old metrics', async () => {
  state.get = async (url) => {
    if (url.includes('/shops/mine/')) return { data: shop }
    throw new Error('Fixture outage')
  }
  const root = mount()
  await settle()
  assert.match(text(root), /Could not load your sales analytics/)
  assert.doesNotMatch(text(root), /Top products/)
  respondWith()
  button(root, 'Retry').props.onClick()
  await settle()
  assert.match(text(root), /Chocolate cake/)
  assert.doesNotMatch(text(root), /Could not load/)
})

test('a seller without a shop gets a working setup link and no order request', async () => {
  state.get = async () => ({ data: null })
  const root = mount()
  await settle()
  assert.match(text(root), /Set up your shop/)
  assert.ok(find(root, (element) => element.type === 'a' && element.props.href === '/profile'))
  assert.equal(state.calls.length, 1)
})

test('incomplete historical amounts are explained and missing products still appear', async () => {
  respondWith([{ ...completed, totalPrice: null, product: null }])
  const root = mount()
  await settle()
  assert.match(text(root), /missing or invalid historical amount/)
  assert.match(text(root), /Unavailable product/)
  assert.match(text(root), /Average order value uses the 0 completed orders/)
  assert.doesNotMatch(text(root), /NaN|Infinity/)
})

test('session changes clear sales, redirect, and ignore late responses from the old seller', async () => {
  let resolveOrders
  state.get = async (url) => url.includes('/shops/mine/') ? { data: shop }
    : new Promise((resolve) => { resolveOrders = resolve })
  const root = mount()
  await settle()
  state.currentUser.value = null
  await settle()
  assert.deepEqual(state.redirects, ['/login'])
  assert.equal(state.calls[1][1].signal.aborted, true)
  resolveOrders({ data: [completed] })
  await settle()
  assert.doesNotMatch(text(root), /Chocolate cake|Fixture Bakes/)
})

test('switching seller accounts fetches the new shop without retaining previous data', async () => {
  respondWith()
  const root = mount()
  await settle()
  state.get = async () => ({ data: null })
  state.currentUser.value = { _id: 'another-seller', role: 'seller' }
  await settle()
  assert.doesNotMatch(text(root), /Chocolate cake|Fixture Bakes/)
  assert.ok(state.calls.at(-1)[0].endsWith('/shops/mine/another-seller'))
})

test('Analytics navigation is visible only to sellers and targets the dashboard route', async () => {
  respondWith()
  const root = mount(NavBar)
  await settle()
  assert.ok(find(root, (element) => element.type === 'a' && element.props.href === '/seller/analytics'))
  state.currentUser.value = { _id: 'buyer', name: 'Buyer', role: 'buyer' }
  await settle()
  assert.equal(find(root, (element) => element.type === 'a' && element.props.href === '/seller/analytics'), null)
  state.currentUser.value = null
  await settle()
  assert.equal(find(root, (element) => element.type === 'a' && element.props.href === '/seller/analytics'), null)
})
