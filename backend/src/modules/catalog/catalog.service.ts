import { CatalogRepository } from './catalog.repository.js';

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async listProducts() {
    return this.repository.listProducts();
  }

  async listUnits() {
    return this.repository.listUnits();
  }
}
