import { Test, TestingModule } from '@nestjs/testing';
import { ManualGradesService } from './manual-grades.service';

describe('ManualGradesService', () => {
  let service: ManualGradesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManualGradesService],
    }).compile();

    service = module.get<ManualGradesService>(ManualGradesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
