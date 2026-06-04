import apiClient from './client';
import type { ApiResponse } from '../types';

export interface MetaIntegrationSettings {
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  appId: string;
  appSecret: string;
  pageAccessToken: string;
  verifyToken: string;
  autoAssignStaffId: number | null;
  allowedFormIds: string;
}

export interface ValidationResult {
  webhookVerified: boolean;
  pageConnected: boolean;
  leadSyncEnabled: boolean;
  error?: string;
  data?: {
    pageId: string;
    pageName: string;
    permissions: {
      leads_retrieval: boolean;
      pages_read_engagement: boolean;
    };
    appSubscribed: boolean;
  };
}

export interface TestDiagnosticsResult {
  tokenValid: boolean;
  pageConnected: boolean;
  permissions: Record<string, boolean>;
  appSubscribed: boolean;
  logs: string[];
}

export const integrationsAPI = {
  getMetaSettings: async (): Promise<ApiResponse<MetaIntegrationSettings>> => {
    const { data } = await apiClient.get('/integrations/meta/settings');
    return data;
  },

  updateMetaSettings: async (settings: Partial<MetaIntegrationSettings>): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.patch('/integrations/meta/settings', settings);
    return data;
  },

  validateMetaConnection: async (): Promise<ApiResponse<ValidationResult>> => {
    const { data } = await apiClient.post('/integrations/meta/validate');
    return data;
  },

  runMetaTest: async (): Promise<ApiResponse<TestDiagnosticsResult>> => {
    const { data } = await apiClient.post('/integrations/meta/test');
    return data;
  }
};
export default integrationsAPI;
