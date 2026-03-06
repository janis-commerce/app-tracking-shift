export {default as isApiError} from './isApiError';

export {default as isInternetReachable} from './isInternetReachable';

export const generateRandomId = () => Math.random().toString(32).slice(2);

export const isFunction = (fn) => !!({}.toString.call(fn) === '[object Function]');

export const isObject = (obj) => !!(obj && obj.constructor === Object);

export const isEmptyObject = (obj) => isObject(obj) && !Object.keys(obj).length;

export const promiseWrapper = (promise) =>
	promise.then((data) => [data, null]).catch((error) => Promise.resolve([null, error]));

export const isArray = (arr) => Array.isArray(arr);

export const isEmptyArray = (arr) => isArray(arr) && !arr.length;

export const reverseArray = (arr) => arr.slice().reverse();

export const isNumber = (num) => typeof num === 'number' && !Number.isNaN(Number(num));

export const isValidObject = (obj) => isObject(obj) && !!Object.keys(obj).length;

export const isValidString = (str) => typeof str === 'string' && str.length > 0;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const isIsoStringDate = (str) => ISO_DATE_REGEX.test(str);

export const isValidDate = (date = '') => {
	if (isNumber(date) && date > 0) {
		const dateTime = new Date(date).getTime();
		return !Number.isNaN(dateTime);
	}
	if (!isValidString(date)) return false;

	if (!isIsoStringDate(date)) return false;

	const dateTime = new Date(date).getTime();
	return !Number.isNaN(dateTime);
};

export const parseToISOString = (date = '') => {
	if (isNumber(date) && date > 0) return new Date(date).toISOString();
	if (!isValidString(date)) return '';

	return date;
};
