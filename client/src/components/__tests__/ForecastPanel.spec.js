// Component tests for ForecastPanel: mounted with an orders prop only (no mocking, no router).
// The panel uses today's date, so every order date is worked out from "now" (never a fixed date).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ForecastPanel from '../ForecastPanel.vue'

const WEEK = 7 * 86400000

// `perWeek` completed orders in each of the last `weeks` full weeks. "now minus k weeks" is the same weekday,
// k weeks back, so every order lands in a finished week - and all on ONE weekday (a concentrated case).
function ordersBack(weeks, perWeek) {
  const orders = []
  for (let k = 1; k <= weeks; k++) {
    for (let i = 0; i < perWeek; i++) {
      orders.push({ status: 'completed', requestedTime: new Date(Date.now() - k * WEEK).toISOString(), totalPrice: 10 })
    }
  }
  return orders
}

describe('TestSuite: ForecastPanel', () => {
  it('Test1: too few orders shows "Not enough orders yet to forecast"', () => {
    const wrapper = mount(ForecastPanel, { props: { orders: ordersBack(2, 1) } })
    expect(wrapper.text()).toContain('Not enough orders yet to forecast')
    expect(wrapper.findAll('td').filter((td) => td.text().startsWith('about '))).toHaveLength(0)
  })

  it('Test2: enough orders shows the "Estimate" badge and 4 estimate weeks', () => {
    const wrapper = mount(ForecastPanel, { props: { orders: ordersBack(8, 2) } })
    expect(wrapper.text()).not.toContain('Not enough orders yet to forecast')
    expect(wrapper.findAll('span').filter((s) => s.text() === 'Estimate')).toHaveLength(1)
    expect(wrapper.findAll('td').filter((td) => td.text().startsWith('about '))).toHaveLength(4)
  })

  it('Test3: orders all on one weekday show the busiest-weekday suggestion', () => {
    const wrapper = mount(ForecastPanel, { props: { orders: ordersBack(8, 2) } })
    expect(wrapper.text()).toContain('Add more slot capacity on')
    expect(wrapper.text()).toContain('(100% of your completed orders)')
    // the exact sentence shown for an even spread (the "How is this calculated?" note mentions it in lower case)
    expect(wrapper.text()).not.toContain('Your orders are spread fairly evenly across the week.')
  })
})
