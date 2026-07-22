import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { CourtCase, Document, ExecutionOrder, Task } from '../types/index';
import { logger } from '../utils/logger';

export class Database {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.ensureDirectory();
    this.db = new sqlite3.Database(this.dbPath);
    this.initializeTables();
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created database directory: ${dir}`);
    }
  }

  private initializeTables(): void {
    const tables = [
      `CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        caseNumber TEXT UNIQUE NOT NULL,
        plaintiffName TEXT NOT NULL,
        plaintiffShinsis TEXT,
        plaintiffEmail TEXT,
        defendantName TEXT NOT NULL,
        defendantShinsis TEXT,
        defendantEmail TEXT,
        status TEXT NOT NULL,
        description TEXT,
        createdDate TEXT NOT NULL,
        updatedDate TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        caseId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        filePath TEXT,
        createdDate TEXT NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY(caseId) REFERENCES cases(id)
      )`,

      `CREATE TABLE IF NOT EXISTS execution_orders (
        id TEXT PRIMARY KEY,
        caseId TEXT NOT NULL,
        documentId TEXT,
        executionBody TEXT NOT NULL,
        sendDate TEXT,
        status TEXT NOT NULL,
        recipientName TEXT NOT NULL,
        recipientEmail TEXT,
        FOREIGN KEY(caseId) REFERENCES cases(id),
        FOREIGN KEY(documentId) REFERENCES documents(id)
      )`,

      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        caseNumber TEXT,
        personName TEXT,
        personShinsis TEXT,
        parameters TEXT,
        status TEXT NOT NULL,
        createdDate TEXT NOT NULL,
        result TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT
      )`,
    ];

    tables.forEach((sql) => {
      this.db.run(sql, (err) => {
        if (err) {
          logger.error(`Database initialization error: ${err.message}`);
        }
      });
    });

    logger.info('Database tables initialized');
  }

  // Case operations
  async saveCase(courtCase: CourtCase): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO cases 
        (id, caseNumber, plaintiffName, plaintiffShinsis, plaintiffEmail, 
         defendantName, defendantShinsis, defendantEmail, status, description, createdDate, updatedDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          courtCase.id,
          courtCase.caseNumber,
          courtCase.plaintiff.name,
          courtCase.plaintiff.shinsis,
          courtCase.plaintiff.email,
          courtCase.defendant.name,
          courtCase.defendant.shinsis,
          courtCase.defendant.email,
          courtCase.status,
          courtCase.description,
          courtCase.createdDate.toISOString(),
          courtCase.updatedDate.toISOString(),
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getCase(caseNumber: string): Promise<CourtCase | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM cases WHERE caseNumber = ?`;
      this.db.get(sql, [caseNumber], (err, row: any) => {
        if (err) reject(err);
        else if (row) {
          const courtCase: CourtCase = {
            id: row.id,
            caseNumber: row.caseNumber,
            plaintiff: {
              name: row.plaintiffName,
              shinsis: row.plaintiffShinsis,
              email: row.plaintiffEmail,
              role: 'plaintiff',
            },
            defendant: {
              name: row.defendantName,
              shinsis: row.defendantShinsis,
              email: row.defendantEmail,
              role: 'defendant',
            },
            status: row.status,
            description: row.description,
            createdDate: new Date(row.createdDate),
            updatedDate: new Date(row.updatedDate),
            documents: [],
          };
          resolve(courtCase);
        } else {
          resolve(null);
        }
      });
    });
  }

  // Document operations
  async saveDocument(document: Document): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO documents
        (id, caseId, type, title, content, filePath, createdDate, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          document.id,
          document.caseId,
          document.type,
          document.title,
          document.content,
          document.filePath,
          document.createdDate.toISOString(),
          document.status,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getDocumentsByCaseId(caseId: string): Promise<Document[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM documents WHERE caseId = ?`;
      this.db.all(sql, [caseId], (err, rows: any[]) => {
        if (err) reject(err);
        else {
          const documents = rows.map((row) => ({
            id: row.id,
            caseId: row.caseId,
            type: row.type,
            title: row.title,
            content: row.content,
            filePath: row.filePath,
            createdDate: new Date(row.createdDate),
            status: row.status,
          }));
          resolve(documents);
        }
      });
    });
  }

  // Execution order operations
  async saveExecutionOrder(order: ExecutionOrder): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO execution_orders
        (id, caseId, documentId, executionBody, sendDate, status, recipientName, recipientEmail)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          order.id,
          order.caseId,
          order.documentId,
          order.executionBody,
          order.sendDate.toISOString(),
          order.status,
          order.recipient.name,
          order.recipient.email,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Task operations
  async saveTask(task: Task): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO tasks
        (id, type, caseNumber, personName, personShinsis, parameters, status, createdDate, result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          task.id,
          task.type,
          task.caseNumber,
          task.personInfo?.name,
          task.personInfo?.shinsis,
          JSON.stringify(task.parameters),
          task.status,
          task.createdDate.toISOString(),
          task.result ? JSON.stringify(task.result) : null,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getTask(taskId: string): Promise<Task | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM tasks WHERE id = ?`;
      this.db.get(sql, [taskId], (err, row: any) => {
        if (err) reject(err);
        else if (row) {
          const task: Task = {
            id: row.id,
            type: row.type,
            caseNumber: row.caseNumber,
            personInfo: {
              name: row.personName,
              shinsis: row.personShinsis,
              role: 'plaintiff',
            },
            parameters: JSON.parse(row.parameters || '{}'),
            status: row.status,
            createdDate: new Date(row.createdDate),
            result: row.result ? JSON.parse(row.result) : undefined,
          };
          resolve(task);
        } else {
          resolve(null);
        }
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else {
          logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }
}
