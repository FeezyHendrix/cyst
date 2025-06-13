/**
 * Rate limiting service for controlling request frequency per IP
 */

import { RateLimitConfig, RateLimitEntry } from '../types/index.js';

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  checkLimit(ip: string, customLimit?: number): boolean {
    if (!this.config.enabled) return true;

    const now = Date.now();
    const windowMs = this.config.windowMs || 60000;
    const max = customLimit || this.config.max || 100;

    const current = this.store.get(ip);

    if (!current || now > current.resetTime) {
      this.store.set(ip, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (current.count >= max) return false;

    current.count++;
    return true;
  }

  getRemainingRequests(ip: string, customLimit?: number): number {
    if (!this.config.enabled) return Infinity;

    const max = customLimit || this.config.max || 100;
    const current = this.store.get(ip);

    if (!current || Date.now() > current.resetTime) {
      return max;
    }

    return Math.max(0, max - current.count);
  }

  getResetTime(ip: string): number {
    const current = this.store.get(ip);
    return current ? current.resetTime : Date.now();
  }

  reset(ip: string): void {
    this.store.delete(ip);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(ip);
      }
    }
  }

  getStats() {
    return {
      activeIPs: this.store.size,
      enabled: this.config.enabled,
      windowMs: this.config.windowMs,
      maxRequests: this.config.max
    };
  }
}