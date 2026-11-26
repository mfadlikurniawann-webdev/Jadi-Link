import { STATUS_CODES } from 'node:http';
import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { HttpErrorResponseDto } from './http-error-response.dto';

export function ApiErrors(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: STATUS_CODES[status] ?? 'Error',
        type: HttpErrorResponseDto,
        ...(status === 429
          ? {
              headers: {
                'Retry-After': {
                  description: 'Seconds until a retry is allowed',
                  schema: { type: 'integer' },
                },
              },
            }
          : {}),
      }),
    ),
  );
}
