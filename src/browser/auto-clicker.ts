import { Page } from '@playwright/test';
import { logger } from '../utils/logger';

export interface ClickerConfig {
  selector: string;
  interval?: number; // ms between clicks
  count?: number; // total clicks
  duration?: number; // ms total duration
  waitForSelector?: boolean;
  timeout?: number;
  screenshot?: boolean;
  beforeClick?: () => Promise<void>;
  afterClick?: () => Promise<void>;
}

export interface ClickerStats {
  totalClicks: number;
  successfulClicks: number;
  failedClicks: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  errors: string[];
}

export class AutoClicker {
  private page: Page | null = null;
  private isRunning: boolean = false;
  private stats: ClickerStats = {
    totalClicks: 0,
    successfulClicks: 0,
    failedClicks: 0,
    startTime: new Date(),
    errors: [],
  };

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Click on element multiple times with interval
   */
  async clickMultiple(config: ClickerConfig): Promise<ClickerStats> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    this.resetStats();
    this.isRunning = true;

    logger.info('Starting auto-clicker', {
      selector: config.selector,
      count: config.count,
      interval: config.interval,
    });

    const interval = config.interval || 500;
    const count = config.count || 10;
    const timeout = config.timeout || 5000;

    try {
      for (let i = 0; i < count && this.isRunning; i++) {
        try {
          // Wait for selector if needed
          if (config.waitForSelector) {
            await this.page.waitForSelector(config.selector, { timeout });
          }

          // Before hook
          if (config.beforeClick) {
            await config.beforeClick();
          }

          // Click
          const element = await this.page.$(config.selector);
          if (element) {
            await element.click();
            this.stats.successfulClicks++;
            logger.debug(`Click ${i + 1}/${count} successful`);
          } else {
            this.stats.failedClicks++;
            logger.warn(`Element not found for click ${i + 1}`);
          }

          // After hook
          if (config.afterClick) {
            await config.afterClick();
          }

          // Screenshot if needed
          if (config.screenshot) {
            await this.page.screenshot({
              path: `./screenshots/click_${i + 1}.png`,
            });
          }

          this.stats.totalClicks++;

          // Wait before next click
          if (i < count - 1) {
            await this.page.waitForTimeout(interval);
          }
        } catch (error) {
          this.stats.failedClicks++;
          this.stats.totalClicks++;
          const errorMsg = String(error);
          this.stats.errors.push(errorMsg);
          logger.error(`Click ${i + 1} failed`, { error: errorMsg });
        }
      }
    } finally {
      this.isRunning = false;
      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
      logger.info('Auto-clicker finished', this.stats);
    }

