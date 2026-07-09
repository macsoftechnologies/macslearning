import { Test, TestingModule } from '@nestjs/testing';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { getModelToken } from '@nestjs/mongoose';
const request = require('supertest');
import { INestApplication } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MongooseModule } from '@nestjs/mongoose';

describe('ExamsController - grading endpoints (integration-like)', () => {
  let app: INestApplication;
  const mockExamsService = {
    getShortAnswers: jest.fn(),
    gradeShortAnswer: jest.fn(),
  } as any;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ExamsController],
      providers: [{ provide: ExamsService, useValue: mockExamsService }],
    });

    moduleBuilder.overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context: any) => {
        const req = context.switchToHttp().getRequest();
        req.user = {
          organizationId: 'org1',
          userId: 'u1',
          userType: 'FACULTY',
        };
        return true;
      },
    });
    moduleBuilder
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET shortanswers returns list', async () => {
    mockExamsService.getShortAnswers.mockResolvedValue([
      { questionId: 'q1', textAnswer: 'ans' },
    ]);
    const res = await request(app.getHttpServer())
      .get('/exams/e1/attempts/a1/shortanswers')
      .set('Authorization', 'Bearer faketoken');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ questionId: 'q1', textAnswer: 'ans' }]);
  });

  it('PATCH grade returns success', async () => {
    mockExamsService.gradeShortAnswer.mockResolvedValue({
      message: 'Answer graded',
    });
    const res = await request(app.getHttpServer())
      .patch('/exams/e1/attempts/a1/grade-answer')
      .send({ questionId: 'q1', marks: 5 })
      .set('Authorization', 'Bearer faketoken');
    expect(res.status).toBe(200);
  });
});
