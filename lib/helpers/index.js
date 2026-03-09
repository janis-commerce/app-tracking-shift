import {isNumber, isString} from '@janiscommerce/apps-helpers';

export {default as isApiError} from './isApiError';

export {default as isInternetReachable} from './isInternetReachable';

export const reverseArray = (arr) => arr.slice().reverse();

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isIsoStringDate = (str) => ISO_DATE_REGEX.test(str);

export const isValidDate = (date = '') => {
	if (isNumber(date) && date > 0) {
		const dateTime = new Date(date).getTime();
		return isNumber(dateTime);
	}
	if (!isString(date) || !date?.length) return false;

	if (!isIsoStringDate(date)) return false;

	const dateTime = new Date(date).getTime();
	return isNumber(dateTime);
};

export const parseToISOString = (date = '') => {
	if (isNumber(date) && date > 0) return new Date(date).toISOString();
	if (!isString(date) || !date?.length) return '';

	return date;
};
