import { ProxyAgent, setGlobalDispatcher } from "undici";
import { logger } from "./logger";

export function applyGlobalProxy() {
  const proxy = process.env.HTTPS_PROXY;
  if (!proxy) return;

  const dispatcher = new ProxyAgent(proxy);

  setGlobalDispatcher(dispatcher);

  logger.info("[Proxy] undici ProxyAgent enabled:", proxy);
}
