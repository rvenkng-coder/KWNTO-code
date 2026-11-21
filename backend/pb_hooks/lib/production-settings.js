// Pure: the production-only PocketBase settings (plan 6 D6, D7, D8, D10). Returns null unless
// KWNTO_PRODUCTION is exactly "1", so the dev and test backends are never touched.
function productionSettings(env) {
  if (env.KWNTO_PRODUCTION !== "1") return null
  const url = env.KWNTO_PUBLIC_URL || ""
  if (!/^https:\/\/[^\s/]+/.test(url)) throw new Error("KWNTO_PUBLIC_URL must start with https://")
  return {
    meta: { appURL: url.replace(/\/+$/, ""), appName: "KWNTO" },
    rateLimits: {
      enabled: true,
      rules: [
        { label: "*:auth", maxRequests: 2, duration: 3 },
        { label: "/api/kwnto/teams/", maxRequests: 10, duration: 60 },
        { label: "/api/", maxRequests: 300, duration: 10 },
      ],
    },
    trustedProxy: { headers: ["X-Forwarded-For"], useLeftmostIP: false },
    backups: { cron: "0 2 * * *", cronMaxKeep: 7 },
  }
}

module.exports = { productionSettings }
