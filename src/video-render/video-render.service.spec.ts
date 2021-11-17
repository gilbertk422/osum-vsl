import {VideoRenderService} from './video-render.service';

describe('VideoRenderProcessor', () => {
  let videoRenderService: VideoRenderService;

  beforeEach(async () => {
    videoRenderService = new VideoRenderService();
  });

  describe('checkFFmpegVersion', () => {
    it('should return "FFmpeg is working"', () => {
      expect(videoRenderService.checkFFmpegVersion()).toBe('FFmpeg is working');
    });
  });
});
