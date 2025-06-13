import http from "http";

export interface MiddlewareFunction {
  (req: http.IncomingMessage, res: http.ServerResponse, next: () => void): void;
}

export class MiddlewarePipeline {
  private middlewares: MiddlewareFunction[] = [];

  use(middleware: MiddlewareFunction): void {
    this.middlewares.push(middleware);
  }

  async execute(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    return new Promise((resolve) => {
      let index = 0;

      const next = () => {
        if (index >= this.middlewares.length) {
          resolve(true);
          return;
        }

        const middleware = this.middlewares[index++];
        try {
          middleware(req, res, next);
        } catch (error) {
          console.error("Middleware error:", error);
          resolve(false);
        }
      };

      next();
    });
  }
}

// Built-in middleware functions
export const headerMiddleware = (headers: Record<string, string>): MiddlewareFunction => {
  return (req, res, next) => {
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    next();
  };
};

export const requestLoggerMiddleware: MiddlewareFunction = (req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end;
  
  res.end = function(...args: any[]) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    return originalEnd.apply(this, args);
  };
  
  next();
};

export const securityHeadersMiddleware: MiddlewareFunction = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
};