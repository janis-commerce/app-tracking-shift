import Storage from '../../../db/StorageService';
import Crashlytics from '../../crashlytics';
import {WORKLOG_TYPES_DATA} from '../../../constant';
import errorParser from '../../errorParser';

/**
 * @description Get the worklog types data from the storage
 * @returns {Object} The worklog types data
 * @example
 * const {workLogTypes, expirationTime, isExpired} = getWorkLogTypesData();
 * console.log(workLogTypes); // [{id: 1, name: 'Test Type', referenceId: 'ref-123'}]
 * console.log(expirationTime); // 1718035200000
 * console.log(isExpired); // false
 */

const getWorkLogTypesData = () => {
	try {
		Crashlytics.log('getWorkLogTypesData');
		const {workLogTypes = [], expirationTime = 0} = Storage.get(WORKLOG_TYPES_DATA) || {};

		return {
			workLogTypes,
			expirationTime,
			isExpired: expirationTime <= Date.now() || !workLogTypes?.length,
		};
	} catch (error) {
		const parsedError = errorParser(error);
		Crashlytics.recordError(parsedError, 'Error getting worklogs data');
		return {
			workLogTypes: [],
			expirationTime: 0,
			isExpired: true,
		};
	}
};

export default getWorkLogTypesData;
