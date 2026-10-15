import { describe, expect, it } from 'vitest'
import { idempotencyKey } from './utils'

describe('mobile checkout utilities', () => {
  it('creates unique, namespaced idempotency keys', () => {
    const first = idempotencyKey('checkout')
    const second = idempotencyKey('checkout')
    expect(first.startsWith('checkout-')).toBe(true)
    expect(second).not.toBe(first)
  })
})
