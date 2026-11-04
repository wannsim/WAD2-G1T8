import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StarRating from '../StarRating.vue'

// the 5 single stars the user can see (and click)
const starsOf = (wrapper) => wrapper.findAll('span').filter((span) => span.text() === '★')

describe('TestSuite: StarRating', () => {
  it('Test1: always shows 5 stars and keeps the value it was given', () => {
    const wrapper = mount(StarRating, { props: { value: 4.3 } })
    expect(wrapper.text()).toBe('★★★★★')
    expect(starsOf(wrapper)).toHaveLength(5)
    expect(wrapper.props('value')).toBe(4.3)
  })

  it('Test2: with no value it starts at 0 and is not editable', () => {
    const wrapper = mount(StarRating)
    expect(wrapper.props('value')).toBe(0)
    expect(wrapper.props('editable')).toBe(false)
  })

  it('Test3: when editable, clicking the 3rd star emits rate with 3', async () => {
    const wrapper = mount(StarRating, { props: { value: 0, editable: true } })
    await starsOf(wrapper)[2].trigger('click')
    expect(wrapper.emitted('rate')).toHaveLength(1)
    expect(wrapper.emitted('rate')[0]).toEqual([3])
  })

  it('Test4: when editable, the first and last stars give 1 and 5 (boundaries)', async () => {
    const wrapper = mount(StarRating, { props: { editable: true } })
    await starsOf(wrapper)[0].trigger('click')
    await starsOf(wrapper)[4].trigger('click')
    expect(wrapper.emitted('rate')).toEqual([[1], [5]])
  })

  it('Test5: when only displaying, clicking a star emits nothing', async () => {
    const wrapper = mount(StarRating, { props: { value: 2 } })
    await starsOf(wrapper)[3].trigger('click')
    expect(wrapper.emitted('rate')).toBeFalsy()
  })
})
