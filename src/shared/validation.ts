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
    const trimmed = input.trim();
    if (trimmed === '') {
      throw new ValidationError('Invalid price format');
    }

    let value: number;

    // Brazilian format: "1.990,50" or "19,90" (comma as decimal separator)
    if (trimmed.includes(',')) {
      const clean = trimmed.replace(/\./g, '').replace(',', '.');
      value = Number.parseFloat(clean);
    } else {
      // US/numeric format: "19.90" or "1990"
      value = Number.parseFloat(trimmed);
    }

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
  stockEnabled: z.boolean().optional(),
  unlimitedStock: z.boolean().optional(),
  stockQuantity: z.number().min(0).optional(),
  membersAreaEnabled: z.boolean().optional(),
  deliverableType: z.enum(['url', 'file', 'text']).optional(),
  deliverableUrl: z.string().url().optional(),
  skipDeliveryEmail: z.boolean().optional(),
});

const updateProductSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.union([z.number(), z.string()]).optional(),
  currency: z.enum(['BRL', 'USD']).optional(),
  url: z.string().url().optional(),
  imageUrl: z.string().url().or(z.literal('')).optional(),
  discount: z.number().min(0).max(100).optional(),
  deliveryMethod: z.enum(['url', 'whatsapp', 'both']).optional(),
  isPhysicalProduct: z.boolean().optional(),
  stockEnabled: z.boolean().optional(),
  unlimitedStock: z.boolean().optional(),
  stockQuantity: z.number().min(0).optional(),
  membersAreaEnabled: z.boolean().optional(),
  deliverableType: z.enum(['url', 'file', 'text']).optional(),
  deliverableUrl: z.string().url().optional(),
  skipDeliveryEmail: z.boolean().optional(),
});

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
