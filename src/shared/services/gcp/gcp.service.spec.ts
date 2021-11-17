import {GcpService} from './gcp.service';
import {HttpService} from '@nestjs/common';

describe('VideoRenderProcessor', () => {
  let gcpService: GcpService;
  let httpService: HttpService;

  beforeEach(async () => {
    httpService = new HttpService();
    gcpService = new GcpService(httpService);
    process.env = Object.assign(process.env, {
      GCS_BUCKET: 'vsl',
      GOOGLE_APPLICATION_CREDENTIALS: 'gcs_credential/cesar-osum-staging-281014-95179ae63068.json'
    });
  });

  describe('upload', () => {
    it('should return uploaded url', async () => {
      expect(await gcpService.upload('./tmp/.gitignore', 'test')).toReturn();
    }, 1200000);
  });
});
