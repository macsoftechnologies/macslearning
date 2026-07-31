import { Test, TestingModule } from '@nestjs/testing';
import { ManualGradesController } from './manual-grades.controller';

describe('ManualGradesController', () => {
  let controller: ManualGradesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManualGradesController],
    }).compile();

    controller = module.get<ManualGradesController>(ManualGradesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
