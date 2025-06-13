/**
 * Router service that handles route matching based on host and path patterns,
 * manages route configuration, and provides route validation and statistics.
 */
import http from "http";
import { Route } from '../types/index.js';

export class Router {
  private routes: Route[];

  constructor(routes: Route[] = []) {
    this.routes = routes;
  }

  updateRoutes(routes: Route[]): void {
    this.routes = routes;
  }

  findRoute(req: http.IncomingMessage): Route | null {
    const host = req.headers.host;
    const url = req.url || "/";

    const hostRoute = this.routes.find(r => r.host === host);
    if (hostRoute) {
      return hostRoute;
    }

    const pathRoutes = this.routes
      .filter(r => r.path)
      .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0));

    const pathRoute = pathRoutes.find(r => r.path && url.startsWith(r.path));
    if (pathRoute) {
      return pathRoute;
    }

    return null;
  }

  getAllRoutes(): Route[] {
    return [...this.routes];
  }

  getRoutesByType(): { pathBased: Route[]; hostBased: Route[]; static: Route[] } {
    const pathBased: Route[] = [];
    const hostBased: Route[] = [];
    const staticRoutes: Route[] = [];

    for (const route of this.routes) {
      if (route.staticFile) {
        staticRoutes.push(route);
      } else if (route.host) {
        hostBased.push(route);
      } else if (route.path) {
        pathBased.push(route);
      }
    }

    return { pathBased, hostBased, static: staticRoutes };
  }

  validateRoute(route: Route): boolean {
    if (!route.path && !route.host) {
      return false;
    }

    if (route.targets) {
      for (const target of route.targets) {
        try {
          new URL(target.url);
        } catch {
          return false;
        }
      }
    }

    return true;
  }

  addRoute(route: Route): boolean {
    if (!this.validateRoute(route)) {
      return false;
    }

    if (this.hasConflict(route)) {
      return false;
    }

    this.routes.push(route);
    return true;
  }

  removeRoute(routeToRemove: Route): boolean {
    const index = this.routes.findIndex(route => 
      route.path === routeToRemove.path && route.host === routeToRemove.host
    );

    if (index !== -1) {
      this.routes.splice(index, 1);
      return true;
    }

    return false;
  }

  private hasConflict(newRoute: Route): boolean {
    return this.routes.some(existing => {
      if (existing.path === newRoute.path && existing.host === newRoute.host) {
        return true;
      }

      if (existing.path && newRoute.path) {
        const existingPath = existing.path.replace(/\/$/, '');
        const newPath = newRoute.path.replace(/\/$/, '');
        
        if (existingPath === newPath) {
          return true;
        }
      }

      return false;
    });
  }

  getStats() {
    const routeTypes = this.getRoutesByType();
    
    return {
      total: this.routes.length,
      pathBased: routeTypes.pathBased.length,
      hostBased: routeTypes.hostBased.length,
      static: routeTypes.static.length,
      withTargets: this.routes.filter(r => r.targets?.length).length,
      withAuth: this.routes.filter(r => r.auth).length,
      withCache: this.routes.filter(r => r.cache).length,
      withCORS: this.routes.filter(r => r.cors).length
    };
  }
}