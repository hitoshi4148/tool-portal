export interface PortalAdvisorSettings {
  facilityName?: string;
  lat?: string;
  lon?: string;
  locationType?: string;
  greenType?: string;
  overseed?: string;
  warmGrass?: string;
  coolGrass?: string;
  responseMode?: string;
}

export interface ChatRequestBody {
  message: string;
  settings: PortalAdvisorSettings;
}
