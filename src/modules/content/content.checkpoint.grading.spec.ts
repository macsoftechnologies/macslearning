import { Test, TestingModule } from '@nestjs/testing';
import { ContentService } from './content.service';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationsService } from '../notifications/notifications.service';

describe('ContentService - Checkpoint grading', () => {
  let service: ContentService;

  const mockModuleModel = {} as any;
  const mockLessonModel = {} as any;
  const mockCheckpointModel = {} as any;
  const mockProgressModel = { findOneAndUpdate: jest.fn() } as any;
  const mockCheckpointAnswerModel = { findOneAndUpdate: jest.fn(), find: jest.fn() } as any;
  const mockNotificationsService = { createNotification: jest.fn() } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: getModelToken('CourseModule'), useValue: mockModuleModel },
        { provide: getModelToken('Lesson'), useValue: mockLessonModel },
        { provide: getModelToken('LessonCheckpoint'), useValue: mockCheckpointModel },
        { provide: getModelToken('LessonProgress'), useValue: mockProgressModel },
        { provide: getModelToken('LessonCheckpointAnswer'), useValue: mockCheckpointAnswerModel },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
    jest.clearAllMocks();
  });

  it('grades a checkpoint answer and awards progress + sends notification', async () => {
    const ans = { _id: 'ans1', studentId: 's1', courseId: 'c1', lessonId: 'l1', checkpointId: 'cp1', organizationId: 'org1' };
    mockCheckpointAnswerModel.findOneAndUpdate.mockResolvedValue(ans);
    mockProgressModel.findOneAndUpdate.mockResolvedValue({});

    const res = await service.gradeCheckpointAnswer('org1', 'grader1', 'ans1', 5);

    expect(mockCheckpointAnswerModel.findOneAndUpdate).toHaveBeenCalled();
    expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    expect(res).toEqual(ans);
  });
});
