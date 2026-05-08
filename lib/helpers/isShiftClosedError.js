/**
 * @description Check if the error is a shift closed error
 * @param {Error} error - The error to check
 * @returns {boolean} true if the error is a shift closed error, false otherwise
 */

const isShiftClosedError = (error) => {
	const message = error?.result?.message || error?.message || '';
	return /No opened shift found for user/i.test(message);
};

export default isShiftClosedError;
