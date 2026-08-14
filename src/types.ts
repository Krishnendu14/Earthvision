export type LayerType = 
  | 'temperature' 
  | 'pressure' 
  | 'airflow' 
  | 'sealevel' 
  | 'precipitation' 
  | 'uv';

export type GestureType = 
  | 'none' 
  | 'open_palm' 
  | 'closed_fist' 
  | 'thumbs_up' 
  | 'thumbs_down' 
  | 'pointing' 
  | 'peace_layer';

export interface HandGestureData {
  gesture: GestureType;
  confidence: number;
  x: number; // 0 to 1 normalized screen coords
  y: number; // 0 to 1 normalized screen coords
  deltaX: number;
  deltaY: number;
  pinchDistance?: number;
  isTracking: boolean;
  landmarksCount: number;
}

export interface GlobeMetrics {
  lat: number;
  lng: number;
  locationName: string;
  country?: string;
  tempC: number;
  pressureHpa: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  humidity: number;
  cloudCover: number;
  seaLevelElevationM: number;
  seaLevelRiseM: number;
  uvIndex: number;
  airQualityIndex: number; // 1-5 (1=Good, 5=Hazardous)
  summary: string;
}

export interface PresetLocation {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  type: 'coastal' | 'metropolis' | 'extreme' | 'eco';
  tempC: number;
  pressureHpa: number;
  windSpeedKmh: number;
  seaLevelElevationM: number;
  description: string;
}

export interface WindParticle {
  x: number;
  y: number;
  z: number;
  lat: number;
  lng: number;
  speed: number;
  life: number;
  maxLife: number;
}
