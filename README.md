# cyst

A lightweight, high-performance reverse proxy server built with TypeScript and Bun.

## Features

### Core Features

#### ✅ Request Forwarding
- HTTP/HTTPS request forwarding to backend servers
- Path-based routing (`/service` → `http://backend:3000`)
- Host-based routing (`api.domain.com` → `backend-service`)
- Multiple backend targets per route

#### ✅ Load Balancing
- **Round-robin distribution** - Evenly distributes requests
- **Least connections algorithm** - Routes to server with fewest active connections
- **Configurable server weights** - Assign different traffic ratios
- **Health checks** - Active/passive monitoring with automatic failover

#### ✅ Configuration
- **JSON/YAML config file support** - Choose your preferred format
- **Environment variables** - Override config via `CONFIG_JSON` env var
- **Runtime reload** - Reload config with SIGHUP signal
- **Multiple backend targets** - Redundancy and load distribution

#### ✅ Security
- **HTTPS termination** - SSL/TLS certificate support
- **Basic authentication** - Username/password protection
- **IP whitelisting/blacklisting** - Network-level access control
- **CORS headers management** - Cross-origin request handling

#### ✅ WebSocket Support
- **TCP tunnel for WS connections** - Full WebSocket proxy support
- **Connection upgrade handling** - Seamless WebSocket proxying
- **Bi-directional message forwarding** - Real-time communication

### Essential Enhancements

#### ✅ Middleware Pipeline
- **Request/response modification** - Transform data in transit
- **Header manipulation** - Add, remove, or modify headers
- **URL rewriting** - Rewrite request paths before forwarding
- **Custom logging** - Configurable logging middleware

#### ✅ Error Handling
- **502 Bad Gateway fallback** - Graceful error responses
- **Custom error pages** - Branded error pages
- **Connection timeout settings** - Configurable timeouts
- **Retry mechanisms** - Automatic retry on failure

#### ✅ Logging & Monitoring
- **Access logs** - Common/Combined log formats
- **Error logging** - Detailed error tracking
- **Request timing metrics** - Performance monitoring
- **Status endpoint** - Health check at `/status`

### Advanced Features

#### ✅ Caching
- **Static asset caching** - In-memory response caching
- **Cache-control header support** - Respects cache headers
- **Short-term response caching** - Configurable cache TTL

#### ✅ Rate Limiting
- **Per-IP request throttling** - Prevent abuse
- **Global rate limits** - System-wide protection
- **Burst protection** - Handle traffic spikes

#### ✅ Compression
- **Gzip/Brotli response compression** - Reduce bandwidth
- **Configurable content type rules** - Smart compression

## Installation

```bash
# Install globally via npm
npm install -g cyst

# Or install via bun
bun install -g cyst

# Run with default config
cyst

# Or clone from source
git clone <repository-url>
cd cyst
bun install
bun run start
```

## Quick Start

1. Create a `config.json` file:
```json
{
  "port": 8080,
  "staticDir": "./static",
  "routes": [
    {
      "path": "/api",
      "targets": [{"url": "http://localhost:3000"}]
    }
  ]
}
```

2. Start cyst:
```bash
cyst
```

3. Your proxy is now running on port 8080!

## Configuration

### Basic Configuration (JSON)

```json
{
  "port": 8080,
  "staticDir": "./static",
  "routes": [
    {
      "path": "/api/products",
      "targets": [
        {"url": "http://product-service:3001", "weight": 2},
        {"url": "http://backup-service:3001", "weight": 1}
      ]
    }
  ]
}
```

### Advanced Configuration (YAML)

```yaml
port: 8080
staticDir: "./static"

# Security settings
security:
  https:
    cert: "./certs/server.crt"
    key: "./certs/server.key"
    port: 8443
  basicAuth:
    username: "admin"
    password: "secure123"
  ipWhitelist:
    - "127.0.0.1"
    - "192.168.1.0/24"
  cors:
    origins: ["*"]
    methods: ["GET", "POST", "PUT", "DELETE"]

# Load balancer settings
loadBalancer:
  algorithm: "least-connections"
  healthCheck:
    enabled: true
    interval: 30000
    timeout: 5000
    path: "/health"

# Enable features
compression: true
cache:
  enabled: true
  maxAge: 300000

rateLimit:
  enabled: true
  windowMs: 60000
  max: 100

routes:
  - path: "/api/products"
    targets:
      - url: "http://product-service:3001"
        weight: 2
    cors: true
    cache: true
    
  - host: "api.example.com"
    targets:
      - url: "http://api-backend:4000"
    auth: true
    
  - path: "/ws"
    targets:
      - url: "http://websocket-service:6000"
```

### Environment Variables

Override configuration using environment variables:

```bash
# Use JSON configuration from environment
export CONFIG_JSON='{"port": 8080, "routes": [...]}'

# Start the proxy
bun run start
```

## Route Configuration

### Path-based Routing
```yaml
routes:
  - path: "/api/users"
    targets:
      - url: "http://user-service:3000"
```

