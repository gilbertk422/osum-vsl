import {Injectable, Logger, HttpService} from '@nestjs/common';
import * as FormData from 'form-data';
import * as fs from 'fs';
import * as moment from 'moment';
import {AxiosResponse} from 'axios';
import {
    Subtitle,
    OpenAIItem,
    Disclaimer,
    Citation,
    Image,
    GentleResponse,
    GentleWord,
    PollyWord, VoskWord,
} from '../shared/shared.interface';
import * as stringify from 'csv-stringify';
import {spawn} from "child_process";
import {SUBTITLE_CAP} from "./gentle.constant";
import * as FuzzySet from 'fuzzyset';
import {retrieveCols} from "@nestjs/cli/actions";

@Injectable()
export class GentleService {
    private readonly logger = new Logger(GentleService.name);

    constructor(private httpService: HttpService) {
    }

    toOpenAIData(data: Array<Subtitle>): Array<Subtitle> {
        const openAIData: Array<Subtitle> = [];

        for (let i = 0; i < data.length; i++) {

            const currentSubtitle: Subtitle = data[i];

            const openAIItem: OpenAIItem = {current: data[i].text};
            if (i > 0) {
                openAIItem.before = data[i - 1].text;
            }
            if (i < data.length - 1) {
                openAIItem.after = data[i + 1].text;
            }

            currentSubtitle.textContext = openAIItem;
            openAIData.push(currentSubtitle);
        }

        return openAIData;
    }

    async toCSV(data: Array<any>): Promise<string> {
        return new Promise((resolve, reject) => {
            stringify(data, {header: true, quoted: true, cast: {boolean: b => (b ? '1' : '0')}}, (err, output) => {
                if (err) reject(err);
                resolve(output);
            });
        });
    }

    buildStringSubtitles(subtitlesArr: Array<Subtitle>): string {
        const formatDuration = (time: number): string => {
            const formatInt = (int: number): string => {
                if (int < 10) {
                    return `0${int}`;
                }
                return `${int}`;
            };
            const hours: string = (() => formatInt(moment.duration(time).hours()) || '00')();
            const minutes: string = (() => formatInt(moment.duration(time).minutes()) || '00')();
            const seconds: string = (() => formatInt(moment.duration(time).seconds()) || '00')();
            const milliseconds: string = (() => {
                const ms =
                    moment
                        .duration(time)
                        .milliseconds()
                        .toFixed() || '000';
                if (+ms < 10) return `00${ms}`;
                if (+ms < 100) return `0${ms}`;
                return ms;
            })();
            return `${hours}:${minutes}:${seconds},${milliseconds}`;
        };

        let str = '';
        for (let i = 0; i < subtitlesArr.length; i++) {
            const {text, startTime, endTime} = subtitlesArr[i];
            str += `${i + 1}\n`;
            str += `${formatDuration(startTime)} --> ${formatDuration(endTime)}\n`;
            str += `${text}\n\n`;
        }
        return str;
    }

    /**
     * @deprecated - was requited for Gentle
     * @param gentleArr gentle data
     * @param audioDurationSeconds - audio file duration (in seconds)
     */
    gentleToJson(gentleArr: Array<GentleWord>, audioDurationSeconds): Array<PollyWord> {

        const audioDurationMs = audioDurationSeconds * 1000;

        const pollyArr: Array<PollyWord> = [];
        for (let i = 0; i < gentleArr.length; i++) {
            const gentleObj: GentleWord = gentleArr[i];
            const pollyObj: PollyWord = {word: gentleObj.word};
            // NOTE:
            // "not-found-in-audio" case happens when Gentle can't recognize word from audio,
            // So we need to catch it and calculate this unrecognized word timings.
            // Even if few words in a row hasn't recognized, we need to calculate timings for each of them.
            if (gentleObj.case !== 'not-found-in-audio') {
                pollyObj.time = (gentleObj.start * 1000).toFixed();
                pollyObj.endTime = (gentleObj.end * 1000).toFixed();
            } else {

                /** if Gentle was unable to recognize the word and get word time -
                 *  //calculate a time shift for each unrecognized word in the row,
                 *  with the timeshit = 0.001 sec - calculate average time start for each unrecognized word
                 */

                let prevRecognizedWordIdx = i;
                let nextRecognizedWordIdx = i;

                //  TODO: refactor this - optimize!!

                //find prev recognized word. set '0' if there is no prev recognized word
                let prevRecognizedTime = 0;
                while (prevRecognizedWordIdx >= 0 && gentleArr[prevRecognizedWordIdx].case === 'not-found-in-audio') prevRecognizedWordIdx -= 1;
                if (prevRecognizedWordIdx >= 0) {
                    prevRecognizedTime = gentleArr[prevRecognizedWordIdx].end;
                }

                //find next recognized word. set ending time of the audio if there is no next recognized word
                let nextRecognizedTime = audioDurationMs;
                while (nextRecognizedWordIdx < gentleArr.length && gentleArr[nextRecognizedWordIdx].case === 'not-found-in-audio') nextRecognizedWordIdx += 1;
                if (nextRecognizedWordIdx < gentleArr.length) {
                    nextRecognizedTime = gentleArr[nextRecognizedWordIdx].start;
                }

                const distance = nextRecognizedWordIdx - prevRecognizedWordIdx;
                // const shift = (nextRecognizedTime - prevRecognizedTime) / distance; //time shift for each unrecognized word
                const shift = 0.001;

                pollyObj.time = ((gentleArr[prevRecognizedWordIdx].end + (i - prevRecognizedWordIdx) * shift) * 1000).toFixed();

                // console.log("Word: %s, time: %d, shift: %d", gentleObj.word, pollyObj.time, shift)

                pollyObj.endTime = pollyObj.time;
                pollyObj.fixed = true;
            }
            pollyArr.push(pollyObj);
        }
        return pollyArr;
    }

