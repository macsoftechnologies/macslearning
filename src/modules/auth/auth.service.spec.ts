import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { Organization } from '../organizations/schemas/org.schema';
import { User } from '../users/schemas/user.schema';
import { OrganizationsService } from '../organizations/organizations.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(Organization.name),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('secret'),
          },
        },
        {
          provide: OrganizationsService,
          useValue: {
            createOrganization: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('requires organizationCode for non-super-admin login', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);

    const user = {
      _id: 'user1',
      email: 'student@example.com',
      passwordHash,
      status: 'ACTIVE',
      userType: 'STUDENT',
      organizationId: 'org1',
      refreshTokens: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const userModel = service['userModel'] as any;
    userModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.login({
        email: 'student@example.com',
        password: 'secret123',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects login when the provided organization does not match the user account organization', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    const userModel = service['userModel'] as any;
    const orgModel = service['organizationModel'] as any;

    orgModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'org2', code: 'ORG2' }),
    });

    userModel.findOne.mockImplementationOnce(() => ({
      select: jest.fn().mockResolvedValue(null),
    }));

    userModel.findOne.mockImplementationOnce(() => ({
      select: jest.fn().mockResolvedValue({
        _id: 'user1',
        email: 'student@example.com',
        passwordHash,
        status: 'ACTIVE',
        userType: 'STUDENT',
        organizationId: 'org1',
        refreshTokens: [],
        save: jest.fn().mockResolvedValue(true),
      }),
    }));

    await expect(
      service.login({
        email: 'student@example.com',
        password: 'secret123',
        organizationCode: 'org2',
      } as any),
    ).rejects.toThrow(UnauthorizedException);
  });
});
