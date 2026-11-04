import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryMultiSelect from '../CategoryMultiSelect.vue'
import { CATEGORIES } from '@/utils/constants'

// v-model: the parent gives modelValue; when the component emits a new list, pass it back in (like a real parent would)
function mountWith(chosen) {
  const wrapper = mount(CategoryMultiSelect, {
    props: {
      modelValue: chosen,
      'onUpdate:modelValue': (list) => wrapper.setProps({ modelValue: list }),
    },
  })
  return wrapper
}
// the tick box next to a category name
const tickBox = (wrapper, name) => wrapper.findAll('label').find((label) => label.text() === name).find('input')

describe('TestSuite: CategoryMultiSelect', () => {
  it('Test1: with nothing chosen it says "Select categories" and lists every category', () => {
    const wrapper = mountWith([])
    expect(wrapper.text()).toContain('Select categories')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(CATEGORIES.length)
    expect(wrapper.text()).not.toContain('Clear all')
  })

  it('Test2: ticking a box emits the new list', async () => {
    const wrapper = mountWith([])
    await tickBox(wrapper, 'Meals').setValue(true)
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([['Meals']])
  })

  it('Test3: the list stays in the site order, whatever order they are ticked in', async () => {
    const wrapper = mountWith([])
    await tickBox(wrapper, 'Others').setValue(true)
    await tickBox(wrapper, 'Baked goods').setValue(true)
    expect(wrapper.props('modelValue')).toEqual(['Baked goods', 'Others'])
  })

  it('Test4: chosen categories show as chips, and × removes one', async () => {
    const wrapper = mountWith(['Meals', 'Drinks'])
    expect(wrapper.text()).not.toContain('Select categories')
    await wrapper.find('[aria-label="Remove Meals"]').trigger('click')
    expect(wrapper.props('modelValue')).toEqual(['Drinks'])
  })

  it('Test5: "Clear all" empties the list', async () => {
    const wrapper = mountWith(['Meals', 'Drinks'])
    const clearAll = wrapper.findAll('button').find((button) => button.text() === 'Clear all')
    await clearAll.trigger('click')
    expect(wrapper.props('modelValue')).toEqual([])
    expect(wrapper.text()).toContain('Select categories')
  })
})