    separateWords(string: string): Array<string> {
        if (!string) return [];
        const match = string.match(/"(?:\\"|[^"])+"|[^(\s|\-)]+/g);
        if (!match) return [];
        return match.map(word => word.replace(/^\"|\"$/g, ''));
    }

    /**
     * Split initialText by rows (each row is about 42 (SUBTITLE_CAP) chars)
     * @param initialText
     * @param cap
     * @return array of rows
     */
    buildRows(initialText: string, cap = SUBTITLE_CAP): Array<string> {

        const initWordsArr: Array<string> = this.separateWords(initialText);

        const linesArr: Array<string> = [];
        let text = '';

        // Processing array of words except last element (it will be processed with different logic separately)
        // add words to text while text lenght < cap
        for (let i = 0; i < initWordsArr.length - 1; i += 1) {
            const initWord = initWordsArr[i];

            // Building array of rows (with length cap)
            if (`${text} ${initWord}`.length <= cap) {
                text = `${text} ${initWord}`;
            } else {
                linesArr.push(text.trim());
                text = initWord;
            }
        }

        // Last word is processing separately
        const lastInitWord = initWordsArr[initWordsArr.length - 1];
        linesArr.push(`${text} ${lastInitWord}`.trim());

        // this.logger.debug(linesArr, '==linesArr');

        return linesArr;
    }


    async buildWordsAndSubtitlesByRows(
        initialText: string,
        _pollyWordsArr: Array<PollyWord>,
        mergedDuration: number,
        cap = 42,
        timeShiftMs = 0
    ) {
        const initWordsArr: Array<string> = this.separateWords(initialText);
        const pollyWordsArr: Array<PollyWord> = _pollyWordsArr.filter(w => !/(<([^>]+)>)/.test(w.word));

        // NOTE:
        // This debugger is for manual check for missmatching between array of words from initial text
        // and array of words from Gentle.

        // const wordsDebuggerArr = [];
        // for (let i = 0; i < initWordsArr.length; i++) {
        //   wordsDebuggerArr.push({
        //     init: initWordsArr[i],
        //     polly: pollyWordsArr[i].word,
        //     time: pollyWordsArr[i].time,
        //     timeShiftMs,
        //   });
        // }
        // await writeFile("wordsDebuggerArr.json", JSON.stringify(wordsDebuggerArr));

        if (initWordsArr.length !== pollyWordsArr.length) {
            console.error({
                initWordsArr: initWordsArr.length,
                pollyWordsArr: pollyWordsArr.length
            });
            throw new Error('[buildWordsAndSubtitlesByRows] word arrays length mismatch');
        }
        const linesArr: Array<string> = [];
        const sentencesArr: Array<Subtitle> = [];
        const subtitlesArr: Array<Subtitle> = [];
        let currentLine = '';
        let currentSentence = '';
        let startTime = +pollyWordsArr[0].time;
        let startTimeSentence = +pollyWordsArr[0].time;

        // Processing array of words except last element (it will be processed with different logic separately)
        for (let i = 0; i < initWordsArr.length - 1; i += 1) {
            const initWord = initWordsArr[i];
            let {time} = pollyWordsArr[i];
            time = +time;

            // Building array of rows (with length cap)
            if (`${currentLine} ${initWord}`.length <= cap) {
                currentLine = `${currentLine} ${initWord}`;
            } else {
                linesArr.push(currentLine.trim());

                const subtitleStartTime = startTime !== pollyWordsArr[0].time ? startTime + timeShiftMs : startTime;
                let subtitleEndTime = time + timeShiftMs;

                /**
                 * If gentle did not recognize some words - duration for some scenes can be calculated for few ms
                 * then - set duration for this scene to 500ms
                 */
                if (subtitleEndTime - subtitleStartTime < 500) {
                    subtitleEndTime += 500;
                }

                subtitlesArr.push({
                    text: currentLine.trim(),
                    startTime: subtitleStartTime,
                    endTime: subtitleEndTime
                });

                startTime = subtitleEndTime;
                currentLine = initWord;
            }

            // Building array of sentences (with length cap)
            if (!/(\!)|(\?)|(\.)|(\.\.\.)/.test(initWord)) {
                currentSentence = `${currentSentence} ${initWord}`;
            } else {
                sentencesArr.push({
                    text: `${currentSentence} ${initWord}`.trim(),
                    startTime:
                        +startTimeSentence !== pollyWordsArr[0].time ? +startTimeSentence + timeShiftMs : +startTimeSentence,
                    endTime: +time + timeShiftMs
                });
                startTimeSentence = time;
                currentSentence = '';
            }
        }

        // Last word is processing separately
        const lastInitWord = initWordsArr[initWordsArr.length - 1];
        linesArr.push(`${currentLine} ${lastInitWord}`.trim());
        subtitlesArr.push({
            text: `${currentLine} ${lastInitWord}`.trim(),
            startTime: +startTime + timeShiftMs,
            endTime: +mergedDuration * 1000 + timeShiftMs
        });
        sentencesArr.push({
            text: `${currentSentence} ${lastInitWord}`.trim(),
            startTime: +startTime + timeShiftMs,
            endTime: +mergedDuration * 1000 + timeShiftMs
        });
        return {
            subtitlesArr, // rows with timings
            linesArr, // just rows
            sentencesArr // sentences with timings
        };
    }

    // this function is for building JSON with timings by words
    // based on JSON with timings by rows
    buildSrtByWords(arr: Array<Subtitle>): Array<Subtitle> {
        // this.logger.debug(arr, '---------buildSrtByWords in')
        const _process = ({startTime, endTime, text, prevDuration}) => {
            const timeDiff: number = +endTime - +startTime;
            const words: Array<string> = this.separateWords(text);
            const wordDuration: number = timeDiff / words.length;
            const srtByWordsJson: Array<Subtitle> = [];
            const duration = moment.duration(prevDuration).add(1);

            console.log('--prevDuration, duration', prevDuration, duration.asMilliseconds().toFixed())
            for (let i = 0; i < words.length; i += 1) {
                const w = words[i];
                srtByWordsJson.push({
                    startTime: +duration.asMilliseconds().toFixed(),
                    endTime: +duration
                        .add(wordDuration)
                        .asMilliseconds()
                        .toFixed(),
                    text: w
                });
            }
            // this.logger.debug(srtByWordsJson, '---------buildSrtByWords srtByWordsJson')

            return {srtByWordsJson};
        };

        const srtJsonByWords: Array<Subtitle> = [];
        for (const el of arr) {
            const {srtByWordsJson: words} = _process({
                ...el,
                prevDuration: +el.startTime
            });
            // console.log({ el });
            srtJsonByWords.push(...words);
        }
        srtJsonByWords[srtJsonByWords.length - 1].endTime = srtJsonByWords[srtJsonByWords.length - 1].endTime - 1; // coz we don't need to increment last word's endTime
        return srtJsonByWords;
    }

    /**
     * Match recognized words to given strings, determine start, end time for each string
     * @param rows
     * @param words
     * @return array of strings with start time, end time of the string
     * // TODO: buy licence https://github.com/Glench/fuzzyset.js (49$)
     */
    matchVoskWords(rows: Array<string>, words: Array<VoskWord>): Array<Subtitle> {

        let accumulatedString = [];
        let oldScore = 0;
        const alignedRows: Array<Subtitle> = [];
        let firstWord = words[0];

        //add last dummy word to flush last found row

        let fuzzySet = FuzzySet();
        let rowIdx = 0;

        let matched = '';
        const BreakException = {};

        let rowStartTime = 0;

        try {
            words.forEach((word, idx) => {

                /**
                 * To increase matching accuracy - we search for last word only for current row (at the beginning - current row is #1)
                 * when the word is identified as ending word in the row (or sentence) - we pickup next row and start looking for ending word for that row
                 */
                if (fuzzySet.isEmpty()) {
                    if (!rows[rowIdx]) throw BreakException; //if we were reached end of input rows
                    fuzzySet.add(rows[rowIdx++])
                }

                //add current word to string
                //get most matched input string, measure the score with previous value
                //if score increased - remember matched input string
                //if score decreased - we are on next input string
                //  - add remembered at prev step string to found items, set prev word time as end as sentence (row)
                //  - set current word as first word in sentence
                //  - reset matched input string

                //(score will never equal to previous)
                accumulatedString.push(word.word);
                const tempstr = accumulatedString.join(' ');


                const res = fuzzySet.get(tempstr, null, 0.4);
                // console.log('-----------------------------------', tempstr, res);

                let currentScore = 0, text = '';

                //we were found something
                if (res) {
                    //get first variant - (its a variant with max score)
                    const variant = res[0];
                    [currentScore, text] = variant;
                    currentScore = Math.round(currentScore * 10)
                }

                // round up score to decrease sensitivity and decrease amount of false matches

                if (currentScore >= oldScore) {
                    matched = text;
                    oldScore = currentScore;
                    console.debug(`score: ${currentScore}        ...increased`)
                } else if (matched !=='') {
                    // this.logger.debug('added to alignedRows', word.word)
                    // console.log(tempstr)
                    // console.debug(`score:  ${currentScore}  word: ${word.word}  ...flushed: `, text);
                    // console.log('\r\n')

                    alignedRows.push({
                        text: matched,
                        startTime: rowStartTime,
                        endTime: words[idx - 1].start
                    })
                    rowStartTime = words[idx - 1].start;
                    matched = '';
                    firstWord = word;
                    oldScore = 0;
                    accumulatedString = []
                    accumulatedString.push(word.word)
                    fuzzySet = FuzzySet(); //reset searched string. preparing to match next row
                }

            });
        } catch (e) {
            if (e !== BreakException) throw e;
        }
        return alignedRows;
    }

    /**
     * Get time for images / citations (references) / disclaimers
     * @param rows
     * @param plainText
     * @param voskWords
     */
    matchStringsTimes(rows: Array<Image | Citation | Disclaimer>, plainText: string, voskWords: Array<VoskWord>): Array<Image | Citation | Disclaimer> {

        /**
         * Build array of rows - the string before first items (disclaimer, image, citation..),
         * strings between items, items itself.
         * match time for each such row
         * for each item - search for row === item, assign time of such row to the item
         *
         */
        let searchStartIdx = 0;
        let itemPosition = 0;
        let prevString = '';
        const foundRows = [];

        rows.forEach(item => {

            itemPosition = plainText.indexOf(item.text, searchStartIdx);
            prevString = plainText.substr(searchStartIdx, itemPosition - searchStartIdx);
            foundRows.push(prevString)
            foundRows.push(item.text);
            searchStartIdx = itemPosition + item.text.length + 1;
        });

        const strings = this.matchVoskWords(foundRows, voskWords);

        const matchedRows = [];

        strings.forEach(str => {

            rows.forEach(ds => {

                if (ds.text === str.text) {
                    matchedRows.push({
                        ...ds,
                        ...str
                    })
                }
            })
        })

        return matchedRows;
    }

    //this one does actual work
    async _voskRecognizer(audioFilePath: string): Promise<Array<VoskWord>> {

        const logger = this.logger;
        return new Promise((resolve, reject) => {

            let outputData: string;

            // call python script which will connect VOSK server using websockets an recognize the audio
            // we need it as somehow if we connect to VOSK websocket from node - it close connection before it process full file. Why??
            // TODO: refactor it - install KALDI, use native node module for VOSK API
            // @link https://github.com/alphacep/vosk-api/tree/master/nodejs
            const recognizer = spawn(`python3`, ['src/gentle/vosk_recognizer_ffmpeg.py', audioFilePath, process.env.VOSK_SERVER_URL]);
            // const recognizer = spawn(`python3`, ['vosk_recognizer_ffmpeg.py', audioFilePath, process.env.VOSK_SERVER_URL]);

            recognizer.stdout.on('data', function (data) {

                outputData = data.toString();
                logger.debug(` '${outputData}' ---data received`);

                try {

                    const data: Array<VoskWord> = JSON.parse(outputData);
                    resolve(data)
                } catch (e) {

                    logger.debug(e);
                }
            });

            recognizer.stderr.on('data', function (data) {
                reject(data.toString())
            });

            recognizer.on('close', function (code) {
                logger.debug('recognizer close');
            });

            recognizer.on('exit', function (code) {
                logger.debug('recognizer exit');
            });
        })
    }

    //helper method
    async recognizeAtVosk(audioFilePath: string): Promise<Array<VoskWord>> {

        const words = await this._voskRecognizer(audioFilePath);

        // for debugging
        // const words:Array<VoskWord> = [
        //   {
        //     "conf": 1,
        //     "end": 0.57,
        //     "start": 0,
        //     "word": "yes"
        //   },
        //   {
        //     "conf": 0.941605,
        //     "end": 0.96,
        //     "start": 0.69,
        //     "word": "it's"
        //   },
        //   {
        //     "conf": 0.990316,
        //     "end": 1.41,
        //     "start": 0.96,
        //     "word": "true"
        //   },
        //   {
        //     "conf": 0.832979,
        //     "end": 1.707406,
        //     "start": 1.59,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 2.37,
        //     "start": 1.707406,
        //     "word": "disciples"
        //   },
        //   {
        //     "conf": 0.976057,
        //     "end": 2.579817,
        //     "start": 2.37,
        //     "word": "way"
        //   },
        //   {
        //     "conf": 0.984878,
        //     "end": 2.76,
        //     "start": 2.580238,
        //     "word": "will"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 3.03,
        //     "start": 2.76,
        //     "word": "not"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 3.39,
        //     "start": 3.03,
        //     "word": "change"
        //   },
        //   {
        //     "conf": 0.995617,
        //     "end": 3.96,
        //     "start": 3.42,
        //     "word": "anyone's"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 4.56,
        //     "start": 3.96,
        //     "word": "beliefs"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 5.31,
        //     "start": 4.92,
        //     "word": "first"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 5.46,
        //     "start": 5.31,
        //     "word": "and"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 6.15,
        //     "start": 5.46,
        //     "word": "foremost"
        //   },
        //   {
        //     "conf": 0.391,
        //     "end": 6.57,
        //     "start": 6.27,
        //     "word": "face"
        //   },
        //   {
        //     "conf": 0.580977,
        //     "end": 6.711014,
        //     "start": 6.580783,
        //     "word": "as"
        //   },
        //   {
        //     "conf": 0.718959,
        //     "end": 6.78,
        //     "start": 6.72,
        //     "word": "a"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 7.29,
        //     "start": 6.780019,
        //     "word": "decision"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 7.44,
        //     "start": 7.29,
        //     "word": "of"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 7.5,
        //     "start": 7.44,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 0.998851,
        //     "end": 7.98,
        //     "start": 7.5,
        //     "word": "heart"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 8.58,
        //     "start": 8.31,
        //     "word": "why"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 8.76,
        //     "start": 8.58,
        //     "word": "does"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 8.97,
        //     "start": 8.76,
        //     "word": "this"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 9.45,
        //     "start": 8.97,
        //     "word": "matter"
        //   },
        //   {
        //     "conf": 0.992421,
        //     "end": 9.9,
        //     "start": 9.63,
        //     "word": "let"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 10.11,
        //     "start": 9.9,
        //     "word": "me"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 10.8,
        //     "start": 10.11,
        //     "word": "explain"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 11.1,
        //     "start": 10.95,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 11.49,
        //     "start": 11.1,
        //     "word": "reason"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 11.73,
        //     "start": 11.49,
        //     "word": "why"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 12,
        //     "start": 11.73,
        //     "word": "most"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 12.36,
        //     "start": 12,
        //     "word": "diet"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 12.99,
        //     "start": 12.36,
        //     "word": "programs"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 13.290008,
        //     "start": 12.99,
        //     "word": "fail"
        //   },
        //   {
        //     "conf": 0.991862,
        //     "end": 13.44,
        //     "start": 13.290008,
        //     "word": "is"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 13.74,
        //     "start": 13.44,
        //     "word": "because"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 13.89,
        //     "start": 13.74,
        //     "word": "they"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 14.13,
        //     "start": 13.89,
        //     "word": "make"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 14.28,
        //     "start": 14.13,
        //     "word": "us"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 14.61,
        //     "start": 14.28,
        //     "word": "worry"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 14.88,
        //     "start": 14.61,
        //     "word": "about"
        //   },
        //   {
        //     "conf": 0.916435,
        //     "end": 15.48,
        //     "start": 14.88,
        //     "word": "overeating"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 15.63,
        //     "start": 15.48,
        //     "word": "and"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 15.87,
        //     "start": 15.63,
        //     "word": "make"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 16.013877,
        //     "start": 15.87,
        //     "word": "us"
        //   },
        //   {
        //     "conf": 0.571652,
        //     "end": 16.41,
        //     "start": 16.02,
        //     "word": "obsessed"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 16.68,
        //     "start": 16.410007,
        //     "word": "over"
        //   },
        //   {
        //     "conf": 0.995399,
        //     "end": 17.07,
        //     "start": 16.68,
        //     "word": "food"
        //   },
        //   {
        //     "conf": 0.993657,
        //     "end": 18,
        //     "start": 17.76,
        //     "word": "when"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 18.12,
        //     "start": 18,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 18.42,
        //     "start": 18.12,
        //     "word": "first"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 18.69,
        //     "start": 18.42,
        //     "word": "thing"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 18.81,
        //     "start": 18.69,
        //     "word": "we"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 18.96,
        //     "start": 18.81,
        //     "word": "need"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 19.08,
        //     "start": 18.96,
        //     "word": "to"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 19.29,
        //     "start": 19.08,
        //     "word": "get"
        //   },
        //   {
        //     "conf": 0.991897,
        //     "end": 19.559916,
        //     "start": 19.29,
        //     "word": "right"
        //   },
        //   {
        //     "conf": 0.938889,
        //     "end": 19.65,
        //     "start": 19.56,
        //     "word": "as"
        //   },
        //   {
        //     "conf": 0.999616,
        //     "end": 19.77,
        //     "start": 19.65,
        //     "word": "it"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 20.1,
        //     "start": 19.77,
        //     "word": "says"
        //   },
        //   {
        //     "conf": 0.999503,
        //     "end": 20.37,
        //     "start": 20.1,
        //     "word": "in"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 21.09,
        //     "start": 20.64,
        //     "word": "matthew"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 21.54,
        //     "start": 21.09,
        //     "word": "chapter"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 21.9,
        //     "start": 21.54,
        //     "word": "six"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 22.14,
        //     "start": 21.9,
        //     "word": "verse"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 22.44,
        //     "start": 22.14,
        //     "word": "thirty"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 22.86,
        //     "start": 22.44,
        //     "word": "three"
        //   },
        //   {
        //     "conf": 0.987633,
        //     "end": 23.22,
        //     "start": 23.04,
        //     "word": "is"
        //   },
        //   {
        //     "conf": 0.975116,
        //     "end": 23.37,
        //     "start": 23.22,
        //     "word": "to"
        //   },
        //   {
        //     "conf": 0.995543,
        //     "end": 23.609991,
        //     "start": 23.370694,
        //     "word": "seek"
        //   },
        //   {
        //     "conf": 0.999834,
        //     "end": 23.7,
        //     "start": 23.609991,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 24.06,
        //     "start": 23.7,
        //     "word": "kingdom"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 24.21,
        //     "start": 24.06,
        //     "word": "of"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 24.54,
        //     "start": 24.24,
        //     "word": "god"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 24.87,
        //     "start": 24.54,
        //     "word": "first"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 25.2,
        //     "start": 24.87,
        //     "word": "before"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 25.74,
        //     "start": 25.2,
        //     "word": "anything"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 26.7,
        //     "start": 26.46,
        //     "word": "this"
        //   },
        //   {
        //     "conf": 0.991409,
        //     "end": 26.85,
        //     "start": 26.7,
        //     "word": "is"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 27.06,
        //     "start": 26.85,
        //     "word": "what"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 27.359995,
        //     "start": 27.06,
        //     "word": "sets"
        //   },
        //   {
        //     "conf": 0.998891,
        //     "end": 27.45,
        //     "start": 27.360002,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 28.11,
        //     "start": 27.45,
        //     "word": "foundation"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 28.226396,
        //     "start": 28.11,
        //     "word": "for"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 29.13,
        //     "start": 28.23,
        //     "word": "transformation"
        //   },
        //   {
        //     "conf": 0.999143,
        //     "end": 29.64,
        //     "start": 29.13,
        //     "word": "inside"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 29.79,
        //     "start": 29.64,
        //     "word": "and"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 30.03,
        //     "start": 29.79,
        //     "word": "out"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 30.81,
        //     "start": 30.45,
        //     "word": "because"
        //   },
        //   {
        //     "conf": 0.999039,
        //     "end": 31.02,
        //     "start": 30.81,
        //     "word": "when"
        //   },
        //   {
        //     "conf": 0.996748,
        //     "end": 31.53,
        //     "start": 31.02,
        //     "word": "everything"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 31.65,
        //     "start": 31.53,
        //     "word": "is"
        //   },
        //   {
        //     "conf": 0.7339,
        //     "end": 31.919802,
        //     "start": 31.65,
        //     "word": "set"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 32.76,
        //     "start": 31.920143,
        //     "word": "spiritually"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 33.03,
        //     "start": 32.88,
        //     "word": "it"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 33.33,
        //     "start": 33.03,
        //     "word": "makes"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 33.42,
        //     "start": 33.33,
        //     "word": "it"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 33.87,
        //     "start": 33.42,
        //     "word": "easier"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 34.02,
        //     "start": 33.87,
        //     "word": "to"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 34.35,
        //     "start": 34.02,
        //     "word": "remove"
        //   },
        //   {
        //     "conf": 0.990622,
        //     "end": 34.47,
        //     "start": 34.35,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 34.77,
        //     "start": 34.47,
        //     "word": "three"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 35.22,
        //     "start": 34.77,
        //     "word": "calorie"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 35.55,
        //     "start": 35.22,
        //     "word": "burning"
        //   },
        //   {
        //     "conf": 0.894532,
        //     "end": 36.119663,
        //     "start": 35.55,
        //     "word": "blockers"
        //   },
        //   {
        //     "conf": 0.964257,
        //     "end": 36.479194,
        //     "start": 36.12,
        //     "word": "caused"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 36.6,
        //     "start": 36.479194,
        //     "word": "by"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 37.11,
        //     "start": 36.6,
        //     "word": "western"
        //   },
        //   {
        //     "conf": 0.957455,
        //     "end": 37.44,
        //     "start": 37.11,
        //     "word": "food"
        //   },
        //   {
        //     "conf": 0.998945,
        //     "end": 37.59,
        //     "start": 37.468722,
        //     "word": "by"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 37.89,
        //     "start": 37.590007,
        //     "word": "eating"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 37.98,
        //     "start": 37.89,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 0.987425,
        //     "end": 38.340125,
        //     "start": 37.98,
        //     "word": "foods"
        //   },
        //   {
        //     "conf": 0.949299,
        //     "end": 38.639993,
        //     "start": 38.340125,
        //     "word": "god"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 39.06,
        //     "start": 38.640004,
        //     "word": "mentioned"
        //   },
        //   {
        //     "conf": 0.999477,
        //     "end": 39.21,
        //     "start": 39.06,
        //     "word": "in"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 39.81,
        //     "start": 39.210015,
        //     "word": "scripture"
        //   },
        //   {
        //     "conf": 0.840155,
        //     "end": 40.649985,
        //     "start": 40.5,
        //     "word": "are"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 40.83,
        //     "start": 40.649985,
        //     "word": "you"
        //   },
        //   {
        //     "conf": 0.942709,
        //     "end": 41.159359,
        //     "start": 40.86,
        //     "word": "enter"
        //   },
        //   {
        //     "conf": 0.481555,
        //     "end": 41.46,
        //     "start": 41.190026,
        //     "word": "stood"
        //   },
        //   {
        //     "conf": 0.54813,
        //     "end": 41.58,
        //     "start": 41.46,
        //     "word": "in"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 41.67,
        //     "start": 41.593557,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 42.27,
        //     "start": 41.67,
        //     "word": "disciples"
        //   },
        //   {
        //     "conf": 0.979004,
        //     "end": 42.6,
        //     "start": 42.27,
        //     "word": "way"
        //   },
        //   {
        //     "conf": 0.862153,
        //     "end": 43.139919,
        //     "start": 42.93,
        //     "word": "if"
        //   },
        //   {
        //     "conf": 0.988601,
        //     "end": 43.53,
        //     "start": 43.139919,
        //     "word": "so"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 43.89,
        //     "start": 43.650026,
        //     "word": "look"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 44.01,
        //     "start": 43.89,
        //     "word": "at"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 44.1,
        //     "start": 44.01,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 44.7,
        //     "start": 44.1,
        //     "word": "disciples"
        //   },
        //   {
        //     "conf": 0.93135,
        //     "end": 44.938004,
        //     "start": 44.7,
        //     "word": "way"
        //   },
        //   {
        //     "conf": 0.984677,
        //     "end": 45.33,
        //     "start": 44.94,
        //     "word": "review"
        //   },
        //   {
        //     "conf": 0.997419,
        //     "end": 45.57,
        //     "start": 45.36,
        //     "word": "by"
        //   },
        //   {
        //     "conf": 0.505285,
        //     "end": 45.99,
        //     "start": 45.6,
        //     "word": "dr"
        //   },
        //   {
        //     "conf": 0.9929,
        //     "end": 46.351124,
        //     "start": 45.99,
        //     "word": "josh"
        //   },
        //   {
        //     "conf": 0.730894,
        //     "end": 46.83,
        //     "start": 46.351124,
        //     "word": "decks"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 47.7,
        //     "start": 47.52,
        //     "word": "and"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 48.21,
        //     "start": 47.7,
        //     "word": "discover"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 48.419989,
        //     "start": 48.21,
        //     "word": "why"
        //   },
        //   {
        //     "conf": 0.956618,
        //     "end": 48.54,
        //     "start": 48.420011,
        //     "word": "the"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 49.14,
        //     "start": 48.54,
        //     "word": "disciples"
        //   },
        //   {
        //     "conf": 0.81503,
        //     "end": 49.35,
        //     "start": 49.14,
        //     "word": "way"
        //   },
        //   {
        //     "conf": 0.999157,
        //     "end": 50.1,
        //     "start": 49.38,
        //     "word": "emphasizes"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 50.37,
        //     "start": 50.1,
        //     "word": "eating"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 50.88,
        //     "start": 50.37,
        //     "word": "calorie"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 51.27,
        //     "start": 50.88,
        //     "word": "burning"
        //   },
        //   {
        //     "conf": 0.999703,
        //     "end": 51.63,
        //     "start": 51.27,
        //     "word": "foods"
        //   },
        //   {
        //     "conf": 0.998754,
        //     "end": 51.78,
        //     "start": 51.63,
        //     "word": "to"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 52.166239,
        //     "start": 51.78,
        //     "word": "ignite"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 52.98,
        //     "start": 52.171736,
        //     "word": "metabolism"
        //   },
        //   {
        //     "conf": 0.997455,
        //     "end": 53.94,
        //     "start": 53.7,
        //     "word": "click"
        //   },
        //   {
        //     "conf": 0.998845,
        //     "end": 54.18,
        //     "start": 53.940011,
        //     "word": "through"
        //   },
        //   {
        //     "conf": 0.999427,
        //     "end": 54.51,
        //     "start": 54.18,
        //     "word": "below"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 54.72,
        //     "start": 54.51,
        //     "word": "now"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 54.84,
        //     "start": 54.72,
        //     "word": "to"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 55.14,
        //     "start": 54.84,
        //     "word": "learn"
        //   },
        //   {
        //     "conf": 1,
        //     "end": 55.47,
        //     "start": 55.14,
        //     "word": "more"
        //   }
        // ]

        //needed to mark end of words
        words.push({"conf": 0, "end": 0, "start": 0, "word": "dummydummydummydummydummydummydummy"});

        //convert seconds to ms
        return words.map(word => ({
            ...word,
            start: Math.round(word.start * 1000),
            end: Math.round(word.end * 1000),
        }))
    }

    /**
     * @deprecated
     * @param audioFilePath
     * @param text
     */
    async request(audioFilePath: string, text: string): Promise<GentleResponse> {
        const data: FormData = new FormData();

        data.append('audio', fs.createReadStream(audioFilePath));
        data.append('transcript', text);

        const result: AxiosResponse<GentleResponse> = await this.httpService
            .post(process.env.GENTLE_API_URL, data, {
                headers: {...data.getHeaders()},
                maxContentLength: Infinity,
                params: {
                    async: false
                }
            })
            .toPromise();

        return result.data;
    }

    /**
     * @deprecated
     * @param plaintext
     * @param voskWords
     * @param disclaimers
     * @param citations
     * @param images
     */
    buildDisclaimerCitationImage(
        plaintext: string,
        voskWords: Array<VoskWord>,
        disclaimers: Array<Disclaimer>,
        citations: Array<Citation>,
        images: Array<Image>
    ) {
        const words: Array<string> = this.separateWords(plaintext);
        let startIndex = 0;
        const pollyInIndexOf: any = {};
        const pollyInLastIndexOf: any = {};

        // put polly words to positions of plaintext
        for (const polly of voskWords) {
            const position = plaintext.indexOf(polly.word, startIndex);
            if (position == -1) throw "Polly words don't match";
            pollyInIndexOf[position] = polly; // put polly words at the first index of the word
            pollyInLastIndexOf[position + polly.word.length] = polly; // put polly words at the last index of the word
            startIndex = position + polly.word.length;
        }

        // get disclaimers
        const resultDisclaimers: Array<Subtitle> = [];
        for (const disclaimer of disclaimers) {
            const regexp = new RegExp(`\\b${disclaimer.text}\\b`, 'gim');
            let match;
            // iterate all the occurrences of disclaimers
            while ((match = regexp.exec(plaintext))) {
                if (!pollyInIndexOf[match.index]) throw "disclaimers don't match, first word";
                if (!pollyInLastIndexOf[regexp.lastIndex]) throw "disclaimers don't match, last word";
                const startPolly: PollyWord = pollyInIndexOf[match.index]; // get first polly word of the disclaimer
                const endPolly: PollyWord = pollyInLastIndexOf[regexp.lastIndex]; // get last polly word of the disclaimer
                resultDisclaimers.push({
                    text: disclaimer.disclaimer,
                    startTime: +startPolly.time,
                    endTime: +endPolly.endTime
                });
            }
        }

        // get citations
        const resultCitations: Array<Subtitle> = [];
        for (const citation of citations) {
            const regexp = new RegExp(`\\b${citation.text}\\b`, 'gim');
            let match;
            // iterate all the occurrences of citations
            while ((match = regexp.exec(plaintext))) {
                if (!pollyInIndexOf[match.index]) throw "citations don't match, first word";
                if (!pollyInLastIndexOf[regexp.lastIndex]) throw "citations don't match, last word";
                const startPolly: PollyWord = pollyInIndexOf[match.index]; // get first polly word of the citation
                const endPolly: PollyWord = pollyInLastIndexOf[regexp.lastIndex]; // get last polly word of the citation
                resultCitations.push({
                    text: citation.citation,
                    startTime: +startPolly.time,
                    endTime: +endPolly.endTime
                });
            }
        }

        // get images
        const resultImages: Array<Image> = [];
        for (const image of images) {
            const regexp = new RegExp(`\\b${image.text}\\b`, 'gim');
            let match;
            // iterate all the occurrences of texts of images
            while ((match = regexp.exec(plaintext))) {
                if (!pollyInIndexOf[match.index]) throw "images don't match, first word";
                if (!pollyInLastIndexOf[regexp.lastIndex]) throw "images don't match, last word";
                const startPolly: PollyWord = pollyInIndexOf[match.index]; // get first polly word of the image text
                const endPolly: PollyWord = pollyInLastIndexOf[regexp.lastIndex]; // get first polly word of the image text
                resultImages.push({
                    ...image,
                    startTime: +startPolly.time,
                    endTime: +endPolly.endTime
                });
            }
        }

        return {
            disclaimers: resultDisclaimers,
            citations: resultCitations,
            images: resultImages
        };
    }
}
