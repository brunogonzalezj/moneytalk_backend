export interface ErrorDetail {
  field?: string;
  message: string;
}

/**
 * Error with an HTTP status and a stable code the frontend can rely on.
 * Anything thrown that is not an AppError becomes a generic 500.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[]
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: ErrorDetail[]) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: ErrorDetail[]) {
    return new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos', details);
  }

  static unauthorized(message = 'No autorizado') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'No tienes permiso para realizar esta acción') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }

  static tooManyRequests(message = 'Demasiadas solicitudes, intenta más tarde') {
    return new AppError(429, 'TOO_MANY_REQUESTS', message);
  }

  static badGateway(message: string, code = 'BAD_GATEWAY') {
    return new AppError(502, code, message);
  }

  static serviceUnavailable(message: string) {
    return new AppError(503, 'SERVICE_UNAVAILABLE', message);
  }
}
