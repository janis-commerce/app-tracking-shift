export const INTERNAL_CODE = 'INTERNAL_ERROR';

class CustomError extends Error {
	/**
	 * @param {string} message - Human-readable error message
	 * @param {string|null} code - Error code: INTERNAL_CODE, 'API_ERROR', or an inferred axios code (e.g. 'ERR_NETWORK', 'ECONNABORTED')
	 * @param {number|null} statusCode - HTTP status code for API errors, null for internal/connectivity errors
	 */
	constructor(message, code, statusCode) {
		super(message);
		this.code = code;
		this.statusCode = statusCode;
	}

	/**
	 * Returns true if the error originated from a local validation (not an API or connectivity failure).
	 * Internal errors should never trigger offline data saving.
	 * @param {*} error - Any error value
	 * @returns {boolean}
	 */
	static isInternalError(error) {
		return error?.code === INTERNAL_CODE;
	}
}

export default CustomError;
