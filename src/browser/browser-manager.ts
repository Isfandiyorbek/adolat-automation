import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isAuthenticated: boolean = false;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Playwright browser');
      this.browser = await chromium.launch({
        headless: config.browser.headless,
        args: ['--disable-blink-features=AutomationControlled'],
      });

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: { width: 1280, height: 720 },
      });

      this.page = await this.context.newPage();
      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser', { error: String(error) });
      throw error;
    }
  }

  async login(username: string, password: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info('Starting authentication process', { username });
      await this.page.goto(config.courtSite.url, {
        waitUntil: 'networkidle',
        timeout: config.timeouts.navigation,
      });

      // Look for login form
      const usernameInput = await this.page.$('input[name="username"]') ||
                           await this.page.$('input[placeholder*="Username"]') ||
                           await this.page.$('input[id*="user"]');

      const passwordInput = await this.page.$('input[name="password"]') ||
                           await this.page.$('input[type="password"]');

      if (usernameInput && passwordInput) {
        await usernameInput.fill(username);
        await passwordInput.fill(password);

        // Find and click login button
        const loginButton = await this.page.$('button[type="submit"]') ||
                           await this.page.$('button:has-text("Login")') ||
                           await this.page.$('button:has-text("Вход")');

        if (loginButton) {
          await loginButton.click();
          await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: config.timeouts.navigation });

          this.isAuthenticated = true;
          logger.info('Successfully authenticated');
          return true;
        }
      }

      logger.warn('Login form elements not found');
      return false;
    } catch (error) {
      logger.error('Authentication failed', { error: String(error) });
      return false;
    }
  }

  async searchCaseByNumber(caseNumber: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info('Searching for case', { caseNumber });

      // Look for search input
      const searchInput = await this.page.$('input[placeholder*="Case"]') ||
                         await this.page.$('input[placeholder*="Дело"]') ||
                         await this.page.$('input[id*="search"]');

      if (searchInput) {
        await searchInput.fill(caseNumber);

        // Click search button
        const searchButton = await this.page.$('button[type="submit"]') ||
                            await this.page.$('button:has-text("Search")') ||
                            await this.page.$('button:has-text("Поиск")');

        if (searchButton) {
          await searchButton.click();
          await this.page.waitForTimeout(2000);
          logger.info('Case search initiated', { caseNumber });
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Case search failed', { error: String(error), caseNumber });
      return false;
    }
  }

  async searchCaseByPerson(name: string, shinsis?: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info('Searching for case by person', { name, shinsis });

      const nameInput = await this.page.$('input[placeholder*="Name"]') ||
                       await this.page.$('input[placeholder*="ФИО"]');

      if (nameInput) {
        await nameInput.fill(name);

        if (shinsis) {
          const shinsisInput = await this.page.$('input[placeholder*="SHINSIS"]') ||
                              await this.page.$('input[placeholder*="ШНИЛС"]');
          if (shinsisInput) {
            await shinsisInput.fill(shinsis);
          }
        }

        const searchButton = await this.page.$('button[type="submit"]') ||
                            await this.page.$('button:has-text("Search")');

        if (searchButton) {
          await searchButton.click();
          await this.page.waitForTimeout(2000);
          logger.info('Person search initiated');
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Person search failed', { error: String(error) });
      return false;
    }
  }

  async fillForm(fields: Record<string, string>): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info('Filling form with fields', { fields: Object.keys(fields) });

      for (const [fieldName, value] of Object.entries(fields)) {
        const input = await this.page.$(`input[name="${fieldName}"]`) ||
                     await this.page.$(`input[id="${fieldName}"]`) ||
                     await this.page.$(`textarea[name="${fieldName}"]`);

        if (input) {
          await input.fill(value);
          logger.debug(`Filled field: ${fieldName}`);
        } else {
          logger.warn(`Field not found: ${fieldName}`);
        }
      }

      return true;
    } catch (error) {
      logger.error('Form filling failed', { error: String(error) });
      return false;
    }
  }

  async submitForm(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const submitButton = await this.page.$('button[type="submit"]') ||
                          await this.page.$('button:has-text("Submit")') ||
                          await this.page.$('button:has-text("Отправить")');

      if (submitButton) {
        await submitButton.click();
        await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: config.timeouts.navigation });
        logger.info('Form submitted successfully');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Form submission failed', { error: String(error) });
      return false;
    }
  }

  async extractCaseInfo(): Promise<Record<string, any> | null> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info('Extracting case information');

      const caseInfo = await this.page.evaluate(() => {
        const text = document.body.innerText;
        return {
          pageContent: text,
          url: window.location.href,
          title: document.title,
        };
      });

      logger.debug('Case information extracted');
      return caseInfo;
    } catch (error) {
      logger.error('Failed to extract case info', { error: String(error) });
      return null;
    }
  }

  async autoClick(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info('Auto-clicking element', { selector });
      const element = await this.page.$(selector);

      if (element) {
        await element.click();
        logger.debug('Element clicked successfully');
        return true;
      }

      logger.warn('Element not found for auto-click', { selector });
      return false;
    } catch (error) {
      logger.error('Auto-click failed', { error: String(error) });
      return false;
    }
  }

  async takeScreenshot(filePath: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.screenshot({ path: filePath });
      logger.info('Screenshot taken', { filePath });
      return true;
    } catch (error) {
      logger.error('Screenshot failed', { error: String(error) });
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      logger.info('Browser closed');
    }
  }

  getPage(): Page | null {
    return this.page;
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }
}