### Host-based Routing
```yaml
routes:
  - host: "api.example.com"
    targets:
      - url: "http://api-backend:4000"
```

### Static File Serving
```yaml
routes:
  - path: "/docs"
    staticFile: "documentation.html"
    cache: true
```

### URL Rewriting
```yaml
routes:
  - path: "/old-api"
    targets:
      - url: "http://new-service:5000"
    rewrite: "/v2/api"
```

### WebSocket Support
```yaml
routes:
  - path: "/ws"
    targets:
      - url: "http://websocket-service:6000"
```

## Load Balancing

### Algorithms

#### Round Robin
Distributes requests evenly across all healthy targets.

```yaml
loadBalancer:
  algorithm: "round-robin"
```

#### Least Connections
Routes requests to the target with the fewest active connections.

```yaml
loadBalancer:
  algorithm: "least-connections"
```

### Server Weights
Assign different traffic ratios to targets:

```yaml
routes:
  - path: "/api"
    targets:
      - url: "http://server1:3000"
        weight: 3  # Gets 75% of traffic
      - url: "http://server2:3000"
        weight: 1  # Gets 25% of traffic
```

### Health Checks
Monitor backend health and automatically remove unhealthy targets:

```yaml
loadBalancer:
  healthCheck:
    enabled: true
    interval: 30000   # Check every 30 seconds
    timeout: 5000     # 5 second timeout
    path: "/health"   # Health check endpoint
```

## Security

### HTTPS Termination
```yaml
security:
  https:
    cert: "./certs/server.crt"
    key: "./certs/server.key"
    port: 8443
```

### Basic Authentication
```yaml
security:
  basicAuth:
    username: "admin"
    password: "secure123"

routes:
  - path: "/admin"
    auth: true  # Require authentication
```

### IP Access Control
```yaml
security:
  ipWhitelist:
    - "127.0.0.1"
    - "192.168.1.0/24"
  ipBlacklist:
    - "10.0.0.5"
```

### CORS Configuration
```yaml
security:
  cors:
    origins:
      - "https://example.com"
      - "https://app.example.com"
    methods: ["GET", "POST", "PUT", "DELETE"]
    headers: ["Content-Type", "Authorization"]
```

## Monitoring

### Status Endpoint
Access real-time proxy status at `/status`:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "routes": [...],
  "cache": {
    "size": 42,
    "enabled": true
  },
  "rateLimit": {
    "enabled": true,
    "activeIPs": 15
  }
}
```

### Logging
Configure access and error logging:

```yaml
logging:
  accessLog: true
  errorLog: true
  format: "combined"  # or "common"
  level: "info"
```

### Access Log Format
- **Common**: `IP - - [timestamp] "method url protocol" status size duration`
- **Combined**: Includes user agent and referer

## Performance Features

### Compression
Automatic gzip/brotli compression for supported content types:

```yaml
compression: true
```

### Caching
In-memory response caching:

```yaml
cache:
  enabled: true
  maxAge: 300000  # 5 minutes

routes:
  - path: "/api/data"
    cache: true  # Enable for this route
```

### Rate Limiting
Protect against abuse:

```yaml
rateLimit:
  enabled: true
  windowMs: 60000  # 1 minute window
  max: 100        # 100 requests per window

routes:
  - path: "/public-api"
    rateLimit: 50  # Override global limit
```

## Runtime Management

### Configuration Reload
Reload configuration without downtime:

```bash
# Send SIGHUP signal to reload config
kill -SIGHUP <proxy-pid>

# Or using process name
pkill -SIGHUP -f "bun.*index.ts"
```

### Error Handling
- Automatic failover to healthy targets
- Configurable retry attempts
- Custom error pages
- Connection timeout handling

## Docker Support

### Basic Dockerfile
```dockerfile
FROM oven/bun:1

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
EXPOSE 8080

CMD ["bun", "run", "start"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  proxy:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./config.yaml:/app/config.yaml
      - ./static:/app/static
    environment:
      - NODE_ENV=production
```

## Examples

### Microservices Gateway
```yaml
routes:
  - path: "/api/users"
    targets:
      - url: "http://user-service:3000"
    cors: true
    auth: true
    
  - path: "/api/products"
    targets:
      - url: "http://product-service:3001"
      - url: "http://product-service-2:3001"
    cors: true
    cache: true
    
  - path: "/api/orders"
    targets:
      - url: "http://order-service:3002"
    cors: true
    auth: true
    rateLimit: 50
```

### Multi-tenant SaaS
```yaml
routes:
  - host: "tenant1.example.com"
    targets:
      - url: "http://tenant1-backend:4000"
    auth: true
    
  - host: "tenant2.example.com"
    targets:
      - url: "http://tenant2-backend:4001"
    auth: true
    
  - host: "api.example.com"
    targets:
      - url: "http://shared-api:5000"
    cors: true
    rateLimit: 1000
```

## License

MIT License - see LICENSE file for details.
