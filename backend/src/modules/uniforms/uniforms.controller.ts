import { Request, Response } from 'express';
import { UniformsService } from './uniforms.service.js';
import { CreateUniformItemInput, EntradaInput, GenerateTagsInput, SaidaInput } from './uniforms.types.js';

export class UniformsController {
  constructor(private readonly service: UniformsService) {}

  listItems = async (_request: Request, response: Response) => {
    response.json(await this.service.listItems());
  };

  createItem = async (request: Request, response: Response) => {
    const payload = request.body as CreateUniformItemInput;
    response.status(201).json(await this.service.createItem(payload));
  };

  generateTags = async (request: Request, response: Response) => {
    const payload = request.body as GenerateTagsInput;
    response.status(201).json(await this.service.generateTags(payload));
  };

  listTags = async (request: Request, response: Response) => {
    const { status, unitId, batchLabel } = request.query as Record<string, string | undefined>;
    response.json(
      await this.service.listTags({
        status: status as 'livre' | 'em_uso' | undefined,
        unitId,
        batchLabel,
      }),
    );
  };

  getTagById = async (request: Request, response: Response) => {
    response.json(await this.service.getTagById(String(request.params.id)));
  };

  registerEntrada = async (request: Request, response: Response) => {
    const payload = request.body as EntradaInput;
    response.json(await this.service.registerEntrada(String(request.params.id), payload));
  };

  registerSaida = async (request: Request, response: Response) => {
    const payload = request.body as SaidaInput;
    response.json(await this.service.registerSaida(String(request.params.id), payload));
  };

  getStock = async (request: Request, response: Response) => {
    const { unitId } = request.query as Record<string, string | undefined>;
    response.json(await this.service.getStock(unitId));
  };

  getStockByUnit = async (_request: Request, response: Response) => {
    response.json(await this.service.getStockByUnit());
  };
}
