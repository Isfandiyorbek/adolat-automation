import { OpenAI } from 'openai';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { BrowserAction, AIResponse } from '../types/index';

export class AIAgent {
  private client: OpenAI | null = null;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor() {
    if (config.openai.apiKey) {
      this.client = new OpenAI({
        apiKey: config.openai.apiKey,
      });
    } else {
      logger.warn('OpenAI API key not configured. AI features will be limited.');
    }
  }

  async analyzeTask(taskDescription: string): Promise<BrowserAction[]> {
    if (!this.client) {
      logger.warn('OpenAI client not available. Returning empty actions.');
      return [];
    }

    try {
      logger.info('Analyzing task with AI', { taskDescription });

      const systemPrompt = `You are an AI assistant that controls a web browser for automating court case tasks on https://adolat.sud.uz/civil/
      
      Your job is to:
      1. Understand the user's task
      2. Break it down into specific browser actions
      3. Return a JSON array of actions to perform
      
      Available actions: click, fill, select, screenshot, wait, navigate, scroll, extract_text, hover, press_key
      
      Return only valid JSON in this format:
      {
        "actions": [
          {"type": "click", "selector": "button.submit"},
          {"type": "fill", "selector": "input#name", "value": "John Doe"}
        ],
        "reasoning": "explanation of what we're doing",
        "nextStep": "what comes next"
      }`;

      this.conversationHistory.push({
        role: 'user',
        content: taskDescription,
      });

      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const assistantMessage = response.choices[0].message.content || '';
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      // Parse JSON from response
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        logger.info('Task analyzed successfully', { actionCount: parsed.actions?.length || 0 });
        return parsed.actions || [];
      }

      return [];
    } catch (error) {
      logger.error('AI analysis failed', { error: String(error) });
      return [];
    }
  }

  async generateCourtOrder(caseData: Record<string, any>): Promise<string> {
    if (!this.client) {
      logger.warn('OpenAI client not available.');
      return '';
    }

    try {
      logger.info('Generating court order', { caseNumber: caseData.caseNumber });

      const prompt = `Generate an official court order document for the following case data:
      
Case Number: ${caseData.caseNumber}
Plaintiff: ${caseData.plaintiff}
Defendant: ${caseData.defendant}
Decision: ${caseData.decision}
Amount: ${caseData.amount || 'N/A'}

Format the response as an official court document in Russian/Uzbek.`;

      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      });

      const document = response.choices[0].message.content || '';
      logger.info('Court order generated successfully');
      return document;
    } catch (error) {
      logger.error('Court order generation failed', { error: String(error) });
      return '';
    }
  }

  async generateExecutionOrder(caseData: Record<string, any>): Promise<string> {
    if (!this.client) {
      logger.warn('OpenAI client not available.');
      return '';
    }

    try {
      logger.info('Generating execution order', { caseNumber: caseData.caseNumber });

      const prompt = `Generate an official execution order for the following case:
      
Case Number: ${caseData.caseNumber}
Plaintiff: ${caseData.plaintiff}
Defendant: ${caseData.defendant}
Decision Amount: ${caseData.amount}
Execution Body: ${caseData.executionBody}

Format as an official execution order document in Russian/Uzbek language.`;

      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      });

      const document = response.choices[0].message.content || '';
      logger.info('Execution order generated successfully');
      return document;
    } catch (error) {
      logger.error('Execution order generation failed', { error: String(error) });
      return '';
    }
  }

  resetConversation(): void {
    this.conversationHistory = [];
    logger.info('AI conversation history reset');
  }
}
