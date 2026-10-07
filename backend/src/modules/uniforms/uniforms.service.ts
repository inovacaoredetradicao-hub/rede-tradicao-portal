import { UniformsRepository } from './uniforms.repository.js';
import { CreateUniformItemInput, EntradaInput, GenerateTagsInput, SaidaInput, UniformTagFilters } from './uniforms.types.js';

export class UniformsService {
  constructor(private readonly repository: UniformsRepository) {}

  listItems() {
    return this.repository.listItems();
  }

  createItem(input: CreateUniformItemInput) {
    if (!input.name?.trim() || !input.size?.trim()) {
      throw new Error('Informe o nome e o tamanho do uniforme.');
    }
    return this.repository.createItem(input);
  }

  generateTags(input: GenerateTagsInput) {
    if (!input.quantity || input.quantity < 1 || input.quantity > 500) {
      throw new Error('Informe uma quantidade de etiquetas entre 1 e 500.');
    }
    return this.repository.generateTags(input);
  }

  listTags(filters: UniformTagFilters) {
    return this.repository.listTags(filters);
  }

  async getTagById(tagId: string) {
    const tag = await this.repository.getTagById(tagId);
    if (!tag) {
      throw new Error('Etiqueta nao encontrada.');
    }
    return tag;
  }

  registerEntrada(tagId: string, input: EntradaInput) {
    if (!input.uniformItemId || !input.unitId) {
      throw new Error('Selecione o modelo de uniforme e a unidade.');
    }
    if (!input.quantity || input.quantity < 1) {
      throw new Error('Informe uma quantidade valida.');
    }
    return this.repository.registerEntrada(tagId, input);
  }

  registerSaida(tagId: string, input: SaidaInput) {
    if (!input.destinationUnitId) {
      throw new Error('Selecione a unidade de destino.');
    }
    if (!input.quantity || input.quantity < 1) {
      throw new Error('Informe uma quantidade valida.');
    }
    return this.repository.registerSaida(tagId, input);
  }

  getStock(unitId?: string) {
    return this.repository.getStock(unitId);
  }

  getStockByUnit() {
    return this.repository.getStockByUnit();
  }
}
