import { Test, TestingModule } from '@nestjs/testing';
import { VimeoController } from './vimeo.controller';

describe('VimeoController', () => {
  let controller: VimeoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VimeoController],
    }).compile();

    controller = module.get<VimeoController>(VimeoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
