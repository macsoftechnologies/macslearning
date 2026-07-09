import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ContentService } from './content.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('ContentService - Lesson Checkpoints', () => {
  let service: ContentService;

  const mockLessonModel = {
    findOne: jest.fn(),
  } as any;
  const mockCourseModuleModel = {
    findOne: jest.fn(),
  } as any;

  const mockCheckpointModel: any = jest.fn((data) => ({
    save: jest.fn().mockResolvedValue({ _id: 'ck1', ...data }),
  }));
  mockCheckpointModel.find = jest.fn();
  mockCheckpointModel.findOne = jest.fn();

  const mockProgressModel = {
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  } as any;

  function MockCheckpointAnswerModel(this: any, data: any) {
    this.save = jest.fn().mockResolvedValue({ _id: 'ans1', ...data });
  }
  const mockCheckpointAnswerModel: any = MockCheckpointAnswerModel as any;
  mockCheckpointAnswerModel.findOneAndUpdate = jest.fn();
  mockCheckpointAnswerModel.find = jest.fn();
  mockCheckpointAnswerModel.prototype = { save: jest.fn() };
  const mockNotificationsService = { createNotification: jest.fn() } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        {
          provide: getModelToken('CourseModule'),
          useValue: mockCourseModuleModel,
        },
        { provide: getModelToken('Lesson'), useValue: mockLessonModel },
        {
          provide: getModelToken('LessonCheckpoint'),
          useValue: mockCheckpointModel,
        },
        {
          provide: getModelToken('LessonProgress'),
          useValue: mockProgressModel,
        },
        {
          provide: getModelToken('LessonCheckpointAnswer'),
          useValue: mockCheckpointAnswerModel,
        },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);

    jest.clearAllMocks();
  });

  it('creates a lesson checkpoint and returns saved checkpoint', async () => {
    const lesson = {
      _id: 'lesson1',
      moduleId: 'module1',
      organizationId: 'org1',
      courseId: 'course1',
    };
    mockLessonModel.findOne.mockResolvedValue(lesson);

    const dto = {
      questionText: 'What is 1+1?',
      timestampSeconds: 10,
      type: 'MCQ',
      options: [{ text: '2', isCorrect: true }],
    };

    const res = await service.createLessonCheckpoint(
      'org1',
      'course1',
      'lesson1',
      dto,
    );

    expect(mockLessonModel.findOne).toHaveBeenCalledWith({
      _id: 'lesson1',
      organizationId: 'org1',
      courseId: 'course1',
      isDeleted: false,
    });
    expect(mockCheckpointModel).toHaveBeenCalled();
    expect(res).toMatchObject({
      questionText: dto.questionText,
      timestampSeconds: dto.timestampSeconds,
    });
  });

  it('returns checkpoints list for a lesson', async () => {
    const list = [
      { _id: 'ck1', questionText: 'q1', timestampSeconds: 5 },
      { _id: 'ck2', questionText: 'q2', timestampSeconds: 15 },
    ];
    mockCheckpointModel.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(list),
    });

    const res = await service.getLessonCheckpoints(
      'org1',
      'course1',
      'lesson1',
    );
    expect(mockCheckpointModel.find).toHaveBeenCalledWith({
      organizationId: 'org1',
      courseId: 'course1',
      lessonId: 'lesson1',
      isDeleted: false,
    });
    expect(res).toEqual(list);
  });

  it('answers a checkpoint and marks progress when correct', async () => {
    const checkpoint = {
      _id: 'ck1',
      type: 'MCQ',
      options: [{ text: 'A', isCorrect: true }],
      required: true,
      lessonId: 'lesson1',
      courseId: 'course1',
    };
    mockCheckpointModel.findOne.mockResolvedValue(checkpoint);
    mockProgressModel.findOneAndUpdate.mockResolvedValue({ _id: 'prog1' });
    mockProgressModel.updateOne.mockResolvedValue({ nModified: 1 });

    const dto = { questionId: 'ck1', selectedOption: 'A' };
    const res = await service.answerLessonCheckpoint(
      'org1',
      'student1',
      'course1',
      'lesson1',
      'ck1',
      dto,
    );

    expect(mockCheckpointModel.findOne).toHaveBeenCalledWith({
      _id: 'ck1',
      organizationId: 'org1',
      lessonId: 'lesson1',
      courseId: 'course1',
      isDeleted: false,
    });
    expect(mockProgressModel.findOneAndUpdate).toHaveBeenCalled();
    expect(mockProgressModel.updateOne).toHaveBeenCalledWith(
      { _id: 'prog1' },
      { $addToSet: { checkpointPassedIds: checkpoint._id } },
    );
    expect(res).toEqual({ accepted: true, isCorrect: true });
  });
});
