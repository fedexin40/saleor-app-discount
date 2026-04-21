import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import { APL, FileAPL, UpstashAPL } from "@saleor/app-sdk/APL";
import RedisAPL from "./lib/redis-apl";

/**
 * By default auth data are stored in the `.auth-data.json` (FileAPL).
 * For multi-tenant applications and deployments please use UpstashAPL.
 *
 * To read more about storing auth data, read the
 * [APL documentation](https://github.com/saleor/saleor-app-sdk/blob/main/docs/apl.md)
 */
export let apl: APL;
switch (process.env.APL) {
  case "upstash":
    // Require `UPSTASH_URL` and `UPSTASH_TOKEN` environment variables
    apl = new UpstashAPL();
    break;
  case 'redis':
    // Require `REDIS_HOST` and `REDIS_PORT` environment variables
    apl = new RedisAPL();
    break;
  default:
    apl = new FileAPL();
}

export const saleorApp = new SaleorApp({
  apl,
});
