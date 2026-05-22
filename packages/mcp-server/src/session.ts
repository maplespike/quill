import { McpServer } from './server.js';
import { getAllTools } from './tools/index.js';
import { checkRateLimit, type WindowEntry } from './rate-limit.js';

export interface Session {
  id: string;
  server: McpServer;
  locale: string;
  authenticated: boolean;
  createdAt: number;
  lastActivity: number;
  rateLimitWindows: WindowEntry[];
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private defaultLimit: number;
  private windowMs: number;

  constructor(defaultLimit = 100, windowMs = 60000) {
    this.defaultLimit = defaultLimit;
    this.windowMs = windowMs;
  }

  createSession(id: string, locale: string, authenticated = false): Session {
    const server = new McpServer();
    const tools = getAllTools();
    for (const tool of tools) {
      server.registerTool(tool.definition, tool.handler);
    }

    const session: Session = {
      id,
      server,
      locale,
      authenticated,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      rateLimitWindows: [],
    };

    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session;
  }

  removeSession(id: string): void {
    this.sessions.delete(id);
  }

  checkRateLimit(id: string): { allowed: boolean; remaining: number; resetTime: number } {
    const session = this.sessions.get(id);
    if (!session) {
      return { allowed: false, remaining: 0, resetTime: Date.now() + this.windowMs };
    }
    return checkRateLimit(session.rateLimitWindows, this.defaultLimit, this.windowMs);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  cleanupStale(maxAgeMs = 30 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, session] of this.sessions) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(id);
      }
    }
  }
}
