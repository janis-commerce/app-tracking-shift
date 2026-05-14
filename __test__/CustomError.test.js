import CustomError from '../lib/CustomError';

describe('CustomError', () => {
	describe('isInternalError', () => {
		it('should return true when receives a CustomError built from a string', () => {
			const error = CustomError.buildError('must provide a valid activity');
			expect(CustomError.isInternalError(error)).toBe(true);
		});

		it('should return false when receives a CustomError built from an API error', () => {
			const error = CustomError.buildError({statusCode: 404, result: {message: 'Not found'}});
			expect(CustomError.isInternalError(error)).toBe(false);
		});

		it('should return false when receives a CustomError built from a network error', () => {
			const error = CustomError.buildError({result: {message: 'Network Error'}});
			expect(CustomError.isInternalError(error)).toBe(false);
		});

		it('should return false when receives a CustomError built from a timeout error', () => {
			const error = CustomError.buildError({result: {message: 'timeout of 5000ms exceeded'}});
			expect(CustomError.isInternalError(error)).toBe(false);
		});

		it('should return false when receives a raw API error object', () => {
			expect(CustomError.isInternalError({statusCode: 400, result: {message: 'Bad request'}})).toBe(false);
		});

		it('should return false when receives a raw connectivity error object', () => {
			expect(CustomError.isInternalError({result: {message: 'Network Error'}})).toBe(false);
		});

		it('should return false when receives null', () => {
			expect(CustomError.isInternalError(null)).toBe(false);
		});

		it('should return false when receives undefined', () => {
			expect(CustomError.isInternalError(undefined)).toBe(false);
		});
	});
});
