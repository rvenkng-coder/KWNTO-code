# 0001: Toolchain

**Status:** Accepted
**Date:** 2026-11-11

## Context

We need a minimal, zero-cost web app scaffold for KWNTO — a branching narrative scriptwriting tool. The stack must support strict TypeScript, fast iteration, and a single testable deployment.

## Decision

We use a single npm package at the repo root with Vite as the build tool and dev server, React 19 as the UI library, Tailwind CSS 4 for styling, Zustand for state management, and `@xyflow/react` for the canvas editor. PocketBase v0.40.6 runs in Docker for development and tests. Testing uses Vitest for unit tests and Playwright for end-to-end tests.

The backend runs on the same origin as the web app; Vite proxies `/api` and `/_` to PocketBase in development. Only files under `frontend/src/backend/` may import the PocketBase JS SDK.

### Dependencies

| Package | Version | License | Why |
|---------|---------|---------|-----|
| react | 19.3.1 | MIT | UI library for the web app |
| react-dom | 19.3.1 | MIT | DOM rendering for React |
| typescript | 6.0.3 | Apache-2.0 | Strict type checking across the codebase (pinned `~6.0.3`, see below) |
| vite | 8.3.8 | MIT | Fast dev server and build tool |
| tailwindcss | 4.3.5 | MIT | Utility-first CSS framework |
| zustand | 5.1.0 | MIT | Lightweight state management |
| @xyflow/react | 12.12.1 | MIT | Canvas node editor with drag-and-drop |
| pocketbase | 0.28.2 | MIT | Official PocketBase JS SDK for backend access |
| vitest | 5.1.0 | MIT | Fast unit test runner |
| @playwright/test | 1.65.0 | Apache-2.0 | End-to-end testing across Firefox and Chromium |
| eslint | 10.14.0 | MIT | Linting; enforces the guardrails in docs/engineering.md (replaced oxlint in Task 4) |
| @eslint/js | 10.0.1 | MIT | ESLint's recommended rule set (part of the Vite template) |
| @tailwindcss/vite | 4.3.5 | MIT | Vite plugin for Tailwind CSS v4 |
| @vitejs/plugin-react | 6.3.0 | MIT | Vite plugin for React JSX transform |
| typescript-eslint | 8.72.2 | MIT | TypeScript support for ESLint |
| eslint-plugin-react-hooks | 7.1.1 | MIT | React hooks linting rules |
| eslint-plugin-react-refresh | 0.5.7 | MIT | React Fast Refresh linting rules |
| globals | 17.14.0 | MIT | Global variable definitions for React/Vite |
| @types/react | 19.3.0 | MIT | TypeScript types for React |
| @types/react-dom | 19.3.0 | MIT | TypeScript types for React DOM |
| @types/node | 24.19.2 | MIT | TypeScript types for Node.js |

### TypeScript is pinned to 6.0.x

Date: 2026-11-12. `typescript-eslint` 8.72.2 (the latest, and its canary 8.72.3) accepts TypeScript `>=4.8.4 <6.1.0`, so it does not install next to TypeScript 7.0.2, which the scaffold had. The developer chose to pin `typescript` to `~6.0.3` so ESLint installs with no workaround. Nothing in the app needs TypeScript 7. Move back to 7 once a stable `typescript-eslint` supports it, and re-run `npm run typecheck` and `npm run lint` when doing so.

### Layout

- Single npm package at the repo root
- `frontend/` — the React app (`src/`, `index.html`, `vite.config.ts`, app and node tsconfig files); `npm run dev` runs Vite with `frontend/` as its root
- `backend/` — PocketBase Docker image and migrations
- `tests/` — Unit, rules, and container tests
- `e2e/` — Playwright end-to-end tests
- `spike/` — Throwaway spike code (isolated from the app)

### Backend URL

The PocketBase backend URL is configured via `KWNTO_PB_URL` environment variable, defaulting to `http://127.0.0.1:8090`. In development, Vite proxies `/api` and `/_` to this URL.
