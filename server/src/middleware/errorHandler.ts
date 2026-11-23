import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler: ErrorRequestHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  if ((err as any).name === 'MulterError' || (err as any).code === 'LIMIT_FILE_SIZE' || err.message?.includes('images are allowed')) {
    statusCode = 400;
  }
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    status: statusCode >= 500 ? 'error' : 'fail',
    message: err.message || 'Internal Server Error',
    ...(isProduction ? {} : { stack: err.stack })
  });
};
