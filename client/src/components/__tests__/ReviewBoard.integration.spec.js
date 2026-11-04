// Integration test: the REAL ReviewBoard (parent) with its REAL StarRating children.
// Only RouterLink is stubbed (there is no router in a test). StarRating on its own is in StarRating.spec.js,
// so star colours / clicks are not re-tested here.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReviewBoard from '../ReviewBoard.vue'
import StarRating from '../StarRating.vue'

const DAY = 86400000
// dates are worked out from "now", so the test never depends on today's date
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString()

const reviews = [
  { _id: 'r1', rating: 5, comment: 'Best cookies ever', buyer: { name: 'Alice Tan' }, product: { _id: 'p1', name: 'Biscoff cookies' }, createdAt: daysAgo(1) },
  { _id: 'r2', rating: 5, comment: 'So fresh', buyer: { name: 'Ben Lim' }, product: { _id: 'p1', name: 'Biscoff cookies' }, createdAt: daysAgo(3) },
  { _id: 'r3', rating: 4, comment: 'Nice but a bit sweet', buyer: { name: 'Chloe Ng' }, product: { _id: 'p2', name: 'Kaya jar' }, createdAt: daysAgo(5) },
  { _id: 'r4', rating: 2, comment: 'Arrived late', buyer: { name: 'Dan Koh' }, product: { _id: 'p2', name: 'Kaya jar' }, createdAt: daysAgo(8) },
]

function mountBoard(list = reviews) {
  return mount(ReviewBoard, {
    props: { reviews: list, showProduct: true },
    global: { stubs: { RouterLink: true } },
  })
}

describe('TestSuite: ReviewBoard with real StarRating (integration)', () => {
  it('Test1: shows the total and the average, and one real StarRating per review with that review\'s rating', () => {
    const wrapper = mountBoard()
    expect(wrapper.text()).toContain('Total reviews')
    expect(wrapper.text()).toContain('4.0') // (5 + 5 + 4 + 2) / 4
    expect(wrapper.find('[aria-label="4.0 out of 5 stars"]').exists()).toBe(true)

    const stars = wrapper.findAllComponents(StarRating)
    expect(stars).toHaveLength(4)
    expect(stars.map((s) => s.props('value'))).toEqual([5, 5, 4, 2]) // newest first
  })

  it('Test2: choosing "5 Stars" leaves only the 5-star reviews, and the children re-render to match', async () => {
    const wrapper = mountBoard()
    await wrapper.find('select[aria-label="Filter by rating"]').setValue('5')

    expect(wrapper.text()).toContain('Alice Tan')
    expect(wrapper.text()).toContain('Ben Lim')
    expect(wrapper.text()).not.toContain('Chloe Ng')
    expect(wrapper.text()).not.toContain('Arrived late')

    const stars = wrapper.findAllComponents(StarRating)
    expect(stars).toHaveLength(2)
    expect(stars.every((s) => s.props('value') === 5)).toBe(true)
  })

  it('Test3: a filter with no matching reviews says so and shows no StarRating at all', async () => {
    const wrapper = mountBoard()
    await wrapper.find('select[aria-label="Filter by rating"]').setValue('1')

    expect(wrapper.text()).toContain('No reviews match this filter.')
    expect(wrapper.findAllComponents(StarRating)).toHaveLength(0)
  })

  it('Test4: going back to "All Ratings" brings every review back', async () => {
    const wrapper = mountBoard()
    const filter = wrapper.find('select[aria-label="Filter by rating"]')
    await filter.setValue('2')
    expect(wrapper.findAllComponents(StarRating)).toHaveLength(1)
    await filter.setValue('all')
    expect(wrapper.findAllComponents(StarRating)).toHaveLength(4)
    expect(wrapper.text()).toContain('Dan Koh')
  })
})
