import { z } from 'zod';

export const Author = z.object({
  name: z.string(),
  email: z.string().email(),
});

export type Author = z.infer<typeof Author>;

const statusEnum = z.enum(['published', 'draft', 'archived']);

export const CatalogItem = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().max(160),
  authors: z.array(Author),
  tags: z.array(z.string()),
  image: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: statusEnum,
  featured: z.coerce.boolean().default(false),
});

export type CatalogItem = z.infer<typeof CatalogItem>;

export const Query = z.object({
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: statusEnum.optional(),
  featured: z.boolean().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export type Query = z.infer<typeof Query>;

export type QueryResult = {
  items: CatalogItem[];
  total: number;
};
