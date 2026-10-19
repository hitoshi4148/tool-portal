export type CropCategory = "turf" | "fruit" | "other";

export type CropKey =
  | "shiba"
  | "mikan"
  | "ringo"
  | "nashi"
  | "kaki"
  | "budo"
  | "other_fruit"
  | "other";

export interface CropPreset {
  key: CropKey;
  category: CropCategory;
  label: string;
  sortOrder: number;
  isFreeText: boolean;
  notes: string | null;
}

export interface SearchParams {
  category: CropCategory;
  crop: CropKey;
  cropText?: string;
  pesticide?: string;
  target?: string;
  limit?: number;
}

export interface RacEntry {
  slot: number;
  ingredient: string | null;
  racCode: string | null;
  displayCode: string;
  useCategory: string | null;
}

export interface SearchHit {
  regNo: string;
  name: string;
  holder: string | null;
  useCategory: string | null;
  pesticideType: string | null;
  matchedCrops: string[];
  matchedTargets: string[];
  racCodes: string[];
  racMissing: boolean;
}

export interface ApplicationRow {
  id: number;
  regNo: string;
  cropName: string;
  place: string | null;
  targetPest: string | null;
  purpose: string | null;
  dilution: string | null;
  sprayVolume: string | null;
  timing: string | null;
  timesPerCrop: string | null;
  method: string | null;
  ingredient1TotalUses: string | null;
  ingredient2TotalUses: string | null;
  ingredient3TotalUses: string | null;
  ingredient4TotalUses: string | null;
  ingredient5TotalUses: string | null;
}

export interface ProductDetail {
  regNo: string;
  name: string;
  holder: string | null;
  useCategory: string | null;
  pesticideType: string | null;
  concentration: string | null;
  formulation: string | null;
  registeredOn: string | null;
  ingredients: { ingredient: string; ingredientForTotalUse: string | null }[];
  applications: ApplicationRow[];
  rac: RacEntry[];
  racCodes: string[];
  racMissing: boolean;
}

export interface RotationPeer {
  regNo: string;
  name: string;
  holder: string | null;
  racCodes: string[];
  matchedRacCodes?: string[];
}

export interface Env {
  PESTICIDES_DB: D1Database;
}
