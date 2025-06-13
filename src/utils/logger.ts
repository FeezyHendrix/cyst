import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogConfig {
  level: LogLevel;
  console: boolean;
  file?: {
    enabled: boolean;
    path: string;
    maxSize: number; // in bytes
    maxFiles: number;
  };
}

export class Logger {
  private config: LogConfig;

  constructor(config: LogConfig) {
    this.config = config;
    
    if (this.config.file?.enabled && this.config.file.path) {
      const logDir = this.config.file.path.split("/").slice(0, -1).join("/");
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
    }
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}] ${message}${metaStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private writeToFile(message: string): void {
    if (!this.config.file?.enabled || !this.config.file.path) return;

    try {
      appendFileSync(this.config.file.path, message + "\n");
      
      // Simple log rotation (could be enhanced)
      const stats = require("fs").statSync(this.config.file.path);
      if (stats.size > this.config.file.maxSize) {
        this.rotateLog();
      }
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  private rotateLog(): void {
    if (!this.config.file?.path) return;

    try {
      const basePath = this.config.file.path.replace(/\.log$/, "");
      const maxFiles = this.config.file.maxFiles || 5;

      // Rotate existing files
      for (let i = maxFiles - 1; i > 0; i--) {
        const oldFile = `${basePath}.${i}.log`;
        const newFile = `${basePath}.${i + 1}.log`;
        
        if (existsSync(oldFile)) {
          require("fs").renameSync(oldFile, newFile);
        }
      }

      // Move current log to .1
      if (existsSync(this.config.file.path)) {
        require("fs").renameSync(this.config.file.path, `${basePath}.1.log`);
      }
    } catch (error) {
      console.error("Failed to rotate log file:", error);
    }
  }

  debug(message: string, meta?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const formatted = this.formatMessage("DEBUG", message, meta);
    
    if (this.config.console) {
      console.debug(formatted);
    }
    
    this.writeToFile(formatted);
  }

  info(message: string, meta?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const formatted = this.formatMessage("INFO", message, meta);
    
    if (this.config.console) {
      console.info(formatted);
    }
    
    this.writeToFile(formatted);
  }

  warn(message: string, meta?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const formatted = this.formatMessage("WARN", message, meta);
    
    if (this.config.console) {
      console.warn(formatted);
    }
    
    this.writeToFile(formatted);
  }

  error(message: string, meta?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const formatted = this.formatMessage("ERROR", message, meta);
    
    if (this.config.console) {
      console.error(formatted);
    }
    
    this.writeToFile(formatted);
  }

  // Access log in Common Log Format or Combined Log Format
  access(req: any, res: any, duration: number, format: "common" | "combined" = "common"): void {
    const ip = req.socket?.remoteAddress || "-";
    const method = req.method || "-";
    const url = req.url || "-";
    const status = res.statusCode || "-";
    const size = res.getHeader("content-length") || "-";
    const timestamp = new Date().toISOString();
    const userAgent = req.headers["user-agent"] || "-";
    const referer = req.headers.referer || "-";

    let logLine: string;
    
    if (format === "combined") {
      logLine = `${ip} - - [${timestamp}] "${method} ${url} HTTP/1.1" ${status} ${size} "${referer}" "${userAgent}" ${duration}ms`;
    } else {
      logLine = `${ip} - - [${timestamp}] "${method} ${url} HTTP/1.1" ${status} ${size} ${duration}ms`;
    }

    if (this.config.console) {
      console.log(logLine);
    }
    
    this.writeToFile(logLine);
  }
}