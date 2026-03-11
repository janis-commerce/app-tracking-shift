import {isNumber, isString} from '@janiscommerce/apps-helpers';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isIsoStringDate = (str) => ISO_DATE_REGEX.test(str);

/**
 * @description Checks if a date is valid
 * @param {string} date - The date to check (ISO 8601 string or milliseconds since epoch)
 * @returns {boolean} - True if the date is valid, false otherwise
 */

const isValidDate = (date = '') => {
	if (isNumber(date) && date > 0) {
		const dateTime = new Date(date).getTime();
		return isNumber(dateTime);
	}
	if (!isString(date) || !date?.length) return false;

	if (!isIsoStringDate(date)) return false;

	const dateTime = new Date(date).getTime();
	return isNumber(dateTime);
};

export default isValidDate;
