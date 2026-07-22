import { v4 as uuidv4 } from 'uuid';
import { BrowserManager } from '../browser/browser-manager';
import { Database } from '../database/db';
import { AIAgent } from '../ai/ai-agent';
import { logger } from '../utils/logger';
import { Task, CourtCase, PersonInfo, Document, ExecutionOrder } from '../types/index';
import fs from 'fs';
import path from 'path';

export class TaskExecutor {
  private browserManager: BrowserManager;
  private database: Database;
  private aiAgent: AIAgent;
  private documentsPath: string;

  constructor(browserManager: BrowserManager, database: Database, aiAgent: AIAgent) {
    this.browserManager = browserManager;
    this.database = database;
    this.aiAgent = aiAgent;
    this.documentsPath = './documents/';
    this.ensureDocumentsDirectory();
  }

  private ensureDocumentsDirectory(): void {
    if (!fs.existsSync(this.documentsPath)) {
      fs.mkdirSync(this.documentsPath, { recursive: true });
      logger.info(`Created documents directory: ${this.documentsPath}`);
    }
  }

  async executeTask(task: Task): Promise<boolean> {
    logger.info('Executing task', { taskId: task.id, type: task.type });

    try {
      switch (task.type) {
        case 'search_case':
          return await this.handleSearchCase(task);
        case 'get_case_info':
          return await this.handleGetCaseInfo(task);
        case 'fill_form':
          return await this.handleFillForm(task);
        case 'send_document':
          return await this.handleSendDocument(task);
        case 'check_status':
          return await this.handleCheckStatus(task);
        case 'get_documents':
          return await this.handleGetDocuments(task);
        case 'auto_click':
          return await this.handleAutoClick(task);
        default:
          logger.warn('Unknown task type', { type: task.type });
          return false;
      }
    } catch (error) {
      logger.error('Task execution failed', { taskId: task.id, error: String(error) });
      task.status = 'failed';
      await this.database.saveTask(task);
      return false;
    }
  }

  private async handleSearchCase(task: Task): Promise<boolean> {
    logger.info('Handling search case task');

    if (task.caseNumber) {
      return await this.browserManager.searchCaseByNumber(task.caseNumber);
    } else if (task.personInfo) {
      return await this.browserManager.searchCaseByPerson(task.personInfo.name, task.personInfo.shinsis);
    }

    return false;
  }

  private async handleGetCaseInfo(task: Task): Promise<boolean> {
    logger.info('Handling get case info task');

    const caseInfo = await this.browserManager.extractCaseInfo();
    if (caseInfo) {
      task.result = caseInfo;
      task.status = 'completed';
      await this.database.saveTask(task);
      return true;
    }

    return false;
  }

  private async handleFillForm(task: Task): Promise<boolean> {
    logger.info('Handling fill form task');

    const fields = task.parameters.fields || {};
    return await this.browserManager.fillForm(fields);
  }

  private async handleSendDocument(task: Task): Promise<boolean> {
    logger.info('Handling send document task');

    const { documentType, caseData, recipientEmail } = task.parameters;

    let documentContent = '';

    if (documentType === 'court_order') {
      documentContent = await this.aiAgent.generateCourtOrder(caseData);
    } else if (documentType === 'execution_order') {
      documentContent = await this.aiAgent.generateExecutionOrder(caseData);
    }

    if (documentContent) {
      // Save document to file
      const fileName = `${documentType}_${caseData.caseNumber}_${Date.now()}.pdf`;
      const filePath = path.join(this.documentsPath, fileName);

      fs.writeFileSync(filePath, documentContent);
      logger.info('Document saved', { filePath });

      // Here you would integrate with the actual document sending system
      // For now, we just save it locally
      task.result = { filePath, recipientEmail };
      task.status = 'completed';
      await this.database.saveTask(task);
      return true;
    }

    return false;
  }

  private async handleCheckStatus(task: Task): Promise<boolean> {
    logger.info('Handling check status task');

    if (task.caseNumber) {
      const courtCase = await this.database.getCase(task.caseNumber);
      if (courtCase) {
        task.result = { status: courtCase.status };
        task.status = 'completed';
        await this.database.saveTask(task);
        return true;
      }
    }

    return false;
  }

  private async handleGetDocuments(task: Task): Promise<boolean> {
    logger.info('Handling get documents task');

    if (task.caseNumber) {
      const courtCase = await this.database.getCase(task.caseNumber);
      if (courtCase) {
        const documents = await this.database.getDocumentsByCaseId(courtCase.id);
        task.result = { documents };
        task.status = 'completed';
        await this.database.saveTask(task);
        return true;
      }
    }

    return false;
  }

  private async handleAutoClick(task: Task): Promise<boolean> {
    logger.info('Handling auto click task');

    const selector = task.parameters.selector;
    if (selector) {
      return await this.browserManager.autoClick(selector);
    }

    return false;
  }

  async createCaseInSystem(caseData: {
    caseNumber: string;
    plaintiff: PersonInfo;
    defendant: PersonInfo;
    description: string;
  }): Promise<CourtCase> {
    logger.info('Creating case in system', { caseNumber: caseData.caseNumber });

    const courtCase: CourtCase = {
      id: uuidv4(),
      caseNumber: caseData.caseNumber,
      plaintiff: caseData.plaintiff,
      defendant: caseData.defendant,
      status: 'opened',
      description: caseData.description,
      createdDate: new Date(),
      updatedDate: new Date(),
      documents: [],
    };

    await this.database.saveCase(courtCase);
    logger.info('Case created successfully', { caseId: courtCase.id });
    return courtCase;
  }

  async saveDocument(document: Document): Promise<void> {
    logger.info('Saving document', { documentId: document.id, type: document.type });

    // Save document content to file
    if (document.content) {
      const fileName = `${document.type}_${document.id}.txt`;
      document.filePath = path.join(this.documentsPath, fileName);
      fs.writeFileSync(document.filePath, document.content);
    }

    await this.database.saveDocument(document);
  }

  async prepareCourtOrder(
    courtCase: CourtCase,
    decision: string
  ): Promise<{ filePath: string; content: string }> {
    logger.info('Preparing court order', { caseNumber: courtCase.caseNumber });

    const caseData = {
      caseNumber: courtCase.caseNumber,
      plaintiff: courtCase.plaintiff.name,
      defendant: courtCase.defendant.name,
      decision,
    };

    const content = await this.aiAgent.generateCourtOrder(caseData);

    const fileName = `court_order_${courtCase.caseNumber}_${Date.now()}.txt`;
    const filePath = path.join(this.documentsPath, fileName);
    fs.writeFileSync(filePath, content);

    logger.info('Court order prepared', { filePath });

    return { filePath, content };
  }

  async prepareExecutionOrder(
    courtCase: CourtCase,
    executionBody: string,
    amount: number
  ): Promise<{ filePath: string; content: string }> {
    logger.info('Preparing execution order', { caseNumber: courtCase.caseNumber });

    const caseData = {
      caseNumber: courtCase.caseNumber,
      plaintiff: courtCase.plaintiff.name,
      defendant: courtCase.defendant.name,
      amount,
      executionBody,
    };

    const content = await this.aiAgent.generateExecutionOrder(caseData);

    const fileName = `execution_order_${courtCase.caseNumber}_${Date.now()}.txt`;
    const filePath = path.join(this.documentsPath, fileName);
    fs.writeFileSync(filePath, content);

    logger.info('Execution order prepared', { filePath });

    return { filePath, content };
  }
}
