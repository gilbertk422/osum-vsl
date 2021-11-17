import {VideoRenderProfile} from './video-render-profile.interface';

export const LANDSCAPE_VIDEO_RENDER_PROFILE: VideoRenderProfile = {
  name: 'landscape',

  videoSize: {
    width: 1200,
    height: 720
  },

  productImageSize: {
    width: 960,
    height: 720
  },
  productImageMargin: {
    top: -50,
    left: 0,
    right: 0,
    bottom: 0
  },

  guaranteeImageSize: {
    width: 800,
    height: 600
  },
  guaranteeImageMargin: {
    top: -50,
    left: 0,
    right: 0,
    bottom: 0
  },

  backgroundVolume: 0.2,

  speechVolume: 1,

  subtitleFont: {
    filepath: './fonts/OpenSans-Regular.ttf',
    size: 48
  },
  subtitleMargin: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 120
  },

  disclaimerMargin: {
    left: 0,
    top: 80,
    right: 100,
    bottom: 0
  },
  disclaimerFont: {
    filepath: './fonts/OpenSans-Regular.ttf',
    size: 24
  },
  disclaimerSize: {
    width: 480,
    height: 0
  },

  citationMargin: {
    top: 0,
    left: 60,
    right: 0,
    bottom: 50
  },
  citationFont: {
    filepath: './fonts/OpenSans-Regular.ttf',
    size: 24
  },
  citationSize: {
    width: 960,
    height: 0
  }
};

export const PORTRAIT_VIDEO_RENDER_PROFILE: VideoRenderProfile = {
  name: 'portrait',

  videoSize: {
    width: 720,
    height: 1200
  },

  productImageSize: {
    width: 480,
    height: 320
  },
  productImageMargin: {
    top: -50,
    left: 0,
    right: 0,
    bottom: 0
  },

  guaranteeImageSize: {
    width: 480,
    height: 320
  },
  guaranteeImageMargin: {
    top: -50,
    left: 0,
    right: 0,
    bottom: 0
  },

  backgroundVolume: 0.2,

  speechVolume: 1,

  subtitleFont: {
    filepath: './fonts/OpenSans-Regular.ttf',
    size: 32
  },
  subtitleMargin: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 120
  },

  disclaimerMargin: {
    left: 0,
    top: 80,
    right: 100,
    bottom: 0
  },
  disclaimerFont: {
    filepath: './fonts/OpenSans-Regular.ttf',
    size: 20
  },
  disclaimerSize: {
    width: 480,
    height: 0
  },

  citationMargin: {
    top: 0,
    left: 60,
    right: 0,
    bottom: 50
  },
  citationFont: {
    filepath: './fonts/OpenSans-Regular.ttf',
    size: 20
  },
  citationSize: {
    width: 420,
    height: 0
  }
};

export const SQUARE_VIDEO_RENDER_PROFILE: VideoRenderProfile = {
  name: 'square',

  videoSize: {
    width: 1080,
    height: 1080
  },

  productImageSize: {
    width: 800,
    height: 600
  },
  productImageMargin: {
    top: -50,
    left: 0,
    right: 0,
    bottom: 0
  },

  guaranteeImageSize: {
    width: 800,
    height: 600
  },
  guaranteeImageMargin: {
    top: -50,
    left: 0,
    right: 0,
    bottom: 0
  },

  backgroundVolume: 0.2,

  speechVolume: 1,

  subtitleFont: {
    filepath: './fonts/OpenSans-Regular.ttf',
    size: 48
  },
  subtitleMargin: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 120
  },

  disclaimerMargin: {
    left: 0,
    top: 80,
    right: 100,
    bottom: 0
  },
  disclaimerFont: {
    filepath: './fonts/OpenSans-Regular.ttf',
    size: 24
  },
  disclaimerSize: {
    width: 480,
    height: 0
  },

  citationMargin: {
    top: 0,
    left: 60,
    right: 0,
    bottom: 50
  },
  citationFont: {
    filepath: './fonts/OpenSans-Regular.ttf',
    size: 24
  },
  citationSize: {
    width: 780,
    height: 0
  }
};
