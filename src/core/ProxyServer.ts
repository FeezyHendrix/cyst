/**
 * Main proxy server orchestrator managing all services and HTTP/HTTPS servers
 */

import http from "http";
import https from "https";
import { readFileSync } from "fs";
import { Config } from '../types/index.js';
import { ConfigLoader } from './ConfigLoader.js';
import { Logger } from '../services/Logger.js';
import { Security } from '../services/Security.js';
import { RateLimiter } from '../services/RateLimiter.js';
import { Cache } from '../services/Cache.js';
import { Compression } from '../services/Compression.js';
import { LoadBalancer } from '../services/LoadBalancer.js';
import { HealthChecker } from '../services/HealthChecker.js';
import { Router } from '../services/Router.js';
import { ProxyHandler } from '../services/ProxyHandler.js';
import { StaticHandler } from '../services/StaticHandler.js';
import { WebSocketHandler } from '../services/WebSocketHandler.js';

export class ProxyServer {
  private config: Config;
  private configLoader: ConfigLoader;
  private logger: Logger;
  private security: Security;
  private rateLimiter: RateLimiter;
  private cache: Cache;
  private compression: Compression;
  private loadBalancer: LoadBalancer;
  private healthChecker: HealthChecker;
  private router: Router;
  private proxyHandler: ProxyHandler;
  private staticHandler: StaticHandler;
  private webSocketHandler?: WebSocketHandler;
  
  private httpServer?: http.Server;
  private httpsServer?: https.Server;

  constructor() {
    this.configLoader = ConfigLoader.getInstance();
    this.config = this.configLoader.load();
    this.configLoader.validateConfig(this.config);

    this.initializeServices();
    this.setupSignalHandlers();
  }

  private initializeServices(): void {
    this.logger = new Logger(this.config.logging);
    this.security = new Security(this.config.security);
    this.rateLimiter = new RateLimiter(this.config.rateLimit || { enabled: false, windowMs: 60000, max: 100 });
    this.cache = new Cache(this.config.cache || { enabled: false, maxAge: 300000 });
    this.compression = new Compression(this.config.compression);
    
    this.router = new Router(this.config.routes);
    this.loadBalancer = new LoadBalancer(this.config.loadBalancer || { algorithm: "round-robin" });
    this.healthChecker = new HealthChecker(this.config.loadBalancer || { algorithm: "round-robin" });
    
    this.proxyHandler = new ProxyHandler(
      this.loadBalancer,
      this.logger,
      this.cache,
      this.compression,
      this.config
    );
    
    this.staticHandler = new StaticHandler(this.config, this.cache, this.compression);

    this.logger.info("All services initialized successfully");
  }

  private setupSignalHandlers(): void {
    // Configuration reload on SIGHUP
    process.on("SIGHUP", () => {
      this.reloadConfiguration();
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      this.logger.info("Received SIGTERM, shutting down gracefully");
      this.shutdown();
    });

    process.on("SIGINT", () => {
      this.logger.info("Received SIGINT, shutting down gracefully");
      this.shutdown();
    });
  }

  private reloadConfiguration(): void {
    try {
      const newConfig = this.configLoader.reload();
      this.configLoader.validateConfig(newConfig);
      
      this.config = newConfig;
      this.updateServices();
      
      this.logger.logConfigReload(true, this.configLoader.getConfigSource());
    } catch (error) {
      this.logger.logConfigReload(false, this.configLoader.getConfigSource());
      this.logger.error("Failed to reload configuration:", error as Error);
    }
  }

  private updateServices(): void {
    // Update services with new configuration
    this.router.updateRoutes(this.config.routes);
    this.proxyHandler.updateConfig(this.config);
    this.staticHandler.updateConfig(this.config);
    
    // Restart health checker with new configuration
    this.healthChecker.stop();
    this.healthChecker = new HealthChecker(this.config.loadBalancer || { algorithm: "round-robin" });
    this.healthChecker.start(this.config.routes);
  }

  private createHttpServer(): http.Server {
    const server = http.createServer(async (req, res) => {
      await this.handleRequest(req, res);
    });

    // Setup WebSocket handler
    this.webSocketHandler = new WebSocketHandler(
      server,
      this.loadBalancer,
      this.logger,
      this.router
    );

    return server;
  }

