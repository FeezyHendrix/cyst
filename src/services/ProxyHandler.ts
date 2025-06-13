/**
 * ProxyHandler service that manages HTTP request proxying to backend targets,
 * handles caching, compression, retries, and load balancing integration.
 */
import http from "http";
import { URL } from "url";
import { Route, Target, Config } from '../types/index.js';
import { LoadBalancer } from './LoadBalancer.js';
import { Logger } from './Logger.js';
import { Cache } from './Cache.js';
import { Compression } from './Compression.js';

export class ProxyHandler {
  private loadBalancer: LoadBalancer;
  private logger: Logger;
  private cache: Cache;
  private compression: Compression;
  private config: Config;

  constructor(
    loadBalancer: LoadBalancer,
    logger: Logger,
    cache: Cache,
    compression: Compression,
    config: Config
  ) {
    this.loadBalancer = loadBalancer;
    this.logger = logger;
    this.cache = cache;
    this.compression = compression;
    this.config = config;
  }

  async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    route: Route
  ): Promise<void> {
    if (route.cache && req.method === "GET") {
      const cached = this.cache.get(req);
      if (cached) {
        this.cache.recordHit();
        this.logger.logCacheHit(this.getCacheKey(req));
        
        res.writeHead(200, { "Content-Type": cached.contentType });
        res.end(cached.data);
        return;
      }
      this.cache.recordMiss();
      this.logger.logCacheMiss(this.getCacheKey(req));
    }

    const target = this.loadBalancer.selectTarget(route);
    if (!target) {
      this.sendError(res, 502, "Bad Gateway: No healthy targets available");
      return;
    }

    await this.proxyRequest(req, res, route, target);
  }

  private async proxyRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    route: Route,
    target: Target
  ): Promise<void> {
    this.loadBalancer.incrementConnections(target);

    const url = new URL(target.url);
    let requestPath = req.url || "/";

    if (route.rewrite) {
      requestPath = requestPath.replace(new RegExp(route.path || ""), route.rewrite);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: requestPath,
      method: req.method,
      headers: { ...req.headers },
      timeout: this.config.timeout || 30000
    };

    delete options.headers.host;
    delete options.headers['content-length'];

    this.logger.logProxyRequest(req, target.url);

    const proxyReq = http.request(options, (proxyRes) => {
      this.handleProxyResponse(req, res, route, target, proxyRes);
    });

    proxyReq.on("error", (error) => {
      this.handleProxyError(req, res, route, target, error);
    });

    proxyReq.on("timeout", () => {
      this.handleProxyTimeout(req, res, target);
    });

    req.pipe(proxyReq);
  }

  private handleProxyResponse(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    route: Route,
    target: Target,
    proxyRes: http.IncomingMessage
  ): void {
    let responseData = Buffer.alloc(0);

    proxyRes.on("data", (chunk) => {
      responseData = Buffer.concat([responseData, chunk]);
    });

    proxyRes.on("end", () => {
      const contentType = proxyRes.headers["content-type"] || "";
      let finalData = responseData;
      let encoding: string | undefined;

      if (this.config.compression) {
        const acceptEncoding = req.headers["accept-encoding"] || "";
        const result = this.compression.processResponse(responseData, contentType, acceptEncoding);
        finalData = result.data;
        encoding = result.encoding;
      }

      const headers = { ...proxyRes.headers };
      if (encoding) {
        headers["content-encoding"] = encoding;
        headers["vary"] = "Accept-Encoding";
      }
      headers["content-length"] = finalData.length.toString();

      if (route.cache && req.method === "GET" && proxyRes.statusCode === 200) {
        this.cache.set(req, finalData, contentType);
      }

      res.writeHead(proxyRes.statusCode || 200, headers);
      res.end(finalData);

      this.loadBalancer.decrementConnections(target);
    });

    proxyRes.on("error", (error) => {
      this.logger.logProxyError(req, target.url, error);
      this.loadBalancer.decrementConnections(target);
      this.sendError(res, 502, "Bad Gateway");
    });
  }

  private handleProxyError(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    route: Route,
    target: Target,
    error: Error
  ): void {
    this.logger.logProxyError(req, target.url, error);
    this.loadBalancer.decrementConnections(target);

    const retries = this.config.retries || 0;
    if (retries > 0) {
      const nextTarget = this.loadBalancer.selectTarget(route);
      if (nextTarget && nextTarget !== target) {
        this.logger.info(`Retrying request with different target: ${nextTarget.url}`);
        return this.proxyRequest(req, res, route, nextTarget);
      }
    }

    this.sendError(res, 502, "Bad Gateway");
  }

  private handleProxyTimeout(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    target: Target
  ): void {
    this.logger.logProxyError(req, target.url, new Error("Request timeout"));
    this.loadBalancer.decrementConnections(target);
    this.sendError(res, 504, "Gateway Timeout");
  }

  private sendError(res: http.ServerResponse, statusCode: number, message: string): void {
    if (res.headersSent) return;
    
    res.writeHead(statusCode, { "Content-Type": "text/plain" });
    res.end(message);
  }

  private getCacheKey(req: http.IncomingMessage): string {
    return `${req.method}:${req.url}`;
  }

  updateConfig(config: Config): void {
    this.config = config;
  }
}