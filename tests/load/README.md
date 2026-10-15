# Load tests

Run only against isolated staging with sandbox payment configuration:

```bash
k6 run -e API_BASE_URL=https://staging-api.example.com tests/load/k6.js
```

Extend scenarios for authenticated cart/checkout and concurrent reservation tests only after provisioning isolated test users and inventory. Never send load to production or a live payment provider.
