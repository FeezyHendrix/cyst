/**
 * StaticHandler service that serves static files with caching, compression,
 * MIME type detection, and security path validation.
 */
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import http from "http";
import { Config } from '../types/index.js';
import { Cache } from './Cache.js';
import { Compression } from './Compression.js';

export class StaticHandler {
  private config: Config;
  private cache: Cache;
  private compression: Compression;
  private mimeTypes: Record<string, string>;

  constructor(config: Config, cache: Cache, compression: Compression) {
    this.config = config;
    this.cache = cache;
    this.compression = compression;
    this.mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.xml': 'application/xml',
      '.zip': 'application/zip'
    };
  }

  serve(req: http.IncomingMessage, res: http.ServerResponse, filePath?: string): void {
    let targetPath: string;

    if (filePath) {
      targetPath = join(this.config.staticDir, filePath);
    } else {
      const urlPath = req.url === "/" ? "/index.html" : req.url || "";
      targetPath = join(this.config.staticDir, urlPath);
    }

    if (!this.isFileAccessible(targetPath)) {
      return this.serve404(res);
    }

    if (req.method === "GET") {
      const cached = this.cache.get(req);
      if (cached) {
        this.cache.recordHit();
        res.writeHead(200, { "Content-Type": cached.contentType });
        res.end(cached.data);
        return;
      }
      this.cache.recordMiss();
    }

    this.serveFile(req, res, targetPath);
  }

  private serveFile(req: http.IncomingMessage, res: http.ServerResponse, filePath: string): void {
    try {
      const data = readFileSync(filePath);
      const contentType = this.getContentType(filePath);
      
      let finalData = data;
      let encoding: string | undefined;

      if (this.config.compression && req.method === "GET") {
        const acceptEncoding = req.headers["accept-encoding"] || "";
        const result = this.compression.processResponse(data, contentType, acceptEncoding);
        finalData = result.data;
        encoding = result.encoding;
      }

      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Content-Length": finalData.length.toString(),
        "Cache-Control": "public, max-age=3600",
        "Last-Modified": this.getLastModified(filePath)
      };

      if (encoding) {
        headers["Content-Encoding"] = encoding;
        headers["Vary"] = "Accept-Encoding";
      }

      if (req.method === "GET") {
        this.cache.set(req, finalData, contentType);
      }

      res.writeHead(200, headers);
      res.end(finalData);

    } catch (error) {
      console.error(`Error serving file ${filePath}:`, error);
      this.serve500(res);
    }
  }

  private serve404(res: http.ServerResponse): void {
    const notFoundPath = join(this.config.staticDir, "404.html");
    
    if (existsSync(notFoundPath)) {
      try {
        const data = readFileSync(notFoundPath);
        res.writeHead(404, { 
          "Content-Type": "text/html",
          "Content-Length": data.length.toString()
        });
        res.end(data);
        return;
      } catch (error) {
        console.error("Error serving 404 page:", error);
      }
    }

    const defaultMessage = "<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>The requested resource was not found.</p></body></html>";
    res.writeHead(404, { 
      "Content-Type": "text/html",
      "Content-Length": defaultMessage.length.toString()
    });
    res.end(defaultMessage);
  }

  private serve500(res: http.ServerResponse): void {
    const errorMessage = "<!DOCTYPE html><html><head><title>500 Internal Server Error</title></head><body><h1>500 Internal Server Error</h1><p>An internal server error occurred.</p></body></html>";
    res.writeHead(500, { 
      "Content-Type": "text/html",
      "Content-Length": errorMessage.length.toString()
    });
    res.end(errorMessage);
  }

  private isFileAccessible(filePath: string): boolean {
    const resolvedStaticDir = require("path").resolve(this.config.staticDir);
    const resolvedFilePath = require("path").resolve(filePath);
    
    if (!resolvedFilePath.startsWith(resolvedStaticDir)) {
      console.warn(`Access denied: ${filePath} is outside static directory`);
      return false;
    }

    return existsSync(filePath);
  }

  private getContentType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    return this.mimeTypes[ext] || 'application/octet-stream';
  }

  private getLastModified(filePath: string): string {
    try {
      const stats = require("fs").statSync(filePath);
      return stats.mtime.toUTCString();
    } catch {
      return new Date().toUTCString();
    }
  }

  addMimeType(extension: string, mimeType: string): void {
    this.mimeTypes[extension] = mimeType;
  }

  getMimeTypes(): Record<string, string> {
    return { ...this.mimeTypes };
  }

  updateConfig(config: Config): void {
    this.config = config;
  }
}