# Accessibility audit report

The browser suite includes an axe-core smoke test for the customer storefront and is configured to run in CI against an isolated preview/staging URL. Automated checks do not establish WCAG 2.2 AA compliance. Before release, complete keyboard-only navigation, visible focus, form error announcement, dialog semantics, contrast, zoom/text scaling, VoiceOver, and TalkBack review across customer, admin, and seller surfaces. Record violations with URL, component, severity, owner, and remediation evidence.

Current status: automated test configured; local browser execution blocked by the current macOS runtime/sandbox, so accessibility sign-off is pending.
