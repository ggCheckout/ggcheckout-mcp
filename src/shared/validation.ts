import { z } from 'zod';
import { ValidationError } from './errors.js';

export function parsePriceToCents(input: number | string): number {
  if (typeof input === 'number') {
    if (input < 0) {
      throw new ValidationError('Price must be a non-negative number');
    }
    return Math.round(input * 100);
  }

  if (typeof input === 'string') {
    const clean = input.replace(/\./g, '').replace(',', '.');
    const value = Number.parseFloat(clean);
    if (Number.isNaN(value) || value < 0) {
      throw new ValidationError('Invalid price format');
    }
    return Math.round(value * 100);
  }

  throw new ValidationError('Price must be a number or string');
}

const createProductSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.union([z.number(), z.string()]),
  currency: z.enum(['BRL', 'USD']).optional(),
  url: z.string().url('Invalid URL format').optional(),
  imageUrl: z.string().url('Invalid image URL').or(z.literal('')).optional(),
  discount: z.number().optional(),
  deliveryMethod: z.enum(['url', 'whatsapp', 'both']).optional(),
  isPhysicalProduct: z.boolean().optional(),
}).passthrough();

const updateProductSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.union([z.number(), z.string()]).optional(),
  currency: z.enum(['BRL', 'USD']).optional(),
  url: z.string().url().optional(),
  imageUrl: z.string().url().or(z.literal('')).optional(),
  discount: z.number().optional(),
  deliveryMethod: z.enum(['url', 'whatsapp', 'both']).optional(),
  isPhysicalProduct: z.boolean().optional(),
}).passthrough();

export function validateCreateProductInput(input: any) {
  const validated = createProductSchema.parse(input);
  return {
    ...validated,
    price: parsePriceToCents(validated.price),
  };
}

export function validateUpdateProductInput(input: any) {
  const validated = updateProductSchema.parse(input);
  const result: any = { ...validated };

  if (validated.price !== undefined) {
    result.price = parsePriceToCents(validated.price);
  }

  return result;
}
