/** Resolved Reck configuration (non-secrets may come from file; secrets are env-only). */
export type ReelinkConfig = {
  homeDir: string;
  configPath: string;
  defaultFpsSample: number;
  copyImportedVideos: boolean;
  openRouterApiKey?: string;
  lmStudioBaseUrl?: string;
  openRouterModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  queryGptFallbackEnabled?: boolean;
};

export type DiagnosticStatus = "pass" | "warn" | "fail" | "skipped" | "not_configured";

export type ConfigPrecedenceSource = "environment" | "dotenv" | "user_config" | "default";

export type ConfigPrecedenceRule = {
  setting: keyof ReelinkConfig;
  sources: readonly ConfigPrecedenceSource[];
};

export type DoctorDiagnostic = {
  id: string;
  label: string;
  status: DiagnosticStatus;
  /** Human-readable; must not contain secret values */
  detail: string;
};

/** Overrides for deterministic diagnostics tests */
export type DoctorRuntime = {
  nodeVersion?: string;
  bunVersion?: string | null;
  configFileExists?: boolean;
  packageResolution?: string | null;
  playwrightChromiumInstalled?: boolean | null;
  reactGrabResolvable?: boolean | null;
  reactGrabInitialized?: boolean | null;
  reactGrabVerified?: boolean | null;
  codexConfigStatus?: "configured" | "missing" | "unknown";
};
