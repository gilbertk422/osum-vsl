export interface Size {
  width: number;
  height: number;
}

export interface Margin {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface Font {
  filepath: string;
  size: number;
}

export interface VideoRenderProfile {
  name: 'landscape' | 'portrait' | 'square';
  videoSize: Size;

  productImageSize: Size;
  productImageMargin: Margin;

  guaranteeImageSize: Size;
  guaranteeImageMargin: Margin;

  backgroundVolume: number;
  speechVolume: number;

  subtitleMargin: Margin;
  subtitleFont: Font;

  disclaimerMargin: Margin;
  disclaimerSize: Size;
  disclaimerFont: Font;

  citationMargin: Margin;
  citationSize: Size;
  citationFont: Font;
}
