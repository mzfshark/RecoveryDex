// src/services/routerService.js
import routers from "../config/routers.json";

/**
 * Get the router friendly name from address.
 * @param {string} address - The router contract address.
 * @returns {string} - The friendly router name or "Unknown".
 */
export function getRouterName(address) {
  if (!address) return "Unknown";

  const routerConfig = routers?.UNISWAP?.ROUTERS || {};
  const normalized = address.toLowerCase();

  for (const name in routerConfig) {
    const addr = routerConfig[name];
    if (name.toLowerCase() === normalized || addr.toLowerCase() === normalized) {
      return name;
    }
  }

  return "Unknown";
}
