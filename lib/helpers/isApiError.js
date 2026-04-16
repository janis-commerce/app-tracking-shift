const isApiError = (error) => {
	const {result, statusCode = null} = error || {};

	return result?.message && Boolean(statusCode);
};

export default isApiError;
