// src/shared/types/types.ts
import React from 'react'; // Add React import for React.ReactNode types

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

export interface ConfigurationCardProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: string;
  status: 'configured' | 'not_configured';
  detailsComponent?: React.ReactNode; // Optional component for detailed view
}

export enum ConfigStatus {
  Configured = 'configured',
  NotConfigured = 'not_configured',
}

// Global types for Electron preload APIs
type ImageResolutionOption = 'default';

declare global {
  interface Window {
    zeoAPI?: {
      startPromptBatch: (args: any) => Promise<any>;
      startVideoBatch?: (args: any) => Promise<any>;
      startPromptImageWorkflow?: (args: any & { imageResolution?: ImageResolutionOption }) => Promise<any>;
      startSceneWorkflow?: (args: any) => Promise<any>;
      startAffiliateVideoWorkflow?: (args: any) => Promise<any>;
      generateStorySceneImages?: (args: any & { imageResolution?: ImageResolutionOption }) => Promise<any>;
      editStoryFrame?: (args: any & { imageResolution?: ImageResolutionOption }) => Promise<any>;
      testBearerToken?: (args: { bearerToken: string }) => Promise<{ ok: boolean; status?: number; error?: string }>;
      testApiKey?: (args: { apiKey: string; provider?: string; model?: string }) => Promise<{ ok: boolean; status?: number; error?: string }>;
      generateSingleImage?: (args: any & { imageResolution?: ImageResolutionOption }) => Promise<{
        ok: boolean;
        filePath?: string;
        fileName?: string;
        dataUrl?: string;
        prompt?: string;
        error?: string;
        modelUsed?: string;
      }>;
      selectFolder?: (args?: { defaultPath?: string; title?: string }) => Promise<{ canceled: boolean; path?: string }>;
      getImageFiles?: (args: { folderPath: string }) => Promise<{ ok: boolean; files?: string[]; error?: string }>;
      onBatchUpdate?: (callback: (update: any) => void) => () => void;
      analyzeCharacterImage?: (args: any) => Promise<any>;
      generateScenePrompt?: (args: any) => Promise<{ ok: boolean; prompt?: string; error?: string }>;
      generateSingleVideo?: (args: any) => Promise<{
        ok: boolean;
        filePath?: string;
        fileName?: string;
        prompt?: string;
        error?: string;
      }>;
      generateAffiliateImages?: (args: any & { imageResolution?: ImageResolutionOption }) => Promise<{ ok: boolean; results?: any[]; error?: string }>;
      licenseCheck?: (args: { email: string }) => Promise<{ ok: boolean; code?: string; message: string }>;
      getLicenseInfo?: (args: { email: string }) => Promise<{ ok: boolean; code?: string; message: string; license?: any }>;
      clearLicenseMachine?: (args: { email: string }) => Promise<{ ok: boolean; code?: string; message: string }>;
      openOAuthWindow: (url: string) => Promise<string | null>;
      getNavLabel: (navId: string) => string;
    };
  }
}

export enum LogType {
  System = 'SYSTEM',
  Logs = 'LOGS',
  Navigation = 'NAVIGATION',
}

export enum LogLevel {
  Info = 'INFO',
  Success = 'SUCCESS',
  Warning = 'WARNING',
  Error = 'ERROR',
}

export enum LogStatus {
  Success = 'success',
  Error = 'error',
  Pending = 'pending',
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: LogType;
  level: LogLevel;
  message: string;
  status: LogStatus;
}
