import { Test, TestingModule } from '@nestjs/testing';
import { ExamsService } from './exams.service';
import { getModelToken } from '@nestjs/mongoose';

describe('ExamsService - Short Answer Grading', () => {
  let service: ExamsService;

  const mockExamModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn() } as any;
  const mockQuestionModel = { find: jest.fn() } as any;
  const mockAttemptModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn(), prototype: { save: jest.fn() } } as any;
  const mockResultModel = { findOne: jest.fn(), create: jest.fn(), findOneAndUpdate: jest.fn() } as any;
  const mockQueue = { add: jest.fn() } as any;
  const mockNotificationsService = { createNotification: jest.fn() } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamsService,
        { provide: getModelToken('Exam'), useValue: mockExamModel },
        { provide: getModelToken('Question'), useValue: mockQuestionModel },
        { provide: getModelToken('Attempt'), useValue: mockAttemptModel },
        { provide: getModelToken('AssessmentResult'), useValue: mockResultModel },
        { provide: 'BullQueue_exams', useValue: mockQueue },
        { provide: require('../notifications/notifications.service').NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ExamsService>(ExamsService);
    jest.clearAllMocks();
  });

  it('grades a short answer and updates attempt/result', async () => {
    const exam = { _id: 'e1', totalMarks: 100, passingPercentage: 50, courseId: 'c1' };
    mockExamModel.findOne.mockResolvedValue(exam);

    const attempt = {
      _id: 'a1', examId: 'e1', studentId: 's1', organizationId: 'org1', answers: [ { questionId: 'q1', textAnswer: 'answer', isGraded: false } ], marksObtained: 0,
      save: jest.fn().mockResolvedValue(true),
    };
    mockAttemptModel.findOne.mockResolvedValue(attempt);

    mockResultModel.findOne.mockResolvedValue({ save: jest.fn() });

    const res = await service.gradeShortAnswer('org1', 'grader1', 'e1', 'a1', 'q1', 10);

    expect(res).toHaveProperty('marksObtained');
    expect(mockAttemptModel.findOne).toHaveBeenCalledWith({ _id: 'a1', examId: 'e1', organizationId: 'org1' });
    expect(mockExamModel.findOne).toHaveBeenCalledWith({ _id: 'e1', organizationId: 'org1', isDeleted: false });
  });
});
