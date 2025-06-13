/**
 * WebSocketHandler service that manages WebSocket connections and proxying,
 * handling bidirectional communication between clients and backend targets.
 */
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { Route, Target } from '../types/index.js';
import { LoadBalancer } from './LoadBalancer.js';
import { Logger } from './Logger.js';
import { Router } from './Router.js';

export class WebSocketHandler {
  private wss: WebSocketServer;
  private loadBalancer: LoadBalancer;
  private logger: Logger;
  private router: Router;

  constructor(
    server: http.Server,
    loadBalancer: LoadBalancer,
    logger: Logger,
    router: Router
  ) {
    this.loadBalancer = loadBalancer;
    this.logger = logger;
    this.router = router;
    
    this.wss = new WebSocketServer({ 
      server,
      handleProtocols: this.handleProtocols.bind(this)
    });

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on("error", (error) => {
      this.logger.error("WebSocket server error:", error);
    });
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    this.logger.info(`WebSocket connection established from ${req.socket.remoteAddress}`);

    const route = this.router.findRoute(req);
    if (!route?.targets) {
      this.logger.warn("No route found for WebSocket connection");
      ws.close(1002, "No route found");
      return;
    }

    const target = this.loadBalancer.selectTarget(route);
    if (!target) {
      this.logger.warn("No healthy targets available for WebSocket connection");
      ws.close(1002, "No healthy targets available");
      return;
    }

    this.createProxyConnection(ws, req, target);
  }

  private createProxyConnection(
    clientWs: WebSocket,
    req: http.IncomingMessage,
    target: Target
  ): void {
    try {
      const targetUrl = new URL(target.url);
      const wsUrl = `${targetUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${targetUrl.hostname}:${targetUrl.port}${req.url}`;

      this.logger.info(`Creating WebSocket proxy connection to: ${wsUrl}`);

      const targetWs = new WebSocket(wsUrl, {
        headers: this.prepareHeaders(req)
      });

      this.loadBalancer.incrementConnections(target);

      this.setupProxyEventHandlers(clientWs, targetWs, target, wsUrl);

    } catch (error) {
      this.logger.error(`Failed to create WebSocket proxy connection to ${target.url}:`, error);
      clientWs.close(1002, "Proxy connection failed");
    }
  }

  private setupProxyEventHandlers(
    clientWs: WebSocket,
    targetWs: WebSocket,
    target: Target,
    targetUrl: string
  ): void {
    targetWs.on("open", () => {
      this.logger.debug(`WebSocket proxy connection established to ${targetUrl}`);
    });

    targetWs.on("message", (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    targetWs.on("close", (code, reason) => {
      this.logger.debug(`Target WebSocket closed: ${code} ${reason}`);
      this.loadBalancer.decrementConnections(target);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(code, reason);
      }
    });

    targetWs.on("error", (error) => {
      this.logger.error(`Target WebSocket error for ${targetUrl}:`, error);
      this.loadBalancer.decrementConnections(target);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1002, "Target connection error");
      }
    });

    clientWs.on("message", (data, isBinary) => {
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(data, { binary: isBinary });
      }
    });

    clientWs.on("close", (code, reason) => {
      this.logger.debug(`Client WebSocket closed: ${code} ${reason}`);
      this.loadBalancer.decrementConnections(target);
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.close(code, reason);
      }
    });

    clientWs.on("error", (error) => {
      this.logger.error("Client WebSocket error:", error);
      this.loadBalancer.decrementConnections(target);
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.close(1002, "Client connection error");
      }
    });

    clientWs.on("ping", (data) => {
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.ping(data);
      }
    });

    clientWs.on("pong", (data) => {
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.pong(data);
      }
    });

    targetWs.on("ping", (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.ping(data);
      }
    });

    targetWs.on("pong", (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.pong(data);
      }
    });
  }

  private prepareHeaders(req: http.IncomingMessage): Record<string, string> {
    const headers: Record<string, string> = {};

    const headersToForward = [
      'authorization',
      'cookie',
      'user-agent',
      'x-forwarded-for',
      'x-real-ip'
    ];

    for (const header of headersToForward) {
      const value = req.headers[header];
      if (value) {
        headers[header] = Array.isArray(value) ? value[0] : value;
      }
    }

    headers['x-forwarded-for'] = req.socket.remoteAddress || '';
    headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'ws';

    return headers;
  }

  private handleProtocols(protocols: Set<string>): string | false {
    return protocols.values().next().value || false;
  }

  getConnectedClients(): number {
    return this.wss.clients.size;
  }

  getStats() {
    return {
      connectedClients: this.getConnectedClients(),
      enabled: true
    };
  }

  close(): void {
    this.wss.close(() => {
      this.logger.info("WebSocket server closed");
    });
  }
}