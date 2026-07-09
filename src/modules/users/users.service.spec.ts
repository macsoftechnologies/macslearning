import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: jest.fn(),
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('normalizes blank mobile values to undefined when creating a user', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const userModel = service['userModel'] as any;
    userModel.findOne = jest.fn().mockResolvedValue(null);

    const userCtor = jest
      .fn()
      .mockImplementation((data: any) => ({ ...data, save, _id: 'user1' }));
    userModel.mockImplementation(userCtor);

    const result = await service.createUser('org1', {
      email: 'student@example.com',
      password: 'secret123',
      fullName: 'Student User',
      userType: 'ORG_USER',
      mobile: '   ',
    });

    expect(result.userId).toBe('user1');
    expect(userCtor).toHaveBeenCalledWith(
      expect.objectContaining({ mobile: undefined }),
    );
  });
});
