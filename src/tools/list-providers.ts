import { getAllProviders } from "../providers/registry.js";
import { getConfig } from "../config.js";

export function listProviders() {
  const config = getConfig();
  const providers = getAllProviders().map((p) => ({
    ...p.info(),
    mode: config.WARIMCP_MODE,
    effective: config.WARIMCP_MODE === "mock" ? "mock (all providers route to mock)" : p.isConfigured() ? "active" : "not_configured",
  }));

  return { mode: config.WARIMCP_MODE, providers };
}
