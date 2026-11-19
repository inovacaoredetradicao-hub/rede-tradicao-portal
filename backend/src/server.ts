import { createApp } from './app.js';
import { env } from './config/env.js';
import { OperationalAlertsScheduler } from './modules/operational-alerts/operationalAlerts.scheduler.js';
import { OperationalAlertsRepository } from './modules/operational-alerts/operationalAlerts.repository.js';
import { ensureShipmentTables } from './modules/uniforms/uniformShipments.js';
import { query } from './lib/db.js';

const { app, service } = createApp();
const scheduler = new OperationalAlertsScheduler(service);

await new OperationalAlertsRepository().ensureCancelledStatus();
await new OperationalAlertsRepository().ensureGroupLabelColumn();
await ensureShipmentTables();
// CNPJ da filial (preenchido pela sincronizacao com a Argo). So acrescenta a coluna.
await query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS cnpj VARCHAR(14) NULL`);

app.listen(env.PORT, env.HOST, () => {
  const displayHost = env.HOST === '0.0.0.0' ? 'localhost' : env.HOST;
  console.log(`[backend] ouvindo em http://${displayHost}:${env.PORT}`);
  scheduler.start();
});
