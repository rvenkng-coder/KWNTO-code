# Real-time spike (throwaway)

Answers one question: does PocketBase real-time hold up for per-attribute editing on a large project? Nothing here is imported by the app. The result is in [docs/decisions/0002-realtime-spike.md](../../docs/decisions/0002-realtime-spike.md).

## Run locally

Needs Docker running and the `kwnto-pocketbase:dev` image (`npm run test:container` builds it).

```sh
npm run spike:realtime
```

It clears any leftover spike container, starts PocketBase on `127.0.0.1:8092`, seeds 510 nodes and 5,000 lines, runs measurements A to G in Chromium and Firefox, and tears everything down. Numbers land in the gitignored `spike/realtime/results/<browser>.json`. A failing threshold fails that test but never stops the run.

| File | Purpose |
|---|---|
| `compose.yaml` | Spike backend, tmpfs data, port 8092 |
| `pb_migrations/1794355300_spike_collections.js` | `spike_nodes` and `spike_lines` |
| `seed.ts` | Users `spike1`..`spike3@example.test`, project `big` and `other` |
| `helpers.ts` | Clients, result files, and a cuttable TCP proxy used by measurement E |
| `spike.spec.ts` | The six measurements |

## Funnel run (the developer does this; it touches the server)

Design 7b requires this before real-time is relied on. It runs the same spec against a PocketBase reachable through Tailscale Funnel.

1. Start a spike backend on the server that Funnel exposes. Use `spike/realtime/compose.yaml` **only** on a throwaway host or with a separate port; do not use the production volume.
2. Seed it from this machine: `SPIKE_URL=https://<funnel-host> node spike/realtime/seed.ts`. The seed signs in as `admin@example.test` with the password in `compose.yaml`, so change both together if the host is public, and remove the spike backend afterwards.
3. Run the spec:

   ```sh
   rm -rf spike/realtime/results
   SPIKE_URL=https://<funnel-host> npx playwright test -c spike/realtime/playwright.config.ts
   ```

4. Copy the numbers from `spike/realtime/results/*.json` into the Funnel column of `docs/decisions/0002-realtime-spike.md`.

Measurement E is skipped over `https://`: it cuts the link with a local proxy, which only works against an `http://` backend. Record E for Funnel by hand if needed (cut the network on one machine for 10 s while another edits).
