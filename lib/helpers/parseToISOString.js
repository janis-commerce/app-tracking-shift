import {isNumber, isString} from '@janiscommerce/apps-helpers';

/**
 * @description Parses a date to an ISO 8601 string
 * @param {string} date - The date to parse (ISO 8601 string or milliseconds since epoch)
 * @returns {string} - The ISO 8601 string
 */

const parseToISOString = (date = '') => {
	if (isNumber(date) && date > 0) return new Date(date).toISOString();
	if (!isString(date) || !date?.length) return '';

	return date;
};

export default parseToISOString;
