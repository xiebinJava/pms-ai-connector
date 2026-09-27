# Changelog

## Unreleased

- Unified all workspace schemas on Zod 4.2.0.
- Added OAuth 2.0 Protected Resource Metadata and standards-based Bearer challenges for remote MCP.
- Forwarded request IDs and W3C Trace Context headers to PMS without treating them as identity.
- Added pinned MCP Conformance validation and GitHub Actions quality gates.

## 0.1.0

- Added the shared PMS API client, capability/query contracts, MCP server and OpenCLI plugin.
- Added dynamic capability and workflow discovery through the PMS backend.
- Added automatic execution with idempotency, request IDs, permission checks and backend audit ownership.
- Added a real MCP HTTP entrypoint with HTTPS, Bearer and Origin gates plus `/healthz`.
- Added a config-driven closed-loop E2E harness and an independently installable OpenCLI bundle.
