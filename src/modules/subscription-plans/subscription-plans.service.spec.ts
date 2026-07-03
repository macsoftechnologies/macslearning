import { NotFoundException } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';

describe('SubscriptionPlansService', () => {
  let service: SubscriptionPlansService;
  let model: any;

  beforeEach(() => {
    model = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
    };

    service = new SubscriptionPlansService(model);
  });

  it('creates a subscription plan with default flags', async () => {
    const createdPlan = {
      _id: 'plan-1',
      name: 'Basic',
      code: 'basic',
      price: 29,
      currency: 'USD',
      isActive: true,
      isDeleted: false,
    };

    model.create.mockResolvedValue(createdPlan);

    await expect(
      service.createSubscriptionPlan({
        name: 'Basic',
        code: 'basic',
        price: 29,
        currency: 'USD',
      }),
    ).resolves.toEqual(createdPlan);

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Basic',
        code: 'basic',
        price: 29,
        currency: 'USD',
        isActive: true,
        isDeleted: false,
      }),
    );
  });

  it('throws when updating a non-existent plan', async () => {
    model.findOneAndUpdate.mockResolvedValue(null);

    await expect(service.updateSubscriptionPlan('missing-id', { name: 'Pro' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
