import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { env } from './config/env.js';
import { CatalogController } from './modules/catalog/catalog.controller.js';
import { CatalogRepository } from './modules/catalog/catalog.repository.js';
import { createCatalogRouter } from './modules/catalog/catalog.routes.js';
import { CatalogService } from './modules/catalog/catalog.service.js';
import { OperationalAlertsRepository } from './modules/operational-alerts/operationalAlerts.repository.js';
import { OperationalAlertsService } from './modules/operational-alerts/operationalAlerts.service.js';
import { OperationalAlertsController } from './modules/operational-alerts/operationalAlerts.controller.js';
import { createOperationalAlertsRouter } from './modules/operational-alerts/operationalAlerts.routes.js';
import { UniformsRepository } from './modules/uniforms/uniforms.repository.js';
import { UniformsService } from './modules/uniforms/uniforms.service.js';
import { UniformsController } from './modules/uniforms/uniforms.controller.js';
import { createUniformsRouter } from './modules/uniforms/uniforms.routes.js';

export function createApp() {
  const app = express();
  const allowedOrigins = new Set([env.PORTAL_FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4001']);
  // A maquina de desenvolvimento costuma ter mais de uma rede ativa (Wi-Fi, Ethernet, VPN),
  // e o IP "correto" muda toda vez que a rede muda. Em vez de manter uma lista fixa de
  // IPs (que quebra a cada troca de rede), aceitamos qualquer origem de IP privado de LAN.
  const isPrivateLanOrigin = (origin: string) => {
    try {
      const { hostname } = new URL(origin);
      return (
        hostname === 'localhost' ||
        /^127\./.test(hostname) ||
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
      );
    } catch {
      return false;
    }
  };

  const catalogRepository = new CatalogRepository();
  const catalogService = new CatalogService(catalogRepository);
  const catalogController = new CatalogController(catalogService);

  const repository = new OperationalAlertsRepository();
  const service = new OperationalAlertsService(repository);
  const controller = new OperationalAlertsController(service);

  const uniformsRepository = new UniformsRepository();
  const uniformsService = new UniformsService(uniformsRepository);
  const uniformsController = new UniformsController(uniformsService);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin) || isPrivateLanOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origem nao permitida por CORS: ${origin}`));
      },
    }),
  );
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.json({ ok: true, service: 'portal-rede-tradicao-backend' });
  });

  app.use(createCatalogRouter(catalogController));
  app.use('/operational-alerts', createOperationalAlertsRouter(controller));
  app.use('/operative-alerts', createOperationalAlertsRouter(controller));
  app.use('/uniforms', createUniformsRouter(uniformsController));

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    console.error('[backend] erro não tratado:', error);

    const message = error instanceof Error ? error.message : 'Erro interno do servidor.';
    response.status(500).json({ message });
  });

  return { app, service };
}
