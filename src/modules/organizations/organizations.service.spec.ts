import { NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let orgModel: any;
  let planModel: any;

  beforeEach(() => {
    orgModel = {
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    planModel = {
      findOne: jest.fn(),
    };

    service = new OrganizationsService(orgModel, planModel);
  });

  it('resolves organization limits from a subscription plan when creating an organization', async () => {
    planModel.findOne.mockResolvedValue({
      _id: 'plan-1',
      code: 'BASIC',
      billingCycle: 'YEARLY',
      features: { maxStudents: 100, maxStorageGB: 5 },
    });

    orgModel.create.mockResolvedValue({ ok: true });

    const result = await service.createOrganization({
      name: 'Acme Org',
      code: 'ACME',
      subscriptionConfig: {
        planType: 'basic',
      },
    });

    expect(planModel.findOne).toHaveBeenCalledWith({ code: 'BASIC' });
    expect(orgModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionConfig: expect.objectContaining({
          planId: 'plan-1',
          planType: 'BASIC',
          maxStudents: 100,
          maxStorageGB: 5,
          billingCycle: 'YEARLY',
        }),
      }),
    );
    expect(result).toEqual({ ok: true });
    expect(
      orgModel.create.mock.calls[0][0].subscriptionConfig.expiresAt,
    ).toBeInstanceOf(Date);
  });
});
