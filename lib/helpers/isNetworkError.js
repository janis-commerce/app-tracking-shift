const isNetworkError = (error) => !!error && /network error/i.test(error?.message);

export default isNetworkError;
