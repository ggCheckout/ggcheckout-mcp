import type { ProductPort } from '../ports/product.port.js';
import type { Product } from '../types/product.js';
import { validateCreateProductInput, validateUpdateProductInput } from '../../shared/validation.js';

export class ProductService {
  constructor(private readonly productPort: ProductPort) {}

  async list(): Promise<Product[]> {
    return this.productPort.list();
  }

  async getById(id: string): Promise<Product> {
    return this.productPort.getById(id);
  }

  async create(input: any): Promise<Product> {
    const validated = validateCreateProductInput(input);
    return this.productPort.create(validated);
  }

  async update(id: string, input: any): Promise<Product> {
    const validated = validateUpdateProductInput(input);
    return this.productPort.update(id, validated);
  }

  async delete(id: string): Promise<void> {
    return this.productPort.delete(id);
  }
}
