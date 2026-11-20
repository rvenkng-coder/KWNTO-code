# 0004: Deployment images

**Date:** 2026-11-20
**Status:** accepted with the deployment plan (Plan 6, "Docker images are dependencies")

The production stack (`compose.prod.yaml`) adds three Docker images. Each is pinned by digest, as the Alpine base in `backend/Dockerfile` is, so an image never changes under us. Approving the plan approves these three images and nothing else.

| Image | Pinned digest | Used by | What for | Licence |
|---|---|---|---|---|
| `node:22-alpine` | `node@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a` | `web` | One-shot build of the web app (`npm ci && npm run build`) into the `kwnto-web` volume, so the VM needs only Docker and git | MIT |
| `caddy:2-alpine` | `caddy@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0` | `caddy` | The proxy in front of PocketBase: blocks admin paths, adds security headers, limits request size | Apache-2.0 |
| `tailscale/tailscale:stable` | `tailscale/tailscale@sha256:72c1e19e0aedca96b8533bbb0b4368564410ff20b17e53b804eb6c1f04a31be4` | `tailscale` | Publishes Caddy over HTTPS with Funnel, and the dashboard on the tailnet only | BSD-3-Clause |

Digests were taken on 2026-11-20 with `docker pull <image>` and `docker inspect --format '{{index .RepoDigests 0}}' <image>`.

## How to bump an image

1. Pull the new tag and read the release notes.
2. Replace the digest in `compose.prod.yaml` (and in this file).
3. Run `npm run test:container`.
