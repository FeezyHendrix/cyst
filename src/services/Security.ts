/**
 * Security service that provides IP filtering, authentication, CORS handling,
 * and security headers for the reverse proxy.
 */
import http from "http";
import { SecurityConfig } from '../types/index.js';

export class Security {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = {}) {
    this.config = config;
  }

  checkIPWhitelist(ip: string): boolean {
    if (!this.config.ipWhitelist?.length) return true;
    
    return this.config.ipWhitelist.some(allowedIP => {
      if (allowedIP.includes('/')) {
        return this.matchCIDR(ip, allowedIP);
      }
      return ip === allowedIP;
    });
  }

  checkIPBlacklist(ip: string): boolean {
    if (!this.config.ipBlacklist?.length) return false;
    
    return this.config.ipBlacklist.some(blockedIP => {
      if (blockedIP.includes('/')) {
        return this.matchCIDR(ip, blockedIP);
      }
      return ip === blockedIP;
    });
  }

  private matchCIDR(ip: string, cidr: string): boolean {
    const [network, prefixLength] = cidr.split('/');
    const prefixLen = parseInt(prefixLength, 10);
    
    if (prefixLen === 0) return true;
    if (prefixLen === 32) return ip === network;
    
    const ipInt = this.ipToInt(ip);
    const networkInt = this.ipToInt(network);
    const mask = (0xFFFFFFFF << (32 - prefixLen)) >>> 0;
    
    return (ipInt & mask) === (networkInt & mask);
  }

  private ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  checkBasicAuth(req: http.IncomingMessage): boolean {
    if (!this.config.basicAuth) return true;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Basic ")) return false;

    try {
      const credentials = Buffer.from(authHeader.slice(6), "base64").toString();
      const [username, password] = credentials.split(":");

      return username === this.config.basicAuth.username && 
             password === this.config.basicAuth.password;
    } catch (error) {
      return false;
    }
  }

  setCORSHeaders(res: http.ServerResponse, req: http.IncomingMessage): void {
    const corsConfig = this.config.cors;
    if (!corsConfig) return;

    const origin = req.headers.origin;
    
    if (origin && corsConfig.origins?.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (corsConfig.origins?.includes("*")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    if (corsConfig.methods?.length) {
      res.setHeader("Access-Control-Allow-Methods", corsConfig.methods.join(", "));
    }

    if (corsConfig.headers?.length) {
      res.setHeader("Access-Control-Allow-Headers", corsConfig.headers.join(", "));
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  setSecurityHeaders(res: http.ServerResponse): void {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    
    if (this.config.https) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
  }

  isSecureIP(ip: string): boolean {
    return this.checkIPWhitelist(ip) && !this.checkIPBlacklist(ip);
  }

  getSecurityInfo() {
    return {
      basicAuth: !!this.config.basicAuth,
      https: !!this.config.https,
      cors: !!this.config.cors,
      ipWhitelist: this.config.ipWhitelist?.length || 0,
      ipBlacklist: this.config.ipBlacklist?.length || 0
    };
  }
}