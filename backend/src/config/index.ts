import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // AI Providers
  ai: {
    defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3',
    },
  },

  // GitHub
  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_OWNER || '',
    defaultBranch: process.env.GITHUB_DEFAULT_BRANCH || 'main',
  },

  // Agent Config
  agents: {
    nightlySchedule: process.env.NIGHTLY_SCHEDULE || '0 21 * * *',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_AGENTS || '3', 10),
    monthlyBudget: parseFloat(process.env.MONTHLY_BUDGET_LIMIT || '100'),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
} as const;

export type Config = typeof config;
