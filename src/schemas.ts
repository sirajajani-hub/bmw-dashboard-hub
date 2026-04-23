import { z } from 'zod';

export const CountryCodeSchema = z.enum(["CANADA", "LATAM", "USA"]);
export const BrandCodeSchema = z.enum(["BMW", "MINI", "MOTORRAD"]);

export const DashboardRecordSchema = z.object({
  id: z.string().uuid(),
  country: CountryCodeSchema,
  brand: BrandCodeSchema,
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  url: z.string().url().regex(/^https:\/\//, "URL must start with https://"),
  tags: z.array(z.string()),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().optional(),
  imageKey: z.string().optional(),
});

export const HubConfigV1Schema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string().datetime(),
  dashboards: z.array(DashboardRecordSchema),
});
