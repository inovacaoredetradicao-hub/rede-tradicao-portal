import { Request, Response } from 'express';
import { CatalogService } from './catalog.service.js';

export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  listProducts = async (_request: Request, response: Response) => {
    const products = await this.service.listProducts();
    response.json(products);
  };

  listUnits = async (_request: Request, response: Response) => {
    const units = await this.service.listUnits();
    response.json(units);
  };
}
