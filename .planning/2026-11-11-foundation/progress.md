# Progress: Foundation and Real-Time Spike

| Date | Checkpoint | Verification | Next Action |
|------|------------|--------------|-------------|
| 2026-11-11 | 1A | `npm ls --depth=0` exits 0; no node_modules in git status | Close 1A |
| 2026-11-11 | 1B | `typecheck` clean, `test:unit` 1 passed, `build` produces dist/ | Close 1B |
| 2026-11-11 | 1C | .env.example and 0001-toolchain.md exist; ADR lists all deps | Task 2: PocketBase container |
| 2026-11-11 | 2A | `vitest --project container` 2 passed (refuses without creds, non-root) | 2B: admin bootstrap migration |
| 2026-11-11 | 2B | `vitest --project container` 3 passed (restart keeps first password) | 2C: compose files and scripts |
| 2026-11-11 | 2C | compose.test up --wait healthy, /api/health 200, test:container 3 passed | 2D: docs/developer/backend.md |
| 2026-11-11 | 2D | docs/developer/backend.md names bcrypt cost 10 with source | Task 2 review, then Task 3 |
