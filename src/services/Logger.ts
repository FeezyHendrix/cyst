/**
 * Logger service that handles structured logging with different levels,
 * access logging, error logging, and proxy-specific logging functionality.
 */
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import http from "http";
import { LoggingConfig } from '../types/index.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private config: LoggingConfig;
  private logLevel: LogLevel;

  constructor(config: LoggingConfig = {}) {
    this.config = config;
    this.logLevel = this.parseLogLevel(config.level || "info");
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case "debug": return LogLevel.DEBUG;
      case "info": return LogLevel.INFO;
      case "warn": return LogLevel.WARN;
      case "error": return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}] ${message}${metaStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  debug(message: string, meta?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const formatted = this.formatMessage("DEBUG", message, meta);
    console.debug(formatted);
  }

  info(message: string, meta?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const formatted = this.formatMessage("INFO", message, meta);
    console.info(formatted);
  }

  warn(message: string, meta?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const formatted = this.formatMessage("WARN", message, meta);
    console.warn(formatted);
  }

  error(message: string, meta?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const formatted = this.formatMessage("ERROR", message, meta);
    console.error(formatted);
  }

  logAccess(req: http.IncomingMessage, res: http.ServerResponse, duration: number): void {
    if (!this.config.accessLog) return;

    const timestamp = new Date().toISOString();
    const ip = req.socket.remoteAddress || "-";
    const method = req.method || "-";
    const url = req.url || "-";
    const userAgent = req.headers["user-agent"] || "-";
    const referer = req.headers.referer || "-";
    const status = res.statusCode || "-";
    const size = res.getHeader("content-length") || "-";

    let logLine: string;

    if (this.config.format === "combined") {
      logLine = `${ip} - - [${timestamp}] "${method} ${url} HTTP/1.1" ${status} ${size} "${referer}" "${userAgent}" ${duration}ms`;
    } else {
      logLine = `${ip} - - [${timestamp}] "${method} ${url} HTTP/1.1" ${status} ${size} ${duration}ms`;
    }

    console.log(logLine);
  }

  logError(message: string, error: Error, req?: http.IncomingMessage): void {
    if (!this.config.errorLog) return;

    const context = req ? {
      method: req.method,
      url: req.url,
      userAgent: req.headers["user-agent"],
      ip: req.socket.remoteAddress
    } : undefined;

    this.error(message, {
      error: {
        message: error.message,
        stack: error.stack
      },
      request: context
    });
  }

  logProxyRequest(req: http.IncomingMessage, target: string): void {
    this.info(`Proxying ${req.method} ${req.url} -> ${target}`);
  }

  logProxyError(req: http.IncomingMessage, target: string, error: Error): void {
    this.error(`Proxy error for ${req.method} ${req.url} -> ${target}`, {
      error: error.message,
      target
    });
  }

  logHealthCheck(target: string, healthy: boolean, duration: number): void {
    const status = healthy ? "healthy" : "unhealthy";
    this.debug(`Health check: ${target} -> ${status} (${duration}ms)`);
  }

  logConfigReload(success: boolean, source: string): void {
    if (success) {
      this.info(`Configuration reloaded successfully from ${source}`);
    } else {
      this.error(`Failed to reload configuration from ${source}`);
    }
  }

  logRateLimit(ip: string, path: string): void {
    this.warn(`Rate limit exceeded for ${ip} on ${path}`);
  }

  logCacheHit(key: string): void {
    this.debug(`Cache hit: ${key}`);
  }

  logCacheMiss(key: string): void {
    this.debug(`Cache miss: ${key}`);
  }

  getStats() {
    return {
      accessLog: this.config.accessLog || false,
      errorLog: this.config.errorLog || false,
      format: this.config.format || "common",
      level: this.config.level || "info"
    };
  }
}