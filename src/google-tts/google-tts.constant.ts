// sometimes ssml spliter cannot spit the text and fails with error 'Last SSML tag appeared to be too long'
// it happends because there is text + long ssml tag (ex. - <emphasis>), and length of accumulated text before tag -s much less than softlimit,
//   length of accumulated text WITH tag - much more that hard limit
export const SSML_SPLIT_SOFTLIMIT = 3000;
export const SSML_SPLIT_HARDLIMIT = 5000;

export const GOOGLETTS_LANGUAGE_CODE = 'en-US';
export const GOOGLETTS_NAME = 'en-US-Wavenet-F';
export const GOOGLETTS_SSML_GENDER_FEMALE = 'FEMALE';
export const GOOGLETTS_SSML_GENDER_MALE = 'MALE';
export const GOOGLETTS_AUDIO_ENCODING = 'LINEAR16';
