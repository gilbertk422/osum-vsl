import {resizeVideo} from './video.helper';

describe('VideoHelper', () => {
  describe('check resizeVideo', () => {
    it('should return output path', async () => {
      expect(await resizeVideo('/e/1.mp4', 320, 240, '/e')).toBeDefined();
    });
  });
});
