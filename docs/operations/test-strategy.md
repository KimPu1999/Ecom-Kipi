# Phase 9 test strategy

The release gate separates unit/service tests, Laravel feature/database tests with an isolated SQLite database, React/Vitest tests, Playwright browser tests against a local or staging URL, k6 load tests against isolated staging, dependency/security scans, and manual mobile device checks. Production databases and live payment providers are never test targets.

Required evidence is a JUnit/HTML artifact from CI, migration status, smoke output, security scan output, accessibility report, performance thresholds, and financial reconciliation report. A failed gate blocks release rather than being waived silently.
