import { config, validateConfig } from './config/config';
import { logger } from './utils/logger';
import { BrowserManager } from './browser/browser-manager';
import { Database } from './database/db';
import { AIAgent } from './ai/ai-agent';
import { TaskExecutor } from './executor/task-executor';
import { APIServer } from './server/api-server';
import { v4 as uuidv4 } from 'uuid';
import { Task } from './types/index';

async function main(): Promise<void> {
  try {
    logger.info('=== Adolat Automation Agent Started ===');
    validateConfig();

    // Initialize components
    const database = new Database(config.database.path);
    const browserManager = new BrowserManager();
    const aiAgent = new AIAgent();
    const taskExecutor = new TaskExecutor(browserManager, database, aiAgent);

    // Initialize browser
    await browserManager.initialize();

    // Login to court site
    logger.info('Attempting to login to court site');
    const loginSuccess = await browserManager.login(
      config.courtSite.username,
      config.courtSite.password
    );

    if (!loginSuccess) {
      logger.warn('Could not auto-login. Please provide credentials.');
    }

    // Start API server
    const apiServer = new APIServer(browserManager, database, taskExecutor, aiAgent);
    apiServer.start();

    // Example: Search for a case
    logger.info('--- Running Example Tasks ---');

    // Search case by number
    const searchTask: Task = {
      id: uuidv4(),
      type: 'search_case',
      caseNumber: '123456', // Replace with actual case number
      parameters: {},
      status: 'running',
      createdDate: new Date(),
    };

    logger.info('Executing search task');
    await taskExecutor.executeTask(searchTask);

    logger.info('=== Ready for API requests ===');
    logger.info(`API available at http://${config.server.host}:${config.server.port}`);
    logger.info('Endpoints:');
    logger.info('  POST /api/auth/login - Login to court site');
    logger.info('  POST /api/cases/search - Search for cases');
    logger.info('  POST /api/cases/create - Create a new case');
    logger.info('  GET /api/cases/:caseNumber - Get case info');
    logger.info('  POST /api/tasks/execute - Execute a task');
    logger.info('  POST /api/documents/court-order - Generate court order');
    logger.info('  POST /api/documents/execution-order - Generate execution order');

    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await browserManager.close();
      await database.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error', { error: String(error) });
    process.exit(1);
  }
}

main();
