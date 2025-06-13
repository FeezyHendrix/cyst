/**
 * Configuration loading and validation service with support for JSON, YAML, and environment variables
 */

import { readFileSync, existsSync } from "fs";
import { parse as parseYAML } from "yaml";
import { Config } from '../types/index.js';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: Config | null = null;

  private constructor() {}

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  load(): Config {
    let configData: string;

    if (process.env.CONFIG_JSON) {
      configData = process.env.CONFIG_JSON;
      this.config = JSON.parse(configData);
      console.log("Configuration loaded from environment variable");
      return this.config;
    }

    if (existsSync("./config.yaml") || existsSync("./config.yml")) {
      const yamlFile = existsSync("./config.yaml") ? "./config.yaml" : "./config.yml";
      configData = readFileSync(yamlFile, "utf8");
      this.config = parseYAML(configData);
      console.log(`Configuration loaded from: ${yamlFile}`);
      return this.config;
    }

    if (existsSync("./config.json")) {
      configData = readFileSync("./config.json", "utf8");
      this.config = JSON.parse(configData);
      console.log("Configuration loaded from: config.json");
      return this.config;
    }

    throw new Error("No configuration file found. Please provide config.json, config.yaml, or CONFIG_JSON environment variable.");
  }

  reload(): Config {
    try {
      const newConfig = this.load();
      console.log("Configuration reloaded successfully");
      return newConfig;
    } catch (error) {
      console.error("Failed to reload configuration:", error);
      if (this.config) {
        console.log("Using previous configuration");
        return this.config;
      }
      throw error;
    }
  }

  getConfig(): Config {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }

  validateConfig(config: Config): void {
    // Basic validation
    if (!config.port || config.port <= 0 || config.port > 65535) {
      throw new Error("Invalid port number");
    }

    if (!config.staticDir) {
      throw new Error("staticDir is required");
    }

    if (!config.routes || !Array.isArray(config.routes)) {
      throw new Error("routes must be an array");
    }

    // Validate routes
    for (const route of config.routes) {
      if (!route.path && !route.host) {
        throw new Error("Each route must have either a path or host");
      }

      if (route.targets) {
        for (const target of route.targets) {
          if (!target.url) {
            throw new Error("Each target must have a url");
          }
          
          try {
            new URL(target.url);
          } catch (error) {
            throw new Error(`Invalid target URL: ${target.url}`);
          }
        }
      }
    }

    // Validate security config
    if (config.security?.https) {
      const https = config.security.https;
      if (!https.cert || !https.key) {
        throw new Error("HTTPS configuration requires both cert and key files");
      }
      
      if (!existsSync(https.cert)) {
        throw new Error(`HTTPS cert file not found: ${https.cert}`);
      }
      
      if (!existsSync(https.key)) {
        throw new Error(`HTTPS key file not found: ${https.key}`);
      }
    }

    console.log("Configuration validation passed");
  }

  getConfigSource(): string {
    if (process.env.CONFIG_JSON) return "environment";
    if (existsSync("./config.yaml")) return "config.yaml";
    if (existsSync("./config.yml")) return "config.yml";
    if (existsSync("./config.json")) return "config.json";
    return "unknown";
  }
}