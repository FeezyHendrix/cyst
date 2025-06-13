/**
 * Type definitions for cyst reverse proxy configuration
 */

export interface Target {
  url: string;
  weight?: number;
  healthy?: boolean;
  connections?: number;
}

export interface Route {
  path?: string;
  host?: string;
  targets?: Target[];
  staticFile?: string;
  middleware?: string[];
  rewrite?: string;
  cors?: boolean;
  auth?: boolean;
  cache?: boolean;
  rateLimit?: number;
}

export interface SecurityConfig {
  https?: {
    cert?: string;
    key?: string;
    port?: number;
  };
  basicAuth?: {
    username: string;
    password: string;
  };
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  cors?: {
    origins?: string[];
    methods?: string[];
    headers?: string[];
  };
}

export interface LoadBalancerConfig {
  algorithm: "round-robin" | "least-connections";
  healthCheck?: {
    enabled: boolean;
    interval: number;
    timeout: number;
    path?: string;
  };
}

export interface LoggingConfig {
  accessLog?: boolean;
  errorLog?: boolean;
  format?: "common" | "combined";
  level?: "info" | "warn" | "error";
}

export interface CacheConfig {
  enabled: boolean;
  maxAge: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  max: number;
}

export interface Config {
  port: number;
  staticDir: string;
  routes: Route[];
  security?: SecurityConfig;
  loadBalancer?: LoadBalancerConfig;
  logging?: LoggingConfig;
  compression?: boolean;
  cache?: CacheConfig;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  retries?: number;
}

export interface CachedResponse {
  data: Buffer;
  contentType: string;
  timestamp: number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}