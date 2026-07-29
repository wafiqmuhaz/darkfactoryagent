import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: null,
    });
    
    this.redis.on('error', (err) => {
      logger.error('Cache Redis Error', err);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600) {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async del(key: string) {
    await this.redis.del(key);
  }
}

export const cacheService = new CacheService();
