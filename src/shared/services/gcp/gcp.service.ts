import {Injectable, HttpService, Logger} from '@nestjs/common';
import {Storage, UploadResponse, DownloadResponse, MakeFilePublicResponse} from '@google-cloud/storage';
import {JobId} from 'bull';
import * as fs from 'fs';
import {AxiosResponse} from 'axios';
const storage = new Storage();

@Injectable()
export class GcpService {
  private readonly logger = new Logger(GcpService.name);
  constructor(private httpService: HttpService) {}

  async upload(filePath: string, destUrl: string): Promise<UploadResponse> {
    this.logger.debug(`Uploading ${filePath} to ${destUrl}`);
    return await storage.bucket(process.env.GCS_BUCKET).upload(filePath, {
      destination: destUrl,
      // Support for HTTP requests made with `Accept-Encoding: gzip`
      // gzip: true,
      // By setting the option `destination`, you can change the name of the
      // object you are uploading to a bucket.
      metadata: {
        // Enable long-lived HTTP caching headers
        // Use only if the contents of the file will never change
        // (If the contents will change, use cacheControl: 'no-cache')
        cacheControl: 'public, max-age=31536000'
      }
    });
  }

  async makePublic(destUrl: string): Promise<MakeFilePublicResponse> {
    return await storage
      .bucket(process.env.GCS_BUCKET)
      .file(destUrl)
      .makePublic();
  }

  async download(destUrl: string, filePath: string): Promise<DownloadResponse> {
    this.logger.debug(`downloading ${destUrl} to ${filePath}`);

    const exists = await storage
      .bucket(process.env.GCS_BUCKET)
      .file(destUrl)
      .exists();
    if (!exists[0]) throw `GcpService download(): File ${destUrl} does not exists!`;

    return await storage
      .bucket(process.env.GCS_BUCKET)
      .file(destUrl)
      .download({
        // The path to which the file should be downloaded, e.g. "./file.txt"
        destination: filePath
      });
  }

  async uploadFileByUrl(
    fileUrl: string,
    jobId: JobId,
    tempDir: string,
    tempFileName: string,
    makePublic: boolean
  ): Promise<string> {
    const response: AxiosResponse<any> = await this.httpService.get(fileUrl, {responseType: 'arraybuffer'}).toPromise();
    const fileName = fileUrl.split('/').pop() || tempFileName;
    const filePath = `${tempDir}/${tempFileName}`;
    const gscFilePath = `${jobId}/${fileName}`;
    this.logger.debug({filePath, gscFilePath});
    fs.writeFileSync(filePath, response.data);
    await this.upload(filePath, gscFilePath);
    if (makePublic) await this.makePublic(gscFilePath);
    return gscFilePath;
  }

  async gcsUrlToDirectUrl(gcsUrl: string): Promise<any> {
    await this.makePublic(gcsUrl);
    return `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${gcsUrl}`;
  }
}
