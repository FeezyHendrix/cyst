# Architecture Documentation

## Project Structure

```
lightweight-reverse-proxy/
├── src/                          # Source code
│   ├── core/                     # Core application logic
│   │   ├── ConfigLoader.ts       # Configuration management
│   │   └── ProxyServer.ts        # Main proxy server orchestrator
│   ├── services/                 # Business logic services
│   │   ├── Cache.ts              # Response caching service
│   │   ├── Compression.ts        # Content compression service
│   │   ├── HealthChecker.ts      # Backend health monitoring
│   │   ├── LoadBalancer.ts       # Load balancing algorithms
│   │   ├── Logger.ts             # Logging service
│   │   ├── ProxyHandler.ts       # HTTP proxy request handling
│   │   ├── RateLimiter.ts        # Rate limiting service
│   │   ├── Router.ts             # Request routing logic
│   │   ├── Security.ts           # Security features (auth, CORS, IP filtering)
│   │   ├── StaticHandler.ts      # Static file serving
│   │   ├── WebSocketHandler.ts   # WebSocket proxy handling
│   │   └── index.ts              # Service exports
│   ├── types/                    # TypeScript type definitions
│   │   ├── config.ts             # Configuration interfaces
│   │   └── index.ts              # Type exports
│   ├── utils/                    # Utility functions
│   │   ├── logger.ts             # Legacy logger (kept for compatibility)
│   │   └── middleware.ts         # Middleware utilities
│   ├── static/                   # Static files to serve
│   │   ├── index.html            # Default page
│   │   └── 404.html              # Error page
│   └── index.ts                  # Application entry point
├── examples/                     # Example configurations
│   ├── config.example.json       # JSON configuration example
│   └── config.example.yaml       # YAML configuration example
├── config.json                   # Default configuration
├── package.json                  # Package configuration
├── README.md                     # User documentation
└── ARCHITECTURE.md               # This file
```

## Service Architecture

The application follows a modular service-oriented architecture with clear separation of concerns:

### Core Layer

#### ConfigLoader
- **Responsibility**: Configuration file loading and validation
- **Features**: 
  - Supports JSON/YAML configuration files
  - Environment variable override support
  - Runtime configuration reloading
  - Configuration validation

#### ProxyServer
- **Responsibility**: Main application orchestrator
- **Features**:
  - Service initialization and coordination
  - HTTP/HTTPS server management
  - Request routing and middleware coordination
  - Graceful shutdown handling

### Service Layer

#### Router
- **Responsibility**: Request routing logic
- **Features**:
  - Path-based routing (`/api/users` → backend)
  - Host-based routing (`api.domain.com` → backend)
  - Route validation and conflict detection
  - Route statistics

#### LoadBalancer
- **Responsibility**: Backend selection and traffic distribution
- **Algorithms**:
  - Round-robin with weight support
  - Least connections
- **Features**:
  - Connection tracking
  - Weight-based distribution
  - Health-aware routing

#### HealthChecker
- **Responsibility**: Backend health monitoring
- **Features**:
  - Configurable health check intervals
  - HTTP-based health checks
  - Automatic failover
  - Health status tracking

#### Security
- **Responsibility**: Security features and access control
- **Features**:
  - IP whitelisting/blacklisting with CIDR support
  - Basic authentication
  - CORS header management
  - Security headers injection

#### RateLimiter
- **Responsibility**: Request rate limiting and throttling
- **Features**:
  - Per-IP rate limiting
  - Sliding window algorithm
  - Custom rate limits per route
  - Rate limit statistics

#### Cache
- **Responsibility**: Response caching
- **Features**:
  - In-memory response caching
  - TTL-based expiration
  - Cache hit/miss tracking
  - Automatic cache cleanup

#### Compression
- **Responsibility**: Response compression
- **Features**:
  - Gzip and Brotli compression
  - Content-type based compression decisions
  - Compression ratio tracking
  - Configurable compression types

#### ProxyHandler
- **Responsibility**: HTTP request proxying
- **Features**:
  - Request forwarding to backends
  - URL rewriting
  - Error handling and retries
  - Response processing pipeline

#### StaticHandler
- **Responsibility**: Static file serving
- **Features**:
  - MIME type detection
  - Security path validation
  - Cache integration
  - Custom error pages

#### WebSocketHandler
- **Responsibility**: WebSocket connection proxying
- **Features**:
  - Bi-directional message forwarding
  - Connection lifecycle management
  - Protocol handling
  - Load balancer integration

#### Logger
- **Responsibility**: Application logging
- **Features**:
  - Structured logging with levels
  - Access log formatting (Common/Combined)
  - Error logging with context
  - Performance metrics logging

## Data Flow

### HTTP Request Flow
1. **Request Reception**: HTTP server receives request
2. **Security Check**: IP filtering and rate limiting
3. **Route Matching**: Router finds matching route
4. **Authentication**: Basic auth validation if required
5. **Cache Check**: Check for cached response
6. **Target Selection**: Load balancer selects backend
7. **Request Proxying**: Forward request to backend
8. **Response Processing**: Apply compression, caching
9. **Response Delivery**: Send response to client
10. **Logging**: Log access and metrics

### WebSocket Connection Flow
1. **Connection Upgrade**: WebSocket handshake
2. **Route Matching**: Find target backend
3. **Target Selection**: Load balancer selects backend
4. **Proxy Connection**: Establish backend WebSocket connection
5. **Message Forwarding**: Bi-directional message relay
6. **Connection Management**: Handle disconnections and errors

### Configuration Reload Flow
1. **Signal Reception**: SIGHUP signal received
2. **Configuration Loading**: Load new configuration
3. **Validation**: Validate new configuration
4. **Service Updates**: Update all services with new config
5. **Health Check Restart**: Restart health checking with new settings

## Design Principles

### Single Responsibility
Each service has a single, well-defined responsibility and encapsulates related functionality.

### Dependency Injection
Services are injected into classes that need them, making the system testable and modular.

### Configuration-Driven
All behavior is configurable through external configuration files.

### Graceful Degradation
System continues to operate even when some features are disabled or fail.

### Performance-Oriented
Built for high performance with efficient algorithms and minimal overhead.

### Security-First
Security features are integrated throughout the system, not bolted on.

## Extension Points

### Adding New Load Balancing Algorithms
1. Extend the `LoadBalancer` class
2. Add new algorithm to the `LoadBalancerConfig` type
3. Implement the algorithm in `selectTarget` method

### Adding New Middleware
1. Create new service in `src/services/`
2. Integrate with `ProxyServer` in the request pipeline
3. Add configuration options to `Config` interface

### Adding New Security Features
1. Extend the `Security` service
2. Add new security checks to the request pipeline
3. Add configuration options for the new features

### Adding New Caching Strategies
1. Extend the `Cache` service
2. Add new caching logic
3. Integrate with configuration system

This architecture provides a solid foundation for a production-ready reverse proxy while maintaining flexibility for future enhancements.