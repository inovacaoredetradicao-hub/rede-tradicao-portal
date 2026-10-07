import { env } from '../../config/env.js';
import { OperationalAlertsService } from './operationalAlerts.service.js';

export class OperationalAlertsScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly service: OperationalAlertsService) {}

  start() {
    if (!env.SCHEDULER_ENABLED || this.timer) {
      return;
    }

    const runCycle = async () => {
      try {
        await this.service.generateScheduledAlerts();
        await this.service.expireOverdueAlerts();
      } catch (error) {
        console.error('[scheduler] Falha ao processar disparos operacionais:', error);
      }
    };

    void runCycle();
    this.timer = setInterval(() => {
      void runCycle();
    }, env.SCHEDULER_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
