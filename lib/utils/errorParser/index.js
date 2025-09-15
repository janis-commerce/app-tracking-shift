/**
 * @description Parse the error to a readable format
 * @param {Error} error - The error to parse
 * @returns {Error} The parsed error
 */

const errorParser = (error = {}) => {
	if (error instanceof Error) return error;

	const {result = {}, message} = error;
	const reportedError = result?.message || message;

	return new Error(reportedError);
};

export default errorParser;
