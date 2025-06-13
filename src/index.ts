#!/usr/bin/env bun

import { ProxyServer } from './core/ProxyServer.js';

/**
 * cyst - A lightweight, high-performance reverse proxy server. 
 * 
 * A high-performance, feature-rich reverse proxy built with TypeScript and Bun.
 * 
 * Features:
 * - Request forwarding with path/host-based routing
 * - Load balancing (round-robin, least-connections)
 * - Health checks with automatic failover
 * - HTTPS termination and security features
 * - WebSocket support
 * - Caching and compression
 * - Rate limiting and CORS
 * - Comprehensive logging and monitoring
 */

async function main() {
  try {
    console.log("🚀 Starting Lightweight Reverse Proxy...");
    
    const proxy = new ProxyServer();
    proxy.start();
    
  } catch (error) {
    console.error("❌ Failed to start proxy server:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
main().catch(error => {
  console.error("❌ Application startup failed:", error);
  process.exit(1);
});