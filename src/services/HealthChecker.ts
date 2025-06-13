/**
 * HealthChecker service that monitors the health status of backend targets
 * by performing periodic HTTP health checks and tracking their availability.
 */
import http from "http";
import { Target, Route, LoadBalancerConfig } from '../types/index.js';

export class HealthChecker {
  private config: LoadBalancerConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(config: LoadBalancerConfig) {
    this.config = config;
  }

  start(routes: Route[]): void {
    if (!this.config.healthCheck?.enabled) return;

    const interval = this.config.healthCheck.interval || 30000;

    this.intervalId = setInterval(async () => {
      await this.checkAllTargets(routes);
    }, interval);

    console.log(`Health checker started with ${interval}ms interval`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('Health checker stopped');
    }
  }

  private async checkAllTargets(routes: Route[]): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const route of routes) {
      if (!route.targets) continue;

      for (const target of route.targets) {
        promises.push(this.checkTarget(target));
      }
    }

    await Promise.allSettled(promises);
  }

  private async checkTarget(target: Target): Promise<void> {
    try {
      const isHealthy = await this.performHealthCheck(target);
      const wasHealthy = target.healthy !== false;
      
      target.healthy = isHealthy;

      if (wasHealthy !== isHealthy) {
        console.log(`Target ${target.url} health changed: ${wasHealthy ? 'healthy' : 'unhealthy'} -> ${isHealthy ? 'healthy' : 'unhealthy'}`);
      }
    } catch (error) {
      target.healthy = false;
      console.error(`Health check failed for ${target.url}:`, error);
    }
  }

  private performHealthCheck(target: Target): Promise<boolean> {
    return new Promise((resolve) => {
      const url = new URL(target.url);
      const healthPath = this.config.healthCheck?.path || "/health";
      const timeout = this.config.healthCheck?.timeout || 5000;

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: healthPath,
        method: "GET",
        timeout
      };

      const req = http.request(options, (res) => {
        const isHealthy = res.statusCode ? res.statusCode < 400 : false;
        resolve(isHealthy);
      });

      req.on("error", () => resolve(false));
      
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  async checkTargetNow(target: Target): Promise<boolean> {
    try {
      const isHealthy = await this.performHealthCheck(target);
      target.healthy = isHealthy;
      return isHealthy;
    } catch (error) {
      target.healthy = false;
      return false;
    }
  }

  getHealthyTargets(targets: Target[]): Target[] {
    return targets.filter(t => t.healthy !== false);
  }

  getStats(routes: Route[]) {
    let totalTargets = 0;
    let healthyTargets = 0;

    for (const route of routes) {
      if (!route.targets) continue;
      
      totalTargets += route.targets.length;
      healthyTargets += route.targets.filter(t => t.healthy !== false).length;
    }

    return {
      enabled: this.config.healthCheck?.enabled || false,
      interval: this.config.healthCheck?.interval || 30000,
      timeout: this.config.healthCheck?.timeout || 5000,
      path: this.config.healthCheck?.path || "/health",
      totalTargets,
      healthyTargets,
      unhealthyTargets: totalTargets - healthyTargets
    };
  }
}