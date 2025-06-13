/**
 * Compression service that handles gzip and brotli compression for HTTP responses
 * to reduce bandwidth usage and improve response times.
 */
import { gzipSync, brotliCompressSync } from "zlib";
import http from "http";

export class Compression {
  private enabled: boolean;
  private compressibleTypes: string[];

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
    this.compressibleTypes = [
      "text/html",
      "text/css", 
      "text/javascript",
      "text/xml",
      "text/plain",
      "text/json",
      "application/json",
      "application/javascript",
      "application/xml",
      "application/rss+xml",
      "application/atom+xml",
      "image/svg+xml"
    ];
  }

  shouldCompress(contentType: string, size?: number): boolean {
    if (!this.enabled) return false;
    
    if (size && size < 1024) return false;
    
    return this.compressibleTypes.some(type => 
      contentType.toLowerCase().includes(type)
    );
  }

  compress(data: Buffer, encoding: string): Buffer {
    if (!this.enabled) return data;

    try {
      switch (encoding) {
        case "br":
          return brotliCompressSync(data);
        case "gzip":
          return gzipSync(data);
        default:
          return data;
      }
    } catch (error) {
      console.error("Compression failed:", error);
      return data;
    }
  }

  selectEncoding(acceptEncoding: string): string | null {
    if (!this.enabled) return null;

    const encodings = acceptEncoding.toLowerCase();
    
    if (encodings.includes("br")) {
      return "br";
    }
    
    if (encodings.includes("gzip")) {
      return "gzip";
    }
    
    return null;
  }

  processResponse(
    data: Buffer, 
    contentType: string, 
    acceptEncoding: string
  ): { data: Buffer; encoding?: string } {
    if (!this.shouldCompress(contentType, data.length)) {
      return { data };
    }

    const encoding = this.selectEncoding(acceptEncoding);
    if (!encoding) {
      return { data };
    }

    const compressed = this.compress(data, encoding);
    
    if (compressed.length < data.length) {
      return { data: compressed, encoding };
    }
    
    return { data };
  }

  setCompressionHeaders(
    res: http.ServerResponse, 
    encoding?: string,
    originalSize?: number,
    compressedSize?: number
  ): void {
    if (encoding) {
      res.setHeader("Content-Encoding", encoding);
      res.setHeader("Vary", "Accept-Encoding");
      
      if (originalSize && compressedSize) {
        const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
        res.setHeader("X-Compression-Ratio", `${ratio}%`);
      }
    }
  }

  addCompressibleType(type: string): void {
    if (!this.compressibleTypes.includes(type)) {
      this.compressibleTypes.push(type);
    }
  }

  removeCompressibleType(type: string): void {
    const index = this.compressibleTypes.indexOf(type);
    if (index > -1) {
      this.compressibleTypes.splice(index, 1);
    }
  }

  getStats() {
    return {
      enabled: this.enabled,
      compressibleTypes: this.compressibleTypes.length,
      supportedEncodings: ["gzip", "br"]
    };
  }
}