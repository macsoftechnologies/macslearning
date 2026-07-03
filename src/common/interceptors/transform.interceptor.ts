import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        // If data is already wrapped (e.g. from createPaginatedResponse)
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return {
            success: true,
            data: data.data,
            meta: data.meta
          };
        }
        
        // If data has its own success wrapper (e.g. {success: true, enrollment})
        if (data && typeof data === 'object' && 'success' in data) {
          const { success, message, ...restData } = data;
          return {
            success: success,
            message: message,
            data: (Object.keys(restData).length === 1 && restData.data !== undefined) ? restData.data : restData
          };
        }

        // Wrap plain arrays/objects
        return {
          success: true,
          data: data,
        };
      }),
    );
  }
}
