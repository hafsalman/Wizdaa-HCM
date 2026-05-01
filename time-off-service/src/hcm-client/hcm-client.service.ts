import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface HcmBalance {
  employeeId: string;
  locationId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
}

export interface HcmSubmitResult {
  transactionId: string;
  status: 'CONFIRMED' | 'PENDING';
}

export interface HcmBatchRecord {
  employeeExternalId: string;
  locationId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
}

@Injectable()
export class HcmClientService {
  private readonly logger = new Logger(HcmClientService.name);
  private readonly client: AxiosInstance;
  private readonly maxRetries: number;

  constructor(private readonly config: ConfigService) {
    const baseURL = this.config.get<string>(
      'HCM_BASE_URL',
      'http://localhost:3001',
    );
    const apiKey = this.config.get<string>('HCM_API_KEY', 'mock-key');
    this.maxRetries = this.config.get<number>('HCM_MAX_RETRIES', 5);

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch real-time balance from HCM.
   */
  async getBalance(
    employeeExternalId: string,
    locationId: string,
    leaveType: string,
  ): Promise<HcmBalance> {
    return this.withRetry(async () => {
      const { data } = await this.client.get<HcmBalance>(
        `/hcm/balances/${employeeExternalId}/${locationId}/${leaveType}`,
      );
      return data;
    }, 'getBalance');
  }

  /**
   * Submit a time-off request to HCM.
   */
  async submitRequest(payload: {
    employeeExternalId: string;
    locationId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    totalDays: number;
  }): Promise<HcmSubmitResult> {
    return this.withRetry(async () => {
      const { data } = await this.client.post<HcmSubmitResult>(
        '/hcm/time-off/submit',
        payload,
      );
      return data;
    }, 'submitRequest');
  }

  /**
   * Cancel a submitted time-off request in HCM.
   */
  async cancelRequest(transactionId: string): Promise<void> {
    return this.withRetry(async () => {
      await this.client.delete(`/hcm/time-off/${transactionId}`);
    }, 'cancelRequest');
  }

  /**
   * Trigger the HCM to send a batch dump to our webhook.
   */
  async triggerBatchSync(webhookUrl: string): Promise<void> {
    return this.withRetry(async () => {
      await this.client.post('/hcm/batch', { webhookUrl });
    }, 'triggerBatchSync');
  }

  /**
   * Retry wrapper with exponential backoff + jitter.
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    operation: string,
    retryCount = 0,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number };
        message?: string;
      };
      const status = axiosError.response?.status;

      // Don't retry client errors (4xx) except 429 (rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }

      if (retryCount >= this.maxRetries) {
        this.logger.error(
          `HCM ${operation} failed after ${this.maxRetries} retries: ${axiosError.message}`,
        );
        throw error;
      }

      const delay = this.calculateBackoff(retryCount);
      this.logger.warn(
        `HCM ${operation} failed (attempt ${retryCount + 1}/${this.maxRetries}), retrying in ${delay}ms`,
      );

      await this.sleep(delay);
      return this.withRetry(fn, operation, retryCount + 1);
    }
  }

  /**
   * Exponential backoff with jitter: (2^retryCount * 1000ms) + random(0-1000)
   */
  calculateBackoff(retryCount: number): number {
    const base = Math.pow(2, retryCount) * 1000;
    const jitter = Math.floor(Math.random() * 1000);
    return base + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
