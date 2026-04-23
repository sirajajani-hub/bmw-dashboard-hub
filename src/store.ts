import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CountryCode, BrandCode, HubConfigV1, DashboardRecord } from './types';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  country: CountryCode | null;
  brand: BrandCode | null;
  setCountry: (country: CountryCode) => void;
  setBrand: (brand: BrandCode) => void;
  resetSelection: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      country: null,
      brand: null,
      setCountry: (country) => set({ country }), // Don't reset brand
      setBrand: (brand) => set({ brand }),
      resetSelection: () => set({ country: null, brand: null }),
    }),
    {
      name: 'bmwHub.ui.v1',
    }
  )
);

const defaultDashboards: DashboardRecord[] = [
  {
    id: uuidv4(),
    country: "USA",
    brand: "BMW",
    title: "Cross-Tier: Media Performance Dashboard",
    description: "High-level view of media performance across all channels and tiers.",
    url: "https://us-west-2b.online.tableau.com/#/site/criticalmass/views/BMWUSA-Cross-Tier-MediaPerformanceDashboard/MediaPerformance?:iid=1",
    tags: ["Media"],
    isFeatured: true,
  },
  {
    id: uuidv4(),
    country: "USA",
    brand: "BMW",
    title: "Marketing Campaign ROI",
    description: "A media performance view into Tier 2 markets.",
    url: "https://us-west-2b.online.tableau.com/#/site/criticalmass/views/BMWUSA-MarketingCampaignROI/MarketingCampaignROI?:iid=1",
    tags: ["Media"],
  },
  {
    id: uuidv4(),
    country: "USA",
    brand: "BMW",
    title: "Creative Intelligence Dashboard",
    description: "Metrics for individual dealer performance in the Canadian market.",
    url: "https://us-west-2b.online.tableau.com/#/site/criticalmass/views/BMWUSA-CreativeIntelligenceDashboard/CreativeIntelligenceDashboard?:iid=1",
    tags: ["Media"],
  },
  {
    id: uuidv4(),
    country: "USA",
    brand: "BMW",
    title: "Business Monitoring Dashboard",
    description: "A view into website traffic and activity for the US market.",
    url: "https://us-west-2b.online.tableau.com/t/criticalmass/views/EXTBMW_USA_Site_BusinessMonitoringDashboard_17654698375910/BusinessMonitoringWeekly?:origin=card_share_link&:embed=n",
    tags: ["Digital"],
  }
];
const defaultConfig: HubConfigV1 = {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  dashboards: defaultDashboards,
};

interface ConfigState {
  config: HubConfigV1;
  setConfig: (config: HubConfigV1) => void;
  addDashboard: (dashboard: Omit<DashboardRecord, 'id'>) => void;
  updateDashboard: (id: string, dashboard: Partial<DashboardRecord>) => void;
  deleteDashboard: (id: string) => void;
  resetToDefault: () => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      setConfig: (config) => set({ config }),
      addDashboard: (dashboard) => set((state) => ({
        config: {
          ...state.config,
          updatedAt: new Date().toISOString(),
          dashboards: [...state.config.dashboards, { ...dashboard, id: uuidv4() }]
        }
      })),
      updateDashboard: (id, dashboardUpdate) => set((state) => ({
        config: {
          ...state.config,
          updatedAt: new Date().toISOString(),
          dashboards: state.config.dashboards.map(d => d.id === id ? { ...d, ...dashboardUpdate } : d)
        }
      })),
      deleteDashboard: (id) => set((state) => ({
        config: {
          ...state.config,
          updatedAt: new Date().toISOString(),
          dashboards: state.config.dashboards.filter(d => d.id !== id)
        }
      })),
      resetToDefault: () => set({ config: defaultConfig }),
    }),
    {
      name: 'bmwHub.config.v1',
    }
  )
);
