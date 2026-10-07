import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { CatalogController } from './catalog.controller.js';

export function createCatalogRouter(controller: CatalogController) {
  const router = Router();

  router.get('/products', asyncHandler(controller.listProducts));
  router.get('/units', asyncHandler(controller.listUnits));

  return router;
}
