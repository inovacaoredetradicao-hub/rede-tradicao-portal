import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { OperationalAlertsController } from './operationalAlerts.controller.js';

export function createOperationalAlertsRouter(controller: OperationalAlertsController) {
  const router = Router();

  router.get('/health', asyncHandler(controller.health));

  router.post('/rules', asyncHandler(controller.createRule));
  router.post('/rules/batch', asyncHandler(controller.createRulesBatch));
  router.post('/rules/dispatch', asyncHandler(controller.dispatchRules));
  router.get('/rules', asyncHandler(controller.listRules));
  router.get('/rules/:id', asyncHandler(controller.getRuleById));
  router.patch('/rules/batch', asyncHandler(controller.updateRulesBatch));
  router.delete('/rules/batch', asyncHandler(controller.deleteRulesBatch));
  router.patch('/rules/:id', asyncHandler(controller.updateRule));
  router.patch('/rules/:id/toggle', asyncHandler(controller.toggleRule));
  router.delete('/rules/:id', asyncHandler(controller.deleteRule));

  router.get('/alerts', asyncHandler(controller.listAlerts));
  router.get('/results', asyncHandler(controller.listAuditResults));
  router.get('/results/:id', asyncHandler(controller.getAuditResultById));
  router.delete('/results/:id', asyncHandler(controller.deleteAuditResult));
  router.get('/alerts/pending', asyncHandler(controller.listPendingAlerts));
  router.post('/alerts/:id/start', asyncHandler(controller.startAlert));
  router.post('/alerts/:id/complete', asyncHandler(controller.completeAlert));
  router.post('/alerts/:id/expire', asyncHandler(controller.expireAlert));
  router.post('/alerts/:id/cancel', asyncHandler(controller.cancelAlert));

  router.post('/scheduler/run', asyncHandler(controller.runScheduler));
  router.get('/dashboard-summary', asyncHandler(controller.getDashboardSummary));

  // Alias específico para o app mobile / painel de avisos.
  router.get('/mobile/pending', asyncHandler(controller.listMobileAlerts));

  return router;
}
