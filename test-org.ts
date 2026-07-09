import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { OrganizationsService } from './src/modules/organizations/organizations.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const orgService = app.get(OrganizationsService);

  const org = await orgService.createOrganization({
    name: 'Test Full Org',
    code: 'TESTFULL',
    contactEmail: 'hello@test.com',
    contactPhone: '1234567890',
    address: '123 Main St',
    subscriptionPlanId: 'a4e1342c-3e94-4a94-b043-27aeef95cd60', // Valid plan ID from db
    adminFullName: 'Admin',
    adminEmail: 'admin@test.com',
    adminPassword: 'password123'
  });

  console.log('Created Org:', org);
  await app.close();
}

bootstrap().catch(console.error);
