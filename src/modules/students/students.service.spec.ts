import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudentsService } from './students.service';

describe('StudentsService', () => {
  let service: StudentsService;
  let userModel: any;

  beforeEach(() => {
    userModel = {
      findOne: jest.fn(),
    };
    service = new StudentsService(userModel);
  });

  it('scopes student approval to the caller organization', async () => {
    const student = {
      _id: 'student-1',
      organizationId: 'org-a',
      userType: 'STUDENT',
      status: 'PENDING',
      save: jest.fn().mockResolvedValue(true),
    };
    userModel.findOne.mockResolvedValue(student);

    await service.approveStudent('student-1', 'admin-1', 'org-a');

    expect(userModel.findOne).toHaveBeenCalledWith({
      _id: 'student-1',
      organizationId: 'org-a',
      userType: 'STUDENT',
      status: 'PENDING',
    });
  });

  it('rejects approval attempts from a different organization', async () => {
    userModel.findOne.mockResolvedValue(null);

    await expect(service.approveStudent('student-1', 'admin-1', 'org-b')).rejects.toThrow(NotFoundException);
  });
});
