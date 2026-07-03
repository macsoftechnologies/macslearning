const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module.js');
const { getModelToken } = require('@nestjs/mongoose');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const paymentModel = app.get(getModelToken('Payment'));
  const enrollmentModel = app.get(getModelToken('Enrollment'));
  
  try {
    const payment = await paymentModel.create({
        organizationId: '6a4627268c145ad097d65de4',
        studentId: '6a46274f8c145ad097d65de5',
        courseId: '6a463b6f65337f7e1279b2a4',
        amount: 7777,
        dummyPaymentId: 'DUMMY-TEST-' + Date.now(),
        status: 'COMPLETED',
        isPaid: true,
        paidAt: new Date(),
        createdBy: '6a46274f8c145ad097d65de5',
    });
    console.log('Payment created successfully', payment._id);
    
    const enrollment = await enrollmentModel.create({
      organizationId: '6a4627268c145ad097d65de4',
      studentId: '6a46274f8c145ad097d65de5',
      courseId: '6a463b6f65337f7e1279b2a4',
      paymentStatus: 'PAID',
      source: 'SELF_ENROLL',
      paymentId: payment._id
    });
    console.log('Enrollment created successfully', enrollment._id);
  } catch (e) {
    console.error('ERROR OCCURRED:', e);
  }
  process.exit(0);
}
bootstrap();
