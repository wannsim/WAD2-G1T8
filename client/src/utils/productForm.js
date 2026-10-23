// Helpers for the product form (components/ProductFields.vue), shared by the add page and the edit pop-up.

// blank "Add New Item / Service" form
export function emptyProductForm() {
  return {
    name: '',
    category: '',
    description: '',
    price: '',
    unit: 'piece',
    tagsInput: '',
    customisable: false,
    isAvailable: true,
    orderSlots: [{ start: '', capacity: 10 }],
  }
}

// <input type="datetime-local"> wants local time "YYYY-MM-DDTHH:mm" (not UTC)
function toLocalInput(date) {
  if (!date) return ''
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// saved product -> form values (for editing)
export function productToForm(product) {
  return {
    _id: product._id,
    name: product.name || '',
    category: product.category || '',
    description: product.description || '',
    price: Number(product.price || 0).toFixed(2),
    unit: product.unit || '',
    tagsInput: (product.tags || []).join(', '),
    customisable: !!product.customisable,
    isAvailable: product.isAvailable ?? true,
    orderSlots: (product.orderSlots || []).map((slot) => ({ ...slot, start: toLocalInput(slot.start) })),
  }
}

// form values + new photos -> FormData for POST /products or PUT /products/:id
export function toProductFormData(form, files = []) {
  const formData = new FormData()
  formData.append('name', form.name.trim())
  formData.append('category', form.category)
  formData.append('description', form.description.trim())
  formData.append('price', Number(form.price).toFixed(2))
  formData.append('unit', form.unit)
  formData.append('customisable', form.customisable)
  formData.append('isAvailable', form.isAvailable)
  formData.append('tags', JSON.stringify(form.tagsInput.split(',').map((t) => t.trim()).filter(Boolean)))
  // local time from the input -> real date, so the time doesn't shift when saved
  const slots = form.orderSlots
    .filter((slot) => slot.start)
    .map((slot) => ({ ...slot, start: new Date(slot.start).toISOString() }))
  formData.append('orderSlots', JSON.stringify(slots))
  files.forEach((file) => formData.append('images', file))
  return formData
}

// same rule as the server: at most 2 decimal places
export const isValidPrice = (price) => /^\d+(\.\d{1,2})?$/.test(String(price ?? '').trim())
