import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
const request = require('supertest');
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { organizationId: 'org1', userId: 'u1', userType: 'FACULTY' };
    return true;
  }
}
class MockRolesGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

describe('AssignmentsController - grading', () => {
  let app: INestApplication;
  const mockAssignmentsService = { gradeSubmission: jest.fn() } as any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        { provide: AssignmentsService, useValue: mockAssignmentsService },
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

  it('PATCH grade as FACULTY returns success', async () => {
    mockAssignmentsService.gradeSubmission.mockResolvedValue({
      _id: 's1',
      marksObtained: 80,
    });
    const res = await request(app.getHttpServer())
      .patch('/courses/c1/assignments/submissions/s1/grade')
      .send({ marksObtained: 80, feedback: 'Good' })
      .expect(200);

    expect(mockAssignmentsService.gradeSubmission).toHaveBeenCalledWith(
      'org1',
      's1',
      'u1',
      'FACULTY',
      expect.any(Object),
    );
    expect(res.body.marksObtained).toBe(80);
  });
});
