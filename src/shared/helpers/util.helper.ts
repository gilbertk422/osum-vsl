/**
 * get extension of the file
 * @param filename input file name or url
 */
export function getExt(filename: string) {
  const splits = filename.split('.');
  return splits[splits.length - 1];
}


export function randomIntFromInterval(min, max) { // min and max included

  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function sleep(secondsMin, secondsMax, logger?) {

  const seconds = randomIntFromInterval(secondsMin, secondsMax);
  logger?.debug(`..sleep ${seconds} seconds` )
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}