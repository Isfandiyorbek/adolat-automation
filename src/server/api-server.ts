import express, { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { BrowserManager } from '../browser/browser-manager';
import { Database } from '../database/db';
import { TaskExecutor } from '../executor/task-executor';
import { AIAgent } from '../ai/ai-agent';
import { Task, PersonInfo } from '../types/index';

export class APIServer {
  private app: Express;
  private browserManager: BrowserManager;
  private database: Database;
  private taskExecutor: TaskExecutor;
  private aiAgent: AIAgent;

  constructor(
    browserManager: BrowserManager,
    database: Database,
    taskExecutor: TaskExecutor,
    aiAgent: AIAgent
  ) {
    this.app = express();
    this.browserManager = browserManager;
    this.database = database;
    this.taskExecutor = taskExecutor;
    this.aiAgent = aiAgent;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Authentication
    this.app.post('/api/auth/login', async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;

        const success = await this.browserManager.login(
          username || config.courtSite.username,
          password || config.courtSite.password
        );

        res.json({ success, message: success ? 'Authenticated' : 'Authentication failed' });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Search case
    this.app.post('/api/cases/search', async (req: Request, res: Response) => {
      try {
        const { caseNumber, personName, shinsis } = req.body;

        let success = false;
        if (caseNumber) {
          success = await this.browserManager.searchCaseByNumber(caseNumber);
        } else if (personName) {
          success = await this.browserManager.searchCaseByPerson(personName, shinsis);
        }

        res.json({ success, message: success ? 'Search completed' : 'Search failed' });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Extract case information
    this.app.get('/api/cases/info', async (req: Request, res: Response) => {
      try {
        const info = await this.browserManager.extractCaseInfo();
        res.json(info);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Create case
    this.app.post('/api/cases/create', async (req: Request, res: Response) => {
      try {
        const { caseNumber, plaintiffName, plaintiffShinsis, defendantName, defendantShinsis, description } =
          req.body;

        const courtCase = await this.taskExecutor.createCaseInSystem({
          caseNumber,
          plaintiff: {
            name: plaintiffName,
            shinsis: plaintiffShinsis,
            role: 'plaintiff',
          },
          defendant: {
            name: defendantName,
            shinsis: defendantShinsis,
            role: 'defendant',
          },
          description,
        });

        res.json({ success: true, case: courtCase });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Get case by number
    this.app.get('/api/cases/:caseNumber', async (req: Request, res: Response) => {
      try {
        const courtCase = await this.database.getCase(req.params.caseNumber);
        if (courtCase) {
          res.json(courtCase);
        } else {
          res.status(404).json({ error: 'Case not found' });
        }
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Execute task
    this.app.post('/api/tasks/execute', async (req: Request, res: Response) => {
      try {
        const { type, caseNumber, personInfo, parameters } = req.body;

        const task: Task = {
          id: uuidv4(),
          type,
          caseNumber,
          personInfo,
          parameters,
          status: 'running',
          createdDate: new Date(),
        };

        await this.database.saveTask(task);
        const success = await this.taskExecutor.executeTask(task);

        res.json({ success, taskId: task.id });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Get task status
    this.app.get('/api/tasks/:taskId', async (req: Request, res: Response) => {
      try {
        const task = await this.database.getTask(req.params.taskId);
        if (task) {
          res.json(task);
        } else {
          res.status(404).json({ error: 'Task not found' });
        }
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Prepare court order
    this.app.post('/api/documents/court-order', async (req: Request, res: Response) => {
      try {
        const { caseNumber, decision } = req.body;
        const courtCase = await this.database.getCase(caseNumber);

        if (!courtCase) {
          res.status(404).json({ error: 'Case not found' });
          return;
        }

        const result = await this.taskExecutor.prepareCourtOrder(courtCase, decision);
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Prepare execution order
    this.app.post('/api/documents/execution-order', async (req: Request, res: Response) => {
      try {
        const { caseNumber, executionBody, amount } = req.body;
        const courtCase = await this.database.getCase(caseNumber);

        if (!courtCase) {
          res.status(404).json({ error: 'Case not found' });
          return;
        }

        const result = await this.taskExecutor.prepareExecutionOrder(courtCase, executionBody, amount);
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Screenshot
    this.app.post('/api/browser/screenshot', async (req: Request, res: Response) => {
      try {
        const fileName = `screenshot_${Date.now()}.png`;
        const filePath = `./screenshots/${fileName}`;
        const success = await this.browserManager.takeScreenshot(filePath);

        res.json({ success, filePath: success ? filePath : null });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Auto click
    this.app.post('/api/browser/click', async (req: Request, res: Response) => {
      try {
        const { selector } = req.body;
        const success = await this.browserManager.autoClick(selector);

        res.json({ success });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });
  }

  start(): void {
    this.app.listen(config.server.port, config.server.host, () => {
      logger.info(`API Server started on http://${config.server.host}:${config.server.port}`);
    });
  }
}
