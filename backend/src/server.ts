import { createApp } from './app.js';
import { env } from './config/env.js';
import { OperationalAlertsScheduler } from './modules/operational-alerts/operationalAlerts.scheduler.js';
import { OperationalAlertsRepository } from './modules/operational-alerts/operationalAlerts.repository.js';

const { app, service } = createApp();
const scheduler = new OperationalAlertsScheduler(service);

await new OperationalAlertsRepository().ensureCancelledStatus();

app.listen(env.PORT, env.HOST, () => {
  const displayHost = env.HOST === '0.0.0.0' ? 'localhost' : env.HOST;
  console.log(`[backend] ouvindo em http://${displayHost}:${env.PORT}`);
  scheduler.start();
});