    return this.stats;
  }

  /**
   * Click continuously for a duration
   */
  async clickForDuration(config: ClickerConfig): Promise<ClickerStats> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    this.resetStats();
    this.isRunning = true;

    const duration = config.duration || 10000; // default 10 seconds
    const interval = config.interval || 500;
    const timeout = config.timeout || 5000;
    const startTime = Date.now();

    logger.info('Starting continuous auto-clicker', {
      selector: config.selector,
      duration,
      interval,
    });

    try {
      while (Date.now() - startTime < duration && this.isRunning) {
        try {
          if (config.waitForSelector) {
            await this.page.waitForSelector(config.selector, { timeout });
          }

          if (config.beforeClick) {
            await config.beforeClick();
          }

          const element = await this.page.$(config.selector);
          if (element) {
            await element.click();
            this.stats.successfulClicks++;
          } else {
            this.stats.failedClicks++;
          }

          if (config.afterClick) {
            await config.afterClick();
          }

          this.stats.totalClicks++;

          if (config.screenshot) {
            await this.page.screenshot({
              path: `./screenshots/click_${this.stats.totalClicks}.png`,
            });
          }

          await this.page.waitForTimeout(interval);
        } catch (error) {
          this.stats.failedClicks++;
          this.stats.totalClicks++;
          this.stats.errors.push(String(error));
          logger.error('Click failed', { error: String(error) });
        }
      }
    } finally {
      this.isRunning = false;
      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
      logger.info('Continuous auto-clicker finished', this.stats);
    }

    return this.stats;
  }

  /**
   * Smart clicker - click until element disappears or appears
   */
  async smartClick(config: ClickerConfig & { 
    stopCondition?: 'disappear' | 'appear'; 
    checkSelector?: string;
  }): Promise<ClickerStats> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    this.resetStats();
    this.isRunning = true;

    const interval = config.interval || 500;
    const timeout = config.timeout || 5000;
    const stopCondition = config.stopCondition || 'disappear';
    const checkSelector = config.checkSelector || config.selector;

    logger.info('Starting smart auto-clicker', {
      selector: config.selector,
      stopCondition,
      checkSelector,
    });

    try {
      let shouldContinue = true;

      while (shouldContinue && this.isRunning) {
        try {
          // Check stop condition
          const element = await this.page.$(checkSelector);

          if (stopCondition === 'disappear' && !element) {
            logger.info('Stop condition met: element disappeared');
            break;
          }

          if (stopCondition === 'appear' && element) {
            logger.info('Stop condition met: element appeared');
            break;
          }

          if (config.beforeClick) {
            await config.beforeClick();
          }

          const clickElement = await this.page.$(config.selector);
          if (clickElement) {
            await clickElement.click();
            this.stats.successfulClicks++;
            logger.debug('Smart click successful');
          } else {
            this.stats.failedClicks++;
            logger.warn('Click element not found');
          }

          if (config.afterClick) {
            await config.afterClick();
          }

          this.stats.totalClicks++;

          if (config.screenshot) {
            await this.page.screenshot({
              path: `./screenshots/smartclick_${this.stats.totalClicks}.png`,
            });
          }

          await this.page.waitForTimeout(interval);
        } catch (error) {
          this.stats.failedClicks++;
          this.stats.totalClicks++;
          this.stats.errors.push(String(error));
          logger.error('Smart click failed', { error: String(error) });
          shouldContinue = false;
        }
      }
    } finally {
      this.isRunning = false;
      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
      logger.info('Smart auto-clicker finished', this.stats);
    }

    return this.stats;
  }

  /**
   * Rapid fire clicking - as fast as possible
   */
  async rapidFire(config: ClickerConfig): Promise<ClickerStats> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    this.resetStats();
    this.isRunning = true;

    const count = config.count || 50;
    const timeout = config.timeout || 5000;

    logger.info('Starting rapid-fire auto-clicker', {
      selector: config.selector,
      count,
    });

    try {
      for (let i = 0; i < count && this.isRunning; i++) {
        try {
          if (config.waitForSelector) {
            await this.page.waitForSelector(config.selector, { timeout });
          }

          if (config.beforeClick) {
            await config.beforeClick();
          }

          const element = await this.page.$(config.selector);
          if (element) {
            await element.click({ force: true });
            this.stats.successfulClicks++;
          } else {
            this.stats.failedClicks++;
          }

          if (config.afterClick) {
            await config.afterClick();
          }

          this.stats.totalClicks++;

          // Minimal delay
          await this.page.waitForTimeout(50);
        } catch (error) {
          this.stats.failedClicks++;
          this.stats.totalClicks++;
          this.stats.errors.push(String(error));
        }
      }
    } finally {
      this.isRunning = false;
      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
      logger.info('Rapid-fire auto-clicker finished', this.stats);
    }

    return this.stats;
  }

  /**
   * Double click
   */
  async doubleClick(selector: string, times: number = 1): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const element = await this.page.$(selector);
      if (element) {
        for (let i = 0; i < times; i++) {
          await element.dblClick();
        }
        logger.info(`Double-clicked ${selector} ${times} times`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Double click failed', { error: String(error) });
      return false;
    }
  }

  /**
   * Right click (context menu)
   */
  async rightClick(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const element = await this.page.$(selector);
      if (element) {
        await element.click({ button: 'right' });
        logger.info(`Right-clicked ${selector}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Right click failed', { error: String(error) });
      return false;
    }
  }

  /**
   * Middle click
   */
  async middleClick(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const element = await this.page.$(selector);
      if (element) {
        await element.click({ button: 'middle' });
        logger.info(`Middle-clicked ${selector}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Middle click failed', { error: String(error) });
      return false;
    }
  }

  /**
   * Stop the clicker
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Auto-clicker stopped');
  }

  /**
   * Get statistics
   */
  getStats(): ClickerStats {
    return this.stats;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      totalClicks: 0,
      successfulClicks: 0,
      failedClicks: 0,
      startTime: new Date(),
      errors: [],
    };
  }

  /**
   * Check if clicker is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
