import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchBox from '../SearchBox.vue'

function mountWith(props = {}) {
  const wrapper = mount(SearchBox, {
    props: {
      modelValue: '',
      'onUpdate:modelValue': (text) => wrapper.setProps({ modelValue: text }),
      ...props,
    },
  })
  return wrapper
}

describe('TestSuite: SearchBox', () => {
  it('Test1: shows the placeholder it is given, or "Search..." by default', () => {
    expect(mountWith({ placeholder: 'Search orders...' }).find('input').attributes('placeholder')).toBe('Search orders...')
    expect(mountWith().find('input').attributes('placeholder')).toBe('Search...')
  })

  it('Test2: typing emits the new text', async () => {
    const wrapper = mountWith()
    await wrapper.find('input').setValue('cookies')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['cookies'])
  })

  it('Test3: the clear (×) button only appears once something is typed', async () => {
    const wrapper = mountWith()
    expect(wrapper.find('[aria-label="Clear search"]').exists()).toBe(false)
    await wrapper.find('input').setValue('cookies')
    expect(wrapper.find('[aria-label="Clear search"]').exists()).toBe(true)
  })

  it('Test4: clicking × empties the search', async () => {
    const wrapper = mountWith({ modelValue: 'cookies' })
    await wrapper.find('[aria-label="Clear search"]').trigger('click')
    expect(wrapper.props('modelValue')).toBe('')
    expect(wrapper.find('input').element.value).toBe('')
  })

  it('Test5: pressing Esc also empties the search', async () => {
    const wrapper = mountWith({ modelValue: 'cookies' })
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.props('modelValue')).toBe('')
  })
})
