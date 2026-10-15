import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<750'] },
  scenarios: { catalog: { executor: 'constant-vus', vus: 5, duration: '30s' } },
}

export default function () {
  const base = __ENV.API_BASE_URL || 'http://127.0.0.1:8000'
  const response = http.get(`${base}/api/v1/products?per_page=20`)
  check(response, { 'catalog responds': (r) => r.status === 200, 'catalog payload is success': (r) => r.json('success') === true })
  sleep(1)
}
