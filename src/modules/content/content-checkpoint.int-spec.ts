import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { ContentController } from './content.controller';
import { LessonCheckpointController } from './lesson-checkpoint.controller';
import { ContentService } from './content.service';

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { organizationId: 'org1', userId: 'student1', userType: 'STUDENT' };
    return true;
  }
}
class MockRolesGuard implements CanActivate { canActivate() { return true; } }

describe('Checkpoint Controller (integration)', () => {
  let app: INestApplication;

  const mockCourseModuleModel = {} as any;
  const mockLessonModel = { findOne: jest.fn() } as any;

  const mockCheckpointModel: any = jest.fn((data) => ({ save: jest.fn().mockResolvedValue({ _id: 'ck1', ...data }) }));
  mockCheckpointModel.find = jest.fn();
  mockCheckpointModel.findOne = jest.fn();

  const mockProgressModel = { findOneAndUpdate: jest.fn(), updateOne: jest.fn() } as any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ContentController, LessonCheckpointController],
      providers: [
        ContentService,
        { provide: getModelToken('CourseModule'), useValue: mockCourseModuleModel },
        { provide: getModelToken('Lesson'), useValue: mockLessonModel },
        { provide: getModelToken('LessonCheckpoint'), useValue: mockCheckpointModel },
        { provide: getModelToken('LessonProgress'), useValue: mockProgressModel },
      ],
    })
      .overrideGuard(require('../../common/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue(new MockAuthGuard())
      .overrideGuard(require('../../common/guards/roles.guard').RolesGuard)
      .useValue(new MockRolesGuard())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /courses/:courseId/lessons/:lessonId/checkpoints creates checkpoint', async () => {
    const lesson = { _id: 'lesson1', moduleId: 'module1', organizationId: 'org1', courseId: 'course1' };
    mockLessonModel.findOne.mockResolvedValue(lesson);

    const dto = { questionText: 'Q?', timestampSeconds: 10, type: 'MCQ', options: [{ text: 'A', isCorrect: true }] };
    const res = await request(app.getHttpServer())
      .post('/courses/course1/lessons/lesson1/checkpoints')
      .send(dto)
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.questionText).toEqual(dto.questionText);
  });

  it('GET /courses/:courseId/lessons/:lessonId/checkpoints returns list', async () => {
    const list = [{ _id: 'ck1', questionText: 'q1', timestampSeconds: 5 }, { _id: 'ck2', questionText: 'q2', timestampSeconds: 15 }];
    mockCheckpointModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(list) });

    const res = await request(app.getHttpServer())
      .get('/courses/course1/lessons/lesson1/checkpoints')
      .expect(200);

    expect(res.body).toEqual(list);
  });

  it('POST /courses/:courseId/lessons/:lessonId/checkpoints/:checkpointId/answer accepts correct', async () => {
    const checkpoint = { _id: 'ck1', type: 'MCQ', options: [{ text: 'A', isCorrect: true }], required: true, lessonId: 'lesson1', courseId: 'course1' };
    mockCheckpointModel.findOne.mockResolvedValue(checkpoint);
    mockProgressModel.findOneAndUpdate.mockResolvedValue({ _id: 'prog1' });
    mockProgressModel.updateOne.mockResolvedValue({ nModified: 1 });

    const dto = { questionId: 'ck1', selectedOption: 'A' };
    const res = await request(app.getHttpServer())
      .post('/courses/course1/lessons/lesson1/checkpoints/ck1/answer')
      .send(dto)
      .expect(201);

    expect(res.body).toEqual({ accepted: true, isCorrect: true });
  });
});
