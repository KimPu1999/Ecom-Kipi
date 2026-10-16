import { describe, expect, it } from 'vitest'
import { buildVariantCombinations, emptyVariant, mergeVariantRows, validateProductOptions, validateVariantRows } from './product-variants'

describe('product variant builder', () => {
  it('generates the cartesian product of configurable options', () => {
    const combinations = buildVariantCombinations([
      { id: 'color', name: 'Color', values: ['Black', 'White', 'Black'] },
      { id: 'size', name: 'Size', values: ['M', 'L'] },
    ])

    expect(combinations).toHaveLength(4)
    expect(combinations.map((item) => item.attributes)).toEqual([
      { Color: 'Black', Size: 'M' },
      { Color: 'Black', Size: 'L' },
      { Color: 'White', Size: 'M' },
      { Color: 'White', Size: 'L' },
    ])
  })

  it('keeps edited rows when option combinations are regenerated', () => {
    const combination = buildVariantCombinations([{ id: 'size', name: 'Size', values: ['M'] }])[0]
    const row = { ...emptyVariant(combination.key), attributes: combination.attributes, sku: 'SHIRT-M', price_minor: '25000' }

    expect(mergeVariantRows([combination], [row])).toEqual([row])
  })

  it('rejects duplicate active SKUs while allowing excluded combinations', () => {
    const rows = [
      { ...emptyVariant('black-m'), attributes: { Color: 'Black', Size: 'M' }, sku: 'DUPLICATE', price_minor: '1000', quantity: '2' },
      { ...emptyVariant('white-m'), attributes: { Color: 'White', Size: 'M' }, sku: 'DUPLICATE', price_minor: '1000', quantity: '2', is_active: false },
    ]

    expect(validateVariantRows(rows, true, 2)).toBeNull()
    expect(validateVariantRows([rows[0], { ...rows[1], is_active: true }], true, 2)).toContain('repeated')
  })

  it('rejects empty and repeated option values before saving', () => {
    expect(validateProductOptions([{ id: 'color', name: 'Color', values: ['Black', 'black'] }])).toContain('repeated')
    expect(validateProductOptions([{ id: 'size', name: 'Size', values: [''] }])).toContain('needs a value')
  })
})
