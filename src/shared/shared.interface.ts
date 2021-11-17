export interface MediaContent {
  landscape: string;
  portrait: string;
  square: string;
}

export interface Subtitle {
  text: string;
  startTime: number; //ms
  endTime: number; //ms
  textContext?: OpenAIItem;
  type?: 'image' | 'video';
  rawContent?: string;
  content?: MediaContent;
}

export interface SubtitleJson {
  rows: Array<Subtitle>;
  sentences: Array<Subtitle>;
  words: Array<Subtitle>;
}

export interface OpenAIItem {
  before?: string;
  current: string;
  after?: string;
}

export interface uploadedImage {
  originalName: string;
  type: string;
  rawContent: string;
}

export interface SSMLEnhanced {
  citations: Citation[];
  images?: Image[];
  ssml: string;
  enhancedText: string;
  disclaimers: [];
  plainText: string;
}

export interface Image {
  originalName: string;
  rawContent: string;
  text?: string;
  /** @deprecated **/
  imageUrl: string;
  startTime?: number;
  endTime?: number;
  type: 'product' | 'guarantee';
}

export interface Disclaimer {
  startTime?: number;
  endTime?: number;
  text: string;
  disclaimer?: string; //TODO: what the difference with text?
}

export interface Citation {
  startTime?: number;
  endTime?: number;
  text: string;
  citation?: string;
}

export interface Audio {
  audioUrl: string;
  startTime: number;
  endTime: number;
}

// export interface Disclaimer {
//   text: string;
//   disclaimer: string;
// }
//
// export interface Citation {
//   text: string;
//   citation: string;
// }

export interface GentlePhone {
  duration: number;
  phone: string;
}

export interface GentleWord {
  alignedWord: string;
  case: string;
  end: number;
  endOffset: number;
  phone: Array<GentlePhone>;
  start: number;
  startOffset: number;
  word: string;
}

export interface PollyWord {
  word: string;
  time?: string | number;
  endTime?: string | number;
  fixed?: boolean;
}

export interface VoskWord {
  conf: number, 
  end: number,  //ms
  start: number, //ms
  word: string
}

export interface GentleResponse {
  transcript: string;
  words: Array<GentleWord>;
}

export interface JobData {
  projectId?: number;
  projectName?: string;
  voskWords?: VoskWord[];
  uploadedImages?: uploadedImage[];
  voiceGender: 'male' | 'female';
  useVidux: number;
  videosPercent: number;
  ttsWavFileUrl?: string;
  backgroundAudioFileUrl?: string;
  script: string;
  ssml?: string;
  enhancedText?: string;
  disclaimers?: Disclaimer[];
  citations?: Citation[];
  images?: Image[];
  plainText?: string;
  rows: Array<Subtitle>; //text spitted by 42 chars. used to display subtitles
  sentences: Array<Subtitle>; //text spited by sentences. used by OpenAI
  words: Array<Subtitle>;
  subtitleCSVUrl: string;
  subtitleSRTUrl: string;
  openAIData: Array<OpenAIItem>;
}
