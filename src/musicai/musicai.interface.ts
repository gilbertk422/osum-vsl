export interface OpenaiResponseChoice {
  text: string;
  index: number;
  logprobs: any;
  finish_reason: string;
}

export interface OpenaiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<OpenaiResponseChoice>;
}
