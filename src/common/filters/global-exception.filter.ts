import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exceptionResponse;
      } else {
        message = exceptionResponse as string;
      }
    } else if (this.isMongoDuplicateKeyError(exception)) {
      status = HttpStatus.BAD_REQUEST;
      message = this.getDuplicateKeyMessage(exception as any);
    } else if (exception instanceof Error) {
      message = 'Unexpected server error';
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      error: status === HttpStatus.BAD_REQUEST ? 'Bad Request' : exception instanceof HttpException ? exception.name : 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  }

  private isMongoDuplicateKeyError(exception: unknown): boolean {
    return (
      exception instanceof Error &&
      (/E11000/.test(exception.message) ||
        (exception as any).code === 11000 ||
        (exception as any).name === 'MongoServerError')
    );
  }

  private getDuplicateKeyMessage(exception: any): string {
    const rawMessage = exception.message || '';
    const keyValue = exception.keyValue || {};
    const keys = Object.keys(keyValue);
    const field = keys[0] || this.parseIndexField(rawMessage);
    const collectionName = exception.collection?.name || this.parseCollectionName(rawMessage).toLowerCase();

    if (collectionName.includes('organization')) {
      if (/code/i.test(field)) return 'Organization code already exists';
      if (/name/i.test(field)) return 'Organization name already exists';
      if (/email/i.test(field)) return 'Organization admin email already exists';
    }

    if (collectionName.includes('payment')) {
      if (/dummyPaymentId/i.test(field)) return 'Payment dummyPaymentId already exists';
      if (/invoiceNumber/i.test(field)) return 'Payment invoice number already exists';
    }

    if (collectionName.includes('certificate')) {
      if (/certificateNumber/i.test(field)) return 'Certificate number already exists';
      return 'Certificate for this student and course already exists';
    }

    if (collectionName.includes('user')) {
      if (/email/i.test(field)) return 'User with this email already exists';
    }

    if (collectionName.includes('subscription')) {
      if (/code/i.test(field)) return 'Subscription plan code already exists';
    }

    if (/email/i.test(field)) return 'Email already exists';
    if (/code/i.test(field)) return 'Code already exists';
    if (/name/i.test(field)) return 'Name already exists';

    return 'Duplicate key error';
  }

  private parseIndexField(message: string): string {
    const match = message.match(/index:\s*([^\s]+)\s*dup key/i);
    return match?.[1] ?? '';
  }

  private parseCollectionName(message: string): string {
    const match = message.match(/collection:\s*[^.]+\.([^.\s]+)\s/i);
    return match?.[1] ?? '';
  }
}
