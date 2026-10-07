import { Request, Response } from 'express';
import { z } from 'zod';
import { OperationalAlertsService } from './operationalAlerts.service.js';
import { completeAlertSchema, createRuleSchema, updateRuleSchema } from './operationalAlerts.schemas.js';
import { CompleteAlertInput, CreateRuleInput, UpdateRuleInput } from './operationalAlerts.types.js';

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export class OperationalAlertsController {
  constructor(private readonly service: OperationalAlertsService) {}

  health = async (_request: Request, response: Response) => {
    response.json({ ok: true, module: 'operational-alerts' });
  };

  listRules = async (request: Request, response: Response) => {
    const rules = await this.service.listRules({
      unitId: firstQueryValue(request.query.unitId as string | string[] | undefined),
      productId: firstQueryValue(request.query.productId as string | string[] | undefined),
      responsibleUserId: firstQueryValue(request.query.responsibleUserId as string | string[] | undefined),
      isActive: request.query.isActive ? request.query.isActive === 'true' : undefined,
    });

    response.json(rules);
  };

  getRuleById = async (request: Request, response: Response) => {
    const rule = await this.service.getRuleById(String(request.params.id));
    response.json(rule);
  };

  createRule = async (request: Request, response: Response) => {
    const payload = createRuleSchema.parse(request.body) as CreateRuleInput;
    const rule = await this.service.createRule(payload);
    response.status(201).json(rule);
  };

  updateRule = async (request: Request, response: Response) => {
    const payload = updateRuleSchema.parse(request.body) as UpdateRuleInput;
    const rule = await this.service.updateRule(String(request.params.id), payload);
    response.json(rule);
  };

  deleteRule = async (request: Request, response: Response) => {
    const rule = await this.service.deleteRule(String(request.params.id));
    response.json(rule);
  };

  toggleRule = async (request: Request, response: Response) => {
    const rule = await this.service.toggleRule(String(request.params.id));
    response.json(rule);
  };

  listAlerts = async (request: Request, response: Response) => {
    const alerts = await this.service.listAlerts({
      status: request.query.status as any,
      unitId: firstQueryValue(request.query.unitId as string | string[] | undefined),
      productId: firstQueryValue(request.query.productId as string | string[] | undefined),
      responsibleUserId: firstQueryValue(request.query.responsibleUserId as string | string[] | undefined),
    });

    response.json(alerts);
  };

  listAuditResults = async (request: Request, response: Response) => {
    const results = await this.service.listAuditResults({
      unitId: firstQueryValue(request.query.unitId as string | string[] | undefined),
      sellerName: firstQueryValue(request.query.sellerName as string | string[] | undefined),
      resultStatus: firstQueryValue(request.query.resultStatus as string | string[] | undefined) as 'OK' | 'Divergente' | undefined,
      productSearch: firstQueryValue(request.query.productSearch as string | string[] | undefined),
      dateFrom: firstQueryValue(request.query.dateFrom as string | string[] | undefined),
      dateTo: firstQueryValue(request.query.dateTo as string | string[] | undefined),
    });

    response.json(results);
  };

  getAuditResultById = async (request: Request, response: Response) => {
    const result = await this.service.getAuditResultById(String(request.params.id));
    response.json(result);
  };

  deleteAuditResult = async (request: Request, response: Response) => {
    const result = await this.service.deleteAuditResult(String(request.params.id));
    response.json(result);
  };

  listPendingAlerts = async (request: Request, response: Response) => {
    const alerts = await this.service.listPendingAlerts({
      unitId: firstQueryValue(request.query.unitId as string | string[] | undefined),
      productId: firstQueryValue(request.query.productId as string | string[] | undefined),
      responsibleUserId: firstQueryValue(request.query.responsibleUserId as string | string[] | undefined),
    });

    response.json(alerts);
  };

  getDashboardSummary = async (_request: Request, response: Response) => {
    const summary = await this.service.getDashboardSummary();
    response.json(summary);
  };

  runScheduler = async (request: Request, response: Response) => {
    const bodySchema = z
      .object({
        referenceDate: z.string().datetime().optional(),
      })
      .optional();

    const body = bodySchema.parse(request.body ?? {});
    const referenceDate = body?.referenceDate ? new Date(body.referenceDate) : new Date();

    const created = await this.service.generateScheduledAlerts(referenceDate);
    const expired = await this.service.expireOverdueAlerts();
    response.json({
      createdCount: created.length,
      expiredCount: expired.length,
    });
  };

  listMobileAlerts = async (request: Request, response: Response) => {
    const querySchema = z.object({
      userId: z.string().optional(),
      unitId: z.string().optional(),
    });
    const query = querySchema.parse(request.query);
    const alerts = await this.service.listMobileAlerts(query);
    response.json(alerts);
  };

  startAlert = async (request: Request, response: Response) => {
    const alert = await this.service.startAlert(String(request.params.id));
    response.json(alert);
  };

  completeAlert = async (request: Request, response: Response) => {
    const payload = completeAlertSchema.parse(request.body) as CompleteAlertInput;
    const alert = await this.service.completeAlert(String(request.params.id), payload);
    response.json(alert);
  };

  expireAlert = async (request: Request, response: Response) => {
    const alert = await this.service.expireAlert(String(request.params.id));
    response.json(alert);
  };
}
