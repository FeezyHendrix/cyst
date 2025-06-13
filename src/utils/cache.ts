import * as http from 'http';

export class SimpleCache {
    private store: Record<string, { status: number, headers: http.OutgoingHttpHeaders, body: Buffer }> = {};
  
    get(key: string) {
      return this.store[key];
    }
  
    set(key: string, status: number, headers: http.OutgoingHttpHeaders, body: Buffer) {
      this.store[key] = { status, headers, body };
    }
  }
  