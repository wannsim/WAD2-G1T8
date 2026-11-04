import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MrtSelect from '../MrtSelect.vue'

function mountWith(props = {}) {
  const wrapper = mount(MrtSelect, {
    props: {
      id: 'mrt',
      modelValue: '',
      'onUpdate:modelValue': (text) => wrapper.setProps({ modelValue: text }),
      ...props,
    },
  })
  return wrapper
}
// the station names in the suggestion list
const suggestions = (wrapper) => wrapper.findAll('[role="option"]').map((option) => option.text())

describe('TestSuite: MrtSelect', () => {
  it('Test1: typing filters the suggestions to matching stations', async () => {
    const wrapper = mountWith()
    await wrapper.find('input').setValue('bishan')
    expect(suggestions(wrapper)).toHaveLength(1)
    expect(suggestions(wrapper)[0]).toContain('Bishan')
  })

  it('Test2: text that matches no station says so', async () => {
    const wrapper = mountWith()
    await wrapper.find('input').setValue('zzz')
    expect(suggestions(wrapper)).toHaveLength(0)
    expect(wrapper.text()).toContain('No station matches "zzz"')
  })

  it('Test3: clicking a suggestion emits that station name', async () => {
    const wrapper = mountWith()
    await wrapper.find('input').setValue('dhoby')
    await wrapper.find('[role="option"]').trigger('mousedown')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted[emitted.length - 1]).toEqual(['Dhoby Ghaut'])
  })

  it('Test4: leaving the box with a made-up station shows an error', async () => {
    const wrapper = mountWith()
    const input = wrapper.find('input')
    await input.setValue('Hogwarts')
    expect(wrapper.text()).not.toContain('Please choose a station from the list.') // not while still typing
    await input.trigger('blur')
    expect(wrapper.text()).toContain('Please choose a station from the list.')
  })

  it('Test5: leaving the box tidies a full name like "bishan mrt" to "Bishan", with no error', async () => {
    const wrapper = mountWith()
    const input = wrapper.find('input')
    await input.setValue('bishan mrt')
    await input.trigger('blur')
    expect(wrapper.props('modelValue')).toBe('Bishan')
    expect(wrapper.text()).not.toContain('Please choose')
  })

  it('Test6: a required box left empty asks for a station', async () => {
    const wrapper = mountWith({ required: true })
    await wrapper.find('input').trigger('blur')
    expect(wrapper.text()).toContain('Please choose your nearest MRT station.')
  })
})
