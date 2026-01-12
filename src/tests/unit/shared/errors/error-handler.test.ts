import { AppError, ErrorCode } from '../../../../shared/errors/error-handler';

describe('AppError', () => {
  describe('constructor', () => {
    it('should create error with correct properties', () => {
      const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Test error message', 400);

      expect(error.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(400);
      expect(error).toBeInstanceOf(Error);
    });

    it('should use default status code 400 if not provided', () => {
      const error = new AppError(ErrorCode.INTERNAL_SERVER_ERROR, 'Test error');

      expect(error.statusCode).toBe(400); // Default is 400, not 500
    });
  });

  describe('toJSON', () => {
    it('should return correct JSON format', () => {
      const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Test error message', 400);
      const json = error.toJSON();

      expect(json).toEqual({
        success: false,
        error_code: 'VALIDATION_ERROR',
        message: 'Test error message',
      });
    });
  });

  describe('ErrorCode enum', () => {
    it('should have all required error codes', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBeDefined();
      expect(ErrorCode.UNAUTHORIZED).toBeDefined();
      expect(ErrorCode.TENANT_INACTIVE).toBeDefined();
      expect(ErrorCode.SHIPMENT_NOT_FOUND).toBeDefined();
      expect(ErrorCode.INTERNAL_SERVER_ERROR).toBeDefined();
      expect(ErrorCode.SHIPMENT_NOT_FOUND).toBeDefined();
      expect(ErrorCode.INVALID_SHIPMENT_STATE).toBeDefined();
      expect(ErrorCode.DRIVER_NOT_FOUND).toBeDefined();
      expect(ErrorCode.TENANT_NOT_FOUND).toBeDefined();
      expect(ErrorCode.IDEMPOTENCY_KEY_REQUIRED).toBeDefined();
      expect(ErrorCode.DUPLICATE_REQUEST).toBeDefined();
    });
  });
});

