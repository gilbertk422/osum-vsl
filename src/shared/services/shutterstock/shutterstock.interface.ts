interface ShutterContributor {
  id: string;
}

interface ShutterImageAsset {
  url: string;
  height: number;
  width: number;
}

export interface ShutterImageAssetList {
  huge_thumb: ShutterImageAsset;
  large_thumb: ShutterImageAsset;
  small_thumb: ShutterImageAsset;
  preview: ShutterImageAsset;
  preview_1000: ShutterImageAsset;
  preview_1500: ShutterImageAsset;
}

export interface ShutterImageData {
  contributor: ShutterContributor;
  id: string;
  media_type: string;
  aspect: number;
  assets: ShutterImageAssetList;
  description: string;
  has_model_release: boolean;
  image_type: string;
}

export interface ShutterImageResponse {
  data: Array<ShutterImageData>;
}

interface ShutterVideoAsset {
  url: string;
}

export interface ShutterVideoAssetList {
  preview_jpg: ShutterVideoAsset;
  preview_mp4: ShutterVideoAsset;
  preview_webm: ShutterVideoAsset;
  thumb_jpg: ShutterVideoAsset;
  thumb_mp4: ShutterVideoAsset;
  thumb_webm: ShutterVideoAsset;
}

export interface ShutterVideoData {
  contributor: ShutterContributor;
  id: string;
  media_type: string;
  aspect: number;
  aspect_ratio: string;
  assets: Array<ShutterVideoAssetList>;
  description: string;
  duration: number;
  has_model_release: boolean;
}

export interface ShutterVideoResponse {
  data: Array<ShutterVideoData>;
}

export type ShutterSearchResult = Array<ShutterVideoData | ShutterImageData>;

export interface ShutterVideoSearchOptions {
  durationFrom?: number;
  durationTo?: number;
  resolution?: '4k' | 'standard_definition' | 'high_definition'; // Valid values: 4k, standard_definition, high_definition
}

export interface ShutterImageSearchOptions {
  widthFrom?: number;
  widthTo?: number;
  heightFrom?: number;
  heightTo?: number;
}

export interface ShutterSearchOptions {
  videoOptions?: ShutterVideoSearchOptions;
  imageOptions?: ShutterImageSearchOptions;
}

export interface ShutterSearchQuery {
  query: string;
  per_page: number;
  sort: string;
  language: string;
  [key: string]: any;
}

export type ShutterSearchType = 'video' | 'image';
