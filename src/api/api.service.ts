import {Injectable} from '@nestjs/common';
import {GcpService} from '../shared/services/gcp/gcp.service';
import {Image} from '../shared/shared.interface';

@Injectable()
export class ApiService {
  constructor(private readonly gcpService: GcpService) {}

  public async uploadFiles(jobId: string, uploadedFiles: []) {
    //upload productimages to GCP
    if (uploadedFiles['productimages'] && uploadedFiles['productimages'].length) {
      const promises = uploadedFiles['productimages'].map(item => {
        this.gcpService.upload(`${item.path}`, `${jobId}/${item.filename}`);
      });

      await Promise.all(promises);
    }

    //upload guaranteeimages to GCP
    if (uploadedFiles['guaranteeimages'] && uploadedFiles['guaranteeimages'].length) {
      const promises = uploadedFiles['guaranteeimages'].map(item => {
        this.gcpService.upload(`${item.path}`, `${jobId}/${item.filename}`);
      });
      await Promise.all(promises);
    }

    //upload backgroundmusic to GCP
    if (uploadedFiles['backgroundmusic'] && uploadedFiles['backgroundmusic'].length) {
      await this.gcpService.upload(
        `${uploadedFiles['backgroundmusic'][0].path}`,
        `${jobId}/${uploadedFiles['backgroundmusic'][0].filename}`
      );
    }
  }
}
