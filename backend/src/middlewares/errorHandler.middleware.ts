import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { logger } from '../utils/logger';

@Catch()
export class ErrorHandlerMiddleware implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let body: Record<string, unknown>;
    if (exception instanceof HttpException && typeof exception.getResponse() === 'object' && exception.getResponse() !== null) {
      body = exception.getResponse() as Record<string, unknown>;
    } else {
      body = { message: exception instanceof Error ? exception.message : 'Unexpected error' };
    }
    logger.error(body.message as string, exception);
    response.status(status).json({ success: false, statusCode: status, ...body });
  }
}
