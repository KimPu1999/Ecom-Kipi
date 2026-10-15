# Screen Specifications

## Customer screens

| Screen | Required content | Key states |
|---|---|---|
| Home | Announcement, header, search, nav, hero, categories, featured/new products, trust, newsletter, footer | Loading skeleton, CMS-empty fallback |
| Listing | Breadcrumb, title, filters, sort, grid, pagination | Loading, no results, API error, out-of-stock card |
| Details | Gallery, title, price, description, variants, stock, quantity, CTA, related, shipping | Missing product, unavailable variant, add success/error |
| Cart | Items, thumbnails, quantity, remove, subtotal, continue, checkout | Empty, item unavailable, stock changed |
| Checkout | Contact, address, shipping, payment, summary, total, place order | Field errors, expired preview, payment failure |
| Confirmation | Success, order number, items, payment/shipping status, track CTA | Pending payment, retry tracking |
| Account | Profile, addresses, orders, settings, logout | Empty order/address, save/error |
| Auth | Login/register/forgot/reset | Validation, rate limit, success |

## Admin screens

Admin login, dashboard overview, users, categories, brands, products, product editor, variants, inventory, orders, order details, and settings. Each list has search/filter/pagination/loading/error/empty states; editors use unsaved-change protection and confirmation for destructive actions.
