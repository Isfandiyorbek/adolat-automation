/**
 * Основные типы для системы автоматизации судебных дел
 */

export interface CourtCase {
  id: string;
  caseNumber: string;
  plaintiff: PersonInfo;
  defendant: PersonInfo;
  status: CaseStatus;
  description: string;
  createdDate: Date;
  updatedDate: Date;
  documents: Document[];
  executionOrders?: ExecutionOrder[];
}

export interface PersonInfo {
  name: string;
  shinsis?: string; // ШНИЛС (ID узбека)
  passportNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  role: 'plaintiff' | 'defendant';
}

export type CaseStatus = 
  | 'search'
  | 'opened'
  | 'in_progress'
  | 'decision_made'
  | 'decision_sent'
  | 'execution_started'
  | 'execution_completed'
  | 'closed';

export interface Document {
  id: string;
  caseId: string;
  type: DocumentType;
  title: string;
  content: string;
  filePath: string;
  createdDate: Date;
  sentTo?: string[];
  status: DocumentStatus;
}

export type DocumentType = 
  | 'court_order'
  | 'execution_order'
  | 'appeal'
  | 'complaint'
  | 'evidence'
  | 'decision'
  | 'other';

export type DocumentStatus = 
  | 'draft'
  | 'ready'
  | 'sent'
  | 'delivered'
  | 'received';

export interface ExecutionOrder {
  id: string;
  caseId: string;
  documentId: string;
  executionBody: string; // Исполнительный орган
  sendDate: Date;
  status: ExecutionStatus;
  recipient: PersonInfo;
}

export type ExecutionStatus = 
  | 'prepared'
  | 'sent'
  | 'received'
  | 'in_execution'
  | 'completed'
  | 'failed';

export interface Task {
  id: string;
  type: TaskType;
  caseNumber?: string;
  personInfo?: PersonInfo;
  parameters: Record<string, any>;
  status: TaskStatus;
  createdDate: Date;
  result?: Record<string, any>;
}

export type TaskType = 
  | 'search_case'
  | 'get_case_info'
  | 'fill_form'
  | 'send_document'
  | 'check_status'
  | 'get_documents'
  | 'auto_click'
  | 'custom';

export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused';

export interface BrowserAction {
  type: ActionType;
  selector?: string;
  value?: string;
  waitTime?: number;
  screenshot?: boolean;
}

export type ActionType = 
  | 'click'
  | 'fill'
  | 'select'
  | 'screenshot'
  | 'wait'
  | 'navigate'
  | 'scroll'
  | 'extract_text'
  | 'hover'
  | 'press_key';

export interface AIResponse {
  action: BrowserAction[];
  reasoning: string;
  nextStep?: string;
  confidence: number;
}

export interface SearchResult {
  caseId: string;
  caseNumber: string;
  parties: string;
  status: string;
  link: string;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, any>;
}
