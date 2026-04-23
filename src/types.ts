export type CountryCode = "CANADA" | "LATAM" | "USA";
export type BrandCode = "BMW" | "MINI" | "MOTORRAD";

export type DashboardTag = "Marketing" | "Sales" | "Media" | "KPI" | "Executive" | string;

export interface DashboardRecord {
  id: string;                 // uuid
  country: CountryCode;
  brand: BrandCode;
  title: string;
  description: string;
  url: string;                // absolute https URL only
  tags: DashboardTag[];
  isFeatured?: boolean;
  sortOrder?: number;
  imageKey?: string;          // optional card thumbnail key
}

export interface HubConfigV1 {
  schemaVersion: 1;
  updatedAt: string;          // ISO datetime
  dashboards: DashboardRecord[];
}
