import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { UniformsController } from './uniforms.controller.js';

export function createUniformsRouter(controller: UniformsController) {
  const router = Router();

  router.get('/items', asyncHandler(controller.listItems));
  router.post('/items', asyncHandler(controller.createItem));

  router.post('/tags/generate', asyncHandler(controller.generateTags));
  router.get('/tags', asyncHandler(controller.listTags));
  router.get('/tags/:id', asyncHandler(controller.getTagById));
  router.post('/tags/:id/entrada', asyncHandler(controller.registerEntrada));
  router.post('/tags/:id/saida', asyncHandler(controller.registerSaida));

  router.get('/stock', asyncHandler(controller.getStock));
  router.get('/stock/by-unit', asyncHandler(controller.getStockByUnit));

  return router;
}
