const INTERNAL_STATUS_CODE = 1;

class CustomError extends Error {
	/**
	 * @param {string} message - Human-readable error message
	 * @param {number|null} statusCode - HTTP status code for API errors, 1 for internal errors, null for connectivity errors
	 * @param {string|null} code - Error code: 'INTERNAL_ERROR', 'API_ERROR', or an inferred axios code (e.g. 'ERR_NETWORK', 'ECONNABORTED')
	 */
	constructor(message, statusCode, code) {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
	}

	/**
	 * Returns true if the error originated from a local validation (not an API or connectivity failure).
	 * Internal errors should never trigger offline data saving.
	 * @param {*} error - Any error value
	 * @returns {boolean}
	 */
	static isInternalError(error) {
		return error?.statusCode === INTERNAL_STATUS_CODE && error?.code === 'INTERNAL_ERROR';
	}

	/**
	 * Infers the axios error code from the error message when no HTTP response was received.
	 * @private
	 * @param {string} message
	 * @returns {string|null}
	 */
	static inferErrorCode(message = '') {
		if (/network error/i.test(message)) return 'ERR_NETWORK';
		if (/timeout/i.test(message)) return 'ECONNABORTED';
		if (/request aborted/i.test(message)) return 'ERR_CANCELED';
		if (/getaddrinfo|enotfound/i.test(message)) return 'ENOTFOUND';
		if (/econnrefused/i.test(message)) return 'ECONNREFUSED';
		if (/econnreset/i.test(message)) return 'ECONNRESET';
		return null;
	}

	/**
	 * Builds a CustomError from any error shape:
	 * - string → internal validation error (statusCode: 1, code: 'INTERNAL_ERROR')
	 * - object with statusCode → API error (code: 'API_ERROR')
	 * - object without statusCode → connectivity error (code inferred from message)
	 * @param {string|Object} error
	 * @returns {CustomError}
	 */
	static buildError(error) {
		if (typeof error === 'string') {
			return new CustomError(error, INTERNAL_STATUS_CODE, 'INTERNAL_ERROR');
		}
		const message = error?.result?.message || error?.message || '';
		const statusCode = error?.statusCode ?? null;
		const code = statusCode ? 'API_ERROR' : CustomError.inferErrorCode(message);
		return new CustomError(message, statusCode, code);
	}
}

export default CustomError;
