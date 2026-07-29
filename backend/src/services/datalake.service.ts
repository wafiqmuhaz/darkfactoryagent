import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Mount point for the data lake volume
const DATALAKE_DIR = process.env.DATALAKE_DIR || path.join(process.cwd(), 'datalake');

export interface TelemetryEvent {
  eventType: 'agent_run' | 'api_request' | 'error' | 'token_usage';
  timestamp: string;
  data: any;
}

class DataLakeService {
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATALAKE_DIR)) {
        fs.mkdirSync(DATALAKE_DIR, { recursive: true });
      }
      this.isInitialized = true;
      logger.info(`DataLakeService initialized at ${DATALAKE_DIR}`);
    } catch (error) {
      logger.error('Failed to initialize DataLake directory', error);
    }
  }

  /**
   * Appends an event to the daily JSONL file
   */
  public logEvent(event: TelemetryEvent) {
    if (!this.isInitialized) return;

    try {
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filePath = path.join(DATALAKE_DIR, `telemetry-${dateStr}.jsonl`);
      
      const line = JSON.stringify(event) + '\n';
      
      // Fire and forget asynchronous append
      fs.appendFile(filePath, line, (err) => {
        if (err) {
          logger.error(`Failed to write to datalake: ${filePath}`, err);
        }
      });
    } catch (error) {
      logger.error('DataLake logging error', error);
    }
  }
}

export const dataLakeService = new DataLakeService();
