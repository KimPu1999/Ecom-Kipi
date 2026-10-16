export const MAX_PRODUCT_VARIANTS = 100

export type ProductOptionDraft = {
  id: string
  name: string
  values: string[]
}

export type VariantDraft = {
  key: string
  attributes: Record<string, string>
  sku: string
  price_minor: string
  compare_at_price_minor: string
  quantity: string
  is_active: boolean
}

export type VariantCombination = {
  key: string
  attributes: Record<string, string>
}

export const PRODUCT_OPTION_SUGGESTIONS: Record<string, string[]> = {
  size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  'shoe size': Array.from({ length: 11 }, (_, index) => String(36 + index)),
  color: ['Black', 'White', 'Blue', 'Red', 'Green'],
  storage: ['64GB', '128GB', '256GB', '512GB'],
  material: ['Cotton', 'Leather', 'Denim', 'Stainless steel'],
}

export function optionSuggestion(name: string): string[] {
  return PRODUCT_OPTION_SUGGESTIONS[name.trim().toLowerCase()] ?? []
}

export function combinationKey(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([name, value]) => `${name.trim().toLowerCase()}=${value.trim().toLowerCase()}`)
    .join('|')
}

export function buildVariantCombinations(options: ProductOptionDraft[]): VariantCombination[] {
  const usableOptions = options
    .map((option) => ({
      name: option.name.trim(),
      values: Array.from(new Set(option.values.map((value) => value.trim()).filter(Boolean))),
    }))
    .filter((option) => option.name && option.values.length)

  if (!usableOptions.length) return []

  return usableOptions.reduce<Record<string, string>[]>((combinations, option) => {
    if (!combinations.length) return option.values.map((value) => ({ [option.name]: value }))

    return combinations.flatMap((combination) => option.values.map((value) => ({ ...combination, [option.name]: value })))
  }, []).map((attributes) => ({ attributes, key: combinationKey(attributes) }))
}

export function emptyVariant(key = 'default'): VariantDraft {
  return {
    key,
    attributes: {},
    sku: '',
    price_minor: '',
    compare_at_price_minor: '',
    quantity: '0',
    is_active: true,
  }
}

export function mergeVariantRows(combinations: VariantCombination[], previous: VariantDraft[]): VariantDraft[] {
  return combinations.map((combination) => {
    const existing = previous.find((row) => row.key === combination.key)
    return existing ? { ...existing, attributes: combination.attributes } : { ...emptyVariant(combination.key), attributes: combination.attributes }
  })
}

export function validateProductOptions(options: ProductOptionDraft[]): string | null {
  if (!options.length) return 'Add at least one product option.'

  const names = new Set<string>()
  for (const option of options) {
    const name = option.name.trim().toLowerCase()
    if (!name) return 'Every product option needs a name.'
    if (names.has(name)) return `The option name ${option.name.trim()} is repeated.`
    names.add(name)

    const values = new Set<string>()
    for (const value of option.values) {
      const normalizedValue = value.trim().toLowerCase()
      if (!normalizedValue) return `Every ${option.name.trim()} option needs a value.`
      if (values.has(normalizedValue)) return `${option.name.trim()} contains a repeated value.`
      values.add(normalizedValue)
    }
  }

  return null
}

export function validateVariantRows(rows: VariantDraft[], hasVariants: boolean, combinationCount: number): string | null {
  if (hasVariants && combinationCount > MAX_PRODUCT_VARIANTS) {
    return `Reduce the options to ${MAX_PRODUCT_VARIANTS} combinations or fewer before saving.`
  }

  const activeRows = rows.filter((row) => row.is_active)
  if (!activeRows.length) return 'Select at least one variant to sell.'

  const seenSkus = new Set<string>()
  for (const row of activeRows) {
    const sku = row.sku.trim().toLowerCase()
    if (!sku) return 'Every active variant needs a unique SKU.'
    if (seenSkus.has(sku)) return `SKU ${row.sku.trim()} is repeated. Each variant needs a unique SKU.`
    seenSkus.add(sku)

    const price = Number(row.price_minor)
    const quantity = Number(row.quantity)
    const compareAt = row.compare_at_price_minor.trim() ? Number(row.compare_at_price_minor) : null
    if (!Number.isInteger(price) || price < 0) return `Enter a valid price for ${variantLabel(row)}.`
    if (compareAt !== null && (!Number.isInteger(compareAt) || compareAt < price)) return `Compare-at price must be at least the selling price for ${variantLabel(row)}.`
    if (!Number.isInteger(quantity) || quantity < 0) return `Enter a valid stock quantity for ${variantLabel(row)}.`
  }

  return null
}

export function variantLabel(row: Pick<VariantDraft, 'attributes' | 'key'>): string {
  const values = Object.values(row.attributes).filter(Boolean)
  return values.length ? values.join(' / ') : row.key === 'default' ? 'the product' : 'this variant'
}
