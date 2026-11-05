// Component tests for MakeNextPanel: props only (no mocking, no server, no router).
// The panel uses today's date, so every order date is worked out from "now" (never a fixed date).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MakeNextPanel from '../MakeNextPanel.vue'

const WEEK = 7 * 86400000
const RECENT = new Date(Date.now() - 2 * WEEK).toISOString() // 2 weeks ago: inside the last 4 full weeks
const BEFORE = new Date(Date.now() - 6 * WEEK).toISOString() // 6 weeks ago: inside the 4 weeks before

const categoryOf = { p1: 'Cakes & cupcakes', p2: 'Meals' }
const many = (productId, count, requestedTime) =>
  Array.from({ length: count }, () => ({ status: 'completed', requestedTime, product: { _id: productId }, totalPrice: 10 }))

// Cakes 5 -> 7 orders (+40%)
const growingCakes = [...many('p1', 5, BEFORE), ...many('p1', 7, RECENT)]

describe('TestSuite: MakeNextPanel', () => {
  it('Test1: shows the reason next to the suggestion, and the rising keywords as ideas to explore', () => {
    const trends = [
      { category: 'Cakes & cupcakes', term: 'pandan cake', growth: 0.35 },
      { category: 'Cakes & cupcakes', term: 'ondeh ondeh', growth: 0.2 },
    ]
    const wrapper = mount(MakeNextPanel, { props: { orders: growingCakes, categoryOf, trends, trendsAvailable: true } })
    expect(wrapper.text()).toContain("Orders for Cakes & cupcakes grew 40% and 'pandan cake' is trending")
    expect(wrapper.text()).toContain('Ideas to explore (trending on YouTube)')
    expect(wrapper.findAll('li').filter((li) => li.text() === 'pandan cake +35%')).toHaveLength(1)
    expect(wrapper.findAll('li').filter((li) => li.text() === 'ondeh ondeh +20%')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('use your own orders only')
  })

  it('Test2: without trend data it says so and still suggests from own growth', () => {
    const wrapper = mount(MakeNextPanel, { props: { orders: growingCakes, categoryOf, trends: [], trendsAvailable: false } })
    expect(wrapper.text()).toContain('these suggestions use your own orders only')
    expect(wrapper.text()).toContain('Orders for Cakes & cupcakes grew 40% (from 5 to 7 orders)')
  })

  it('Test3: when nothing grew and nothing is trending there are no suggestions, and it says why', () => {
    const flat = [...many('p2', 3, BEFORE), ...many('p2', 3, RECENT)]
    const wrapper = mount(MakeNextPanel, { props: { orders: flat, categoryOf, trends: [], trendsAvailable: true } })
    expect(wrapper.text()).toContain('No suggestions yet')
    expect(wrapper.findAll('h3')).toHaveLength(0) // no suggestion titles
  })
})
