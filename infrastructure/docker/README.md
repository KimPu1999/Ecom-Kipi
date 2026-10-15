# Local containers

From the repository root:

~~~sh
cp .env.example .env
docker compose up --build
~~~

The backend is available at http://localhost:8000, MySQL at localhost:3306, and Redis at localhost:6379. Frontends remain host-run so Vite and Expo hot reload work naturally.

The production-oriented stack is [compose.production.yaml](compose.production.yaml). It keeps MySQL and Redis internal, runs PHP-FPM behind Nginx, and separates API, queue worker, and scheduler processes. It requires a provider-managed `.env.production`; do not copy local credentials into it or expose database/Redis ports. Deploy only after reviewing [docs/operations/deployment.md](../../docs/operations/deployment.md).
