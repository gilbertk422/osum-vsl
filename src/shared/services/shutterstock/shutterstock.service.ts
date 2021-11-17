import {Injectable} from '@nestjs/common';
import * as sstk from 'shutterstock-api';
import {
  PAGE_RESULTS_COUNT,
  SEARCH_LANG,
  SEARCH_SORT,
  DATA_TYPE_ERROR,
  DEFAULT_VIDEO_RESOLUTION
} from './shutterstock.constant';
import {
  ShutterImageResponse,
  ShutterVideoResponse,
  ShutterSearchResult,
  ShutterVideoSearchOptions,
  ShutterImageSearchOptions,
  ShutterSearchOptions,
  ShutterSearchQuery,
  ShutterSearchType
} from './shutterstock.interface';
import {MIN_IMAGE_WIDTH, MIN_IMAGE_HEIGHT, VIDEO_DATA_TYPE, IMAGE_DATA_TYPE} from '../../shared.constant';

@Injectable()
export class ShutterstockService {
  private imagesApi: any;
  private videosApi: any;

  constructor() {
    sstk.setBasicAuth(process.env.SHUTTERSTOCK_API_KEY, process.env.SHUTTERSTOCK_API_SECRET);
    this.imagesApi = new sstk.ImagesApi();
    this.videosApi = new sstk.VideosApi();
  }

  async search(
    keywords: Array<string>,
    type: ShutterSearchType,
    options: ShutterSearchOptions = {}
  ): Promise<ShutterSearchResult> {
    const keyword = keywords.join(' ');
    const result = [];
    switch (type) {
      case VIDEO_DATA_TYPE:
        const videoData: ShutterVideoResponse = await this.searchVideos(
          keyword,
          PAGE_RESULTS_COUNT,
          options.videoOptions
        );
        result.push(...videoData.data);
        break;

      case IMAGE_DATA_TYPE:
        const imageData: ShutterImageResponse = await this.searchImages(
          keyword,
          PAGE_RESULTS_COUNT,
          options.imageOptions
        );
        result.push(...imageData.data);
        break;

      default:
        throw new Error(DATA_TYPE_ERROR);
    }
    return result;
  }

  private async searchVideos(
    keyword: string,
    count: number,
    options: ShutterVideoSearchOptions = {}
  ): Promise<ShutterVideoResponse> {
    const query: ShutterSearchQuery = {
      query: keyword,
      per_page: count,
      sort: SEARCH_SORT,
      language: SEARCH_LANG,
      resolution: options.resolution || DEFAULT_VIDEO_RESOLUTION
    };
    if (options.durationFrom) query.duration_from = options.durationFrom;
    if (options.durationTo) query.duration_to = options.durationTo;
    return this.videosApi.searchVideos(query);
  }

  private async searchImages(
    keyword: string,
    count: number,
    options: ShutterImageSearchOptions = {}
  ): Promise<ShutterImageResponse> {
    const query: ShutterSearchQuery = {
      query: keyword,
      per_page: count,
      sort: SEARCH_SORT,
      language: SEARCH_LANG,
      width_from: options.widthFrom || MIN_IMAGE_WIDTH,
      height_from: options.heightFrom || MIN_IMAGE_HEIGHT
    };
    if (options.widthTo) query.width_to = options.widthTo;
    if (options.heightTo) query.heigth_to = options.heightTo;
    return this.imagesApi.searchImages(query);
  }
}
