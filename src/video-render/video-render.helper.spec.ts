import {getImageSize} from './video-render.helper';

describe('VideoRenderHelper', () => {
  describe('check getImageSize', () => {
    it('should return size', async () => {
      expect(await getImageSize('./test.png')).toBeDefined();
    });
  });
});
