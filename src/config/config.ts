import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  // Court Site
  courtSite: {
    url: process.env.COURT_SITE_URL || 'https://adolat.sud.uz/civil/',
    username: process.env.COURT_USERNAME || '',
    password: process.env.COURT_PASSWORD || '123456',
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
  },

  // Database
  database: {
    path: process.env.DATABASE_PATH || './data/adolat.db',
  },

  // Browser
  browser: {
    headless: process.env.HEADLESS_MODE !== 'false',
    timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
    slowMo: 100, // Замедление для отладки
  },

  // Server
  server: {
    port: parseInt(process.env.SERVER_PORT || '3000'),
    host: process.env.SERVER_HOST || 'localhost',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Documents
  documents: {
    outputPath: process.env.DOCUMENTS_OUTPUT_PATH || './documents/',
  },

  // Timeouts
  timeouts: {
    navigation: 30000,
    action: 10000,
    search: 60000,
  },
};

// Validate critical configuration
export function validateConfig(): void {
  if (!config.courtSite.username) {
    console.warn('Warning: COURT_USERNAME not set in environment variables');
  }

  const outputPath = config.documents.outputPath;
  if (!path.isAbsolute(outputPath)) {
    config.documents.outputPath = path.resolve(process.cwd(), outputPath);
  }
}

export default config;
