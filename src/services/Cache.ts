/**
 * In-memory response caching service with TTL support
 */

import http from "http";
import { CacheConfig, CachedResponse } from '../types/index.js';

export class Cache {
  private store: Map<string, CachedResponse> = new Map();
  private config: CacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(config: CacheConfig) {
    this.config = config;
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private generateKey(req: http.IncomingMessage): string {
    return `${req.method}:${req.url}`;
  }

  get(req: http.IncomingMessage): CachedResponse | null {
    if (!this.config.enabled) return null;

    const key = this.generateKey(req);
    const cached = this.store.get(key);

    if (!cached) return null;

    const maxAge = this.config.maxAge || 300000;
    if (Date.now() - cached.timestamp > maxAge) {
      this.store.delete(key);
      return null;
    }

    return cached;
  }

  set(req: http.IncomingMessage, data: Buffer, contentType: string): void {
    if (!this.config.enabled) return;

    const key = this.generateKey(req);
    this.store.set(key, {
      data,
      contentType,
      timestamp: Date.now()
    });
  }

  delete(req: http.IncomingMessage): void {
    const key = this.generateKey(req);
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.config.maxAge || 300000;

    for (const [key, cached] of this.store.entries()) {
      if (now - cached.timestamp > maxAge) {
        this.store.delete(key);
      }
    }
  }

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  getStats() {
    return {
      size: this.store.size,
      enabled: this.config.enabled,
      maxAge: this.config.maxAge,
      hitRate: this.getHitRate()
    };
  }
}