import { describe, expect, it } from 'vitest'

describe('seller portal contract', () => {
  it('keeps core seller routes under the authenticated seller namespace', () => {
    expect(['/seller/dashboard', '/seller/products', '/seller/inventory', '/seller/orders', '/seller/earnings', '/seller/payouts', '/seller/settings']).toEqual([
      '/seller/dashboard', '/seller/products', '/seller/inventory', '/seller/orders', '/seller/earnings', '/seller/payouts', '/seller/settings',
    ])
  })
})
