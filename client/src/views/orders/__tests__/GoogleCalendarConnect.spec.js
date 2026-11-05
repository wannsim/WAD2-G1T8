// Component test for the shared Google Calendar box (GoogleCalendarConnect.vue).
// Only covers steps that make NO server call (showing each state, opening / cancelling the password box,
// the disconnect question), so it runs offline and never touches the database.
//   cd client && pnpm test
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GoogleCalendarConnect from '../GoogleCalendarConnect.vue'

const NOT_CONNECTED = { enabled: true, connected: false, email: '', needsPassword: true }
const CONNECTED = { enabled: true, connected: true, email: 'a@b.com', needsPassword: true }

function mountBox(calendar) {
  return mount(GoogleCalendarConnect, {
    props: { calendar, returnTo: '/seller/calendar', testPrefix: 't' },
  })
}

// finds an element by its data-testid
const byId = (wrapper, id) => wrapper.find(`[data-testid="${id}"]`)

describe('TestSuite: GoogleCalendarConnect', () => {
  it('Test1: shows nothing while Google Calendar is not available (or the status is still loading)', () => {
    const wrapper = mountBox({ enabled: false, connected: false })
    expect(byId(wrapper, 't-status').exists()).toBe(false)
  })

  it('Test2: not connected shows the status text and the Connect button, no Disconnect', () => {
    const wrapper = mountBox(NOT_CONNECTED)
    expect(byId(wrapper, 't-status').text()).toContain('Not connected to Google Calendar')
    expect(byId(wrapper, 't-connect').exists()).toBe(true)
    expect(byId(wrapper, 't-disconnect').exists()).toBe(false)
  })

  it('Test3: connected shows the email and Disconnect, and no Connect button', () => {
    const wrapper = mountBox(CONNECTED)
    expect(byId(wrapper, 't-status').text()).toContain('Synced with a@b.com')
    expect(byId(wrapper, 't-disconnect').exists()).toBe(true)
    expect(byId(wrapper, 't-connect').exists()).toBe(false)
  })

  it('Test4: Connect opens an EMPTY password box with Continue disabled, and tells the page once', async () => {
    const wrapper = mountBox(NOT_CONNECTED)
    await byId(wrapper, 't-connect').trigger('click')
    expect(byId(wrapper, 't-password-box').exists()).toBe(true)
    expect(byId(wrapper, 't-password').element.value).toBe('')
    expect(byId(wrapper, 't-password-continue').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('connect-open')).toHaveLength(1)
  })

  it('Test5: typing a password enables Continue', async () => {
    const wrapper = mountBox(NOT_CONNECTED)
    await byId(wrapper, 't-connect').trigger('click')
    await byId(wrapper, 't-password').setValue('x')
    expect(byId(wrapper, 't-password-continue').attributes('disabled')).toBeUndefined()
  })

  it('Test6: Cancel closes the box and forgets the password', async () => {
    const wrapper = mountBox(NOT_CONNECTED)
    await byId(wrapper, 't-connect').trigger('click')
    await byId(wrapper, 't-password').setValue('x')
    await byId(wrapper, 't-password-cancel').trigger('click')
    expect(byId(wrapper, 't-password-box').exists()).toBe(false)
    await byId(wrapper, 't-connect').trigger('click')
    expect(byId(wrapper, 't-password').element.value).toBe('')
  })

  it('Test7: Disconnect asks first instead of disconnecting', async () => {
    const wrapper = mountBox(CONNECTED)
    await byId(wrapper, 't-disconnect').trigger('click')
    expect(byId(wrapper, 't-disconnect-confirm').text()).toContain('Disconnect Google Calendar?')
    expect(byId(wrapper, 't-disconnect').exists()).toBe(false)
  })

  it('Test8: "Keep connected" closes the question and changes nothing', async () => {
    const wrapper = mountBox(CONNECTED)
    await byId(wrapper, 't-disconnect').trigger('click')
    await byId(wrapper, 't-disconnect-no').trigger('click')
    expect(byId(wrapper, 't-disconnect-confirm').exists()).toBe(false)
    expect(byId(wrapper, 't-disconnect').exists()).toBe(true)
    expect(wrapper.emitted('disconnected')).toBeUndefined()
  })
})