  private createHttpsServer(): https.Server | null {
    if (!this.config.security?.https?.cert || !this.config.security?.https?.key) {
      return null;
    }

    try {
      const cert = readFileSync(this.config.security.https.cert);
      const key = readFileSync(this.config.security.https.key);

      const server = https.createServer({ cert, key }, async (req, res) => {
        await this.handleRequest(req, res);
      });

      return server;
    } catch (error) {
      this.logger.error("Failed to create HTTPS server:", error as Error);
      return null;
    }
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    const clientIP = req.socket.remoteAddress || "";

    try {
      // Security checks
      if (!this.security.isSecureIP(clientIP)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
      }

      // Rate limiting
      if (!this.rateLimiter.checkLimit(clientIP)) {
        this.logger.logRateLimit(clientIP, req.url || "");
        res.writeHead(429, { 
          "Content-Type": "text/plain",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(this.rateLimiter.getResetTime(clientIP)).toISOString()
        });
        res.end("Too Many Requests");
        return;
      }

      // Set security headers
      this.security.setSecurityHeaders(res);

      // Handle status endpoint
      if (req.url === "/status") {
        this.handleStatusEndpoint(req, res);
        return;
      }

      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        this.security.setCORSHeaders(res, req);
        res.writeHead(200);
        res.end();
        return;
      }

      const route = this.router.findRoute(req);

      if (route) {
        // Set CORS headers if enabled for this route
        if (route.cors) {
          this.security.setCORSHeaders(res, req);
        }

        // Check authentication if required
        if (route.auth && !this.security.checkBasicAuth(req)) {
          res.writeHead(401, { 
            "WWW-Authenticate": "Basic realm=\"Restricted\"",
            "Content-Type": "text/plain"
          });
          res.end("Unauthorized");
          return;
        }

        // Handle static file serving
        if (route.staticFile) {
          this.staticHandler.serve(req, res, route.staticFile);
          return;
        }

        // Handle proxy requests
        if (route.targets) {
          await this.proxyHandler.handle(req, res, route);
          return;
        }
      }

      // Serve static files for unmatched routes
      this.staticHandler.serve(req, res);

    } catch (error) {
      this.logger.logError("Request handling error", error as Error, req);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    } finally {
      const duration = Date.now() - startTime;
      this.logger.logAccess(req, res, duration);
    }
  }

  private handleStatusEndpoint(req: http.IncomingMessage, res: http.ServerResponse): void {
    const status = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "unknown",
      config: {
        source: this.configLoader.getConfigSource(),
        port: this.config.port,
        httpsPort: this.config.security?.https?.port
      },
      routes: this.router.getStats(),
      loadBalancer: this.loadBalancer.getStats(this.config.routes),
      healthChecker: this.healthChecker.getStats(this.config.routes),
      cache: this.cache.getStats(),
      rateLimit: this.rateLimiter.getStats(),
      compression: this.compression.getStats(),
      security: this.security.getSecurityInfo(),
      webSocket: this.webSocketHandler?.getStats() || { enabled: false },
      logging: this.logger.getStats()
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status, null, 2));
  }

  start(): void {
    // Start health checking
    this.healthChecker.start(this.config.routes);

    // Start HTTP server
    this.httpServer = this.createHttpServer();
    this.httpServer.listen(this.config.port, () => {
      this.logger.info(`HTTP server running on port ${this.config.port}`);
      this.logger.info(`Configuration loaded from: ${this.configLoader.getConfigSource()}`);
    });

    // Start HTTPS server if configured
    if (this.config.security?.https) {
      this.httpsServer = this.createHttpsServer();
      if (this.httpsServer) {
        const httpsPort = this.config.security.https.port || 443;
        this.httpsServer.listen(httpsPort, () => {
          this.logger.info(`HTTPS server running on port ${httpsPort}`);
        });
      }
    }

    this.logger.info("Lightweight Reverse Proxy started successfully");
  }

  shutdown(): void {
    this.logger.info("Shutting down proxy server...");

    // Stop health checking
    this.healthChecker.stop();

    // Close WebSocket server
    if (this.webSocketHandler) {
      this.webSocketHandler.close();
    }

    // Close servers
    const closePromises: Promise<void>[] = [];

    if (this.httpServer) {
      closePromises.push(new Promise((resolve) => {
        this.httpServer!.close(() => {
          this.logger.info("HTTP server closed");
          resolve();
        });
      }));
    }

    if (this.httpsServer) {
      closePromises.push(new Promise((resolve) => {
        this.httpsServer!.close(() => {
          this.logger.info("HTTPS server closed");
          resolve();
        });
      }));
    }

    Promise.all(closePromises).then(() => {
      this.logger.info("Proxy server shutdown complete");
      process.exit(0);
    });
  }
}