import {Injectable, HttpService, Logger} from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class ThumborService {
  private readonly logger = new Logger(ThumborService.name);

  constructor(private httpService: HttpService) {}

  /**
   * get smart crop image from thumbor
   * @param imageUrl
   * @param resolution
   * @param outputPath
   */
  async smartCrop(imageUrl: string, resolution: string, outputPath: string): Promise<string> {

    this.logger.debug(`calling ${process.env.THUMBOR_ENDPOINT}/unsafe/${resolution}/smart/${imageUrl}`);

    const result = await this.httpService
      .get(`${process.env.THUMBOR_ENDPOINT}/unsafe/${resolution}/smart/${imageUrl}`, {responseType: 'stream'})
      .toPromise();

    const writer = fs.createWriteStream(outputPath);

    return await new Promise((resolve: any, reject) => {
      result.data.pipe(writer);

      //doesnt work
      //TODO: refactor this
      // result.data.on('error', err => {
      //
      //   this.logger.debug('=========THUMBOR ERROR')
      //   this.logger.error(err);
      //   reject(err);
      // })

      let error = null;
      writer.on('error', err => {

        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) {
          resolve(outputPath);
        }
      });
    });
  }
}
