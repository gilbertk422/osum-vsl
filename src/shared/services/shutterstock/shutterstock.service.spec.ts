import {Test, TestingModule} from '@nestjs/testing';
import {ShutterstockService} from './shutterstock.service';

describe('ShutterstockService', () => {
  let shutterService: ShutterstockService;

  beforeEach(async () => {
    process.env = Object.assign(process.env, {
      SHUTTERSTOCK_API_KEY: '50pkHXxE3O7NtAfOLi63THHijPFSk7DN',
      SHUTTERSTOCK_API_SECRET: 'tZemyXpHuPXA2P97'
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShutterstockService]
    }).compile();
    shutterService = module.get<ShutterstockService>(ShutterstockService);
  });

  it('should be defined', () => {
    expect(shutterService).toBeDefined();
  });

  describe('search assets by keywords', () => {
    it('should return array of assets', async () => {
      expect(
        await shutterService.search(['apple'], 'image', {
          videoOptions: {durationFrom: 5}
        })
      ).toBeInstanceOf(Array);
    }, 1200000);
  });
});
