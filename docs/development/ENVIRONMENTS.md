# Environment conventions

| App | Variable | Local default |
| --- | --- | --- |
| Web | VITE_API_URL | http://localhost:8000/api/v1 |
| Admin | VITE_ADMIN_API_URL | http://localhost:8000/api/v1 |
| Mobile | EXPO_PUBLIC_API_URL | http://localhost:8000/api/v1 |
| Laravel | DB_HOST | 127.0.0.1 |
| Laravel | REDIS_HOST | 127.0.0.1 |

Browser clients use credentialed requests and keep the current session in memory. Mobile stores its bearer token in Expo SecureStore. Production deployments should use platform secret managers and HTTPS.
