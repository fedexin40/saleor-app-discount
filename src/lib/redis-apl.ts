import { APL, AuthData } from "@saleor/app-sdk/APL";
import { createClient, type RedisClientType } from "redis";

class RedisAPL implements APL {
  constructor() {
    this.client = createClient({
      socket: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT) ?? 6379,
      },
    });
    this.client.connect();
  }

  client: RedisClientType;

  async get(saleorApiUrl: string) {
    const response = await this.client.get(saleorApiUrl);
    if (response) {
      return JSON.parse(response);
    }
    return;
  }

  async set(authData: AuthData) {
    await this.client.set(authData.saleorApiUrl, JSON.stringify(authData));
  }

  async delete(saleorApiUrl: string) {
    await this.client.del(saleorApiUrl);
  }
  getAll() {
    return Promise.resolve([]);
  }
  async isReady(): Promise<any> {
    return Promise.resolve({ ready: true });
  }
  async isConfigured(): Promise<any> {
    return Promise.resolve({ configured: true });
  }
}

export default RedisAPL;
