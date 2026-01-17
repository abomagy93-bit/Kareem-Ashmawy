
export interface VerseSegment {
  arabic: string;
  translation: string;
  surah: string;
  ayah: number | string;
}

export interface VerseResponse {
  segments: VerseSegment[];
}

export enum BackgroundType {
  SKY = 'SKY',
  NATURE = 'NATURE',
  JANNAT = 'JANNAT', // Gardens
}

export interface CardConfig {
  verse: VerseSegment; 
  backgroundType: BackgroundType;
  customImage?: string;
  fontSize: number;
  showTranslation: boolean;
  opacity: number;
  textColor: string;
}

export interface DesignConfig {
  backgroundType: BackgroundType;
  textColor: 'white' | 'black';
  opacity: number;
}

export interface CombinedResponse {
  segments: VerseSegment[];
  design: DesignConfig;
}

export interface GenerationRequest {
  topic: string;
}