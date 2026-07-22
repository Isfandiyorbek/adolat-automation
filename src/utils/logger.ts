import { LogEntry } from '../types/index';
import fs from 'fs';
import path from 'path';

class Logger {
  private logs: LogEntry[] = [];
  private logFilePath: string = path.join(process.cwd(), 'logs', `${new Date().toISOString().split('T')[0]}.log`);

  constructor() {
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
    };

    this.logs.push(entry);
    this.writeToFile(entry);
    this.printToConsole(entry);
  }

  private writeToFile(entry: LogEntry): void {
    const logMessage = `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] ${entry.message}${
      entry.context ? ' ' + JSON.stringify(entry.context) : ''
    }\n`;

    fs.appendFileSync(this.logFilePath, logMessage);
  }

  private printToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase();
    const context = entry.context ? JSON.stringify(entry.context) : '';

    const colors: Record<string, string> = {
      info: '\x1b[36m', // Cyan
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      debug: '\x1b[35m', // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level] || reset;

    console.log(`${color}[${timestamp}] [${level}]${reset} ${entry.message}${context ? ' ' + context : ''}`);
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = new Logger();
