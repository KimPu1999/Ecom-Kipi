import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('storefront health and accessibility smoke test', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Kipi/i)
  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})
