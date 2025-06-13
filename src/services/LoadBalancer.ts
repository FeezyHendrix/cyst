/**
 * Load balancing service with multiple algorithms
 */

/**
 * Load balancing service with multiple algorithms
 */
import type { Target, Route, LoadBalancerConfig } from '../types/index.ts';

export class LoadBalancer {
  private roundRobinCounters: Record<string, number> = {};
  private config: LoadBalancerConfig;

  constructor(config: LoadBalancerConfig) {
    this.config = config;
  }

  selectTarget(route: Route): Target | null {
    if (!route.targets?.length) return null;

    const healthyTargets = route.targets.filter(t => t.healthy !== false);
    if (!healthyTargets.length) return null;

    const algorithm = this.config.algorithm || "round-robin";

    if (algorithm === "least-connections") {
      return this.selectLeastConnections(healthyTargets);
    }

    return this.selectRoundRobin(route, healthyTargets);
  }

  private selectLeastConnections(targets: Target[]): Target {
    return targets.reduce((min, target) => 
      (target.connections || 0) < (min.connections || 0) ? target : min
    );
  }

  private selectRoundRobin(route: Route, targets: Target[]): Target {
    const weightedTargets = this.applyWeights(targets);
    
    const routeKey = route.path || route.host || "";
    const count = this.roundRobinCounters[routeKey] || 0;
    const target = weightedTargets[count % weightedTargets.length];
    this.roundRobinCounters[routeKey] = count + 1;

    return target;
  }

  private applyWeights(targets: Target[]): Target[] {
    const weighted: Target[] = [];
    
    for (const target of targets) {
      const weight = target.weight || 1;
      for (let i = 0; i < weight; i++) {
        weighted.push(target);
      }
    }
    
    return weighted;
  }

  incrementConnections(target: Target): void {
    target.connections = (target.connections || 0) + 1;
  }

  decrementConnections(target: Target): void {
    target.connections = Math.max(0, (target.connections || 1) - 1);
  }

  getStats(routes: Route[]) {
    const stats = {
      algorithm: this.config.algorithm,
      routes: routes.map(route => ({
        path: route.path,
        host: route.host,
        targets: route.targets?.map(t => ({
          url: t.url,
          healthy: t.healthy !== false,
          connections: t.connections || 0,
          weight: t.weight || 1
        }))
      }))
    };

    return stats;
  }
}