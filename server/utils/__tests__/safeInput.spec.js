import { describe, it, expect } from 'vitest'
import { isAllowedImageType, readDataUrl, pickFields, SHOP_EDITABLE_FIELDS, ALLOWED_IMAGE_TYPES } from '../safeInput.js'

describe('TestSuite: isAllowedImageType', () => {
  it('Test1: JPEG, PNG, WebP and GIF are allowed', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) expect(isAllowedImageType(type)).toBe(true)
  })

  it('Test2: capitals and spaces are ignored', () => {
    expect(isAllowedImageType(' IMAGE/PNG ')).toBe(true)
  })

  it('Test3: SVG and other image types are refused', () => {
    expect(isAllowedImageType('image/svg+xml')).toBe(false)
    expect(isAllowedImageType('image/bmp')).toBe(false)
  })

  it('Test4: non-image types and missing types are refused', () => {
    expect(isAllowedImageType('text/html')).toBe(false)
    expect(isAllowedImageType('application/javascript')).toBe(false)
    expect(isAllowedImageType('')).toBe(false)
    expect(isAllowedImageType(undefined)).toBe(false)
  })

  it('Test5: the allowed list has exactly four types', () => {
    expect(ALLOWED_IMAGE_TYPES).toHaveLength(4)
  })
})

describe('TestSuite: readDataUrl', () => {
  it('Test1: reads the type and the Base64 data', () => {
    expect(readDataUrl('data:image/png;base64,AAAA')).toEqual({ type: 'image/png', base64: 'AAAA' })
  })

  it('Test2: the type is made lower case', () => {
    expect(readDataUrl('data:Image/JPEG;base64,AAAA').type).toBe('image/jpeg')
  })

  it('Test3: a normal link or empty value is not a stored picture', () => {
    expect(readDataUrl('https://example.com/a.png')).toBeNull()
    expect(readDataUrl('')).toBeNull()
    expect(readDataUrl(undefined)).toBeNull()
  })

  it('Test4: a stored SVG is read, so the caller can refuse it by its type', () => {
    expect(isAllowedImageType(readDataUrl('data:image/svg+xml;base64,AAAA').type)).toBe(false)
  })
})

describe('TestSuite: pickFields', () => {
  it('Test1: copies only the listed fields', () => {
    expect(pickFields({ description: 'Cakes', owner: 'x', followers: [] }, SHOP_EDITABLE_FIELDS)).toEqual({ description: 'Cakes' })
  })

  it('Test2: dotted keys and update operators are left behind', () => {
    const body = { nearestMrt: 'Bishan', 'stats.trustScore': 100, $set: { owner: 'x' }, stats: { avgRating: 5 } }
    expect(pickFields(body, SHOP_EDITABLE_FIELDS)).toEqual({ nearestMrt: 'Bishan' })
  })

  it('Test3: false, 0 and empty values are kept (only missing fields are skipped)', () => {
    expect(pickFields({ pickup: false, delivery: true, description: '' }, SHOP_EDITABLE_FIELDS))
      .toEqual({ pickup: false, delivery: true, description: '' })
  })

  it('Test4: returns a new object, not the body itself', () => {
    const body = { experience: '5 years' }
    const picked = pickFields(body, SHOP_EDITABLE_FIELDS)
    expect(picked).not.toBe(body)
    expect(picked).toEqual(body)
  })

  it('Test5: a missing or non-object body gives an empty object', () => {
    expect(pickFields(undefined, SHOP_EDITABLE_FIELDS)).toEqual({})
    expect(pickFields('text', SHOP_EDITABLE_FIELDS)).toEqual({})
  })

  it('Test6: the shop list never includes server-only fields', () => {
    for (const field of ['owner', 'stats', 'followers', 'pinnedProducts', 'avatar', 'avatarUpdatedAt', 'certificationFiles', 'name']) {
      expect(SHOP_EDITABLE_FIELDS).not.toContain(field)
    }
  })
})
