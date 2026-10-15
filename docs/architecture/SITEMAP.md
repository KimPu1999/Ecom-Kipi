# Information Architecture and Sitemap

## Customer web/mobile

~~~text
/
├── home
├── products
│   ├── category/:slug
│   ├── brand/:slug
│   └── search
├── products/:slug
├── cart
├── checkout
├── orders
│   └── :id
├── account
│   ├── profile
│   ├── addresses
│   └── settings
└── auth
    ├── login
    ├── register
    ├── forgot-password
    └── reset-password
~~~

## Admin

~~~text
/admin
├── dashboard
├── users
├── categories
├── brands
├── products
│   ├── new
│   └── :id/edit
├── inventory
├── orders
│   └── :id
└── settings
~~~

Global navigation should expose only routes permitted by the authenticated role. Breadcrumbs are required on desktop admin and product/catalog pages.
