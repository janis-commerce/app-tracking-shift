import Storage from '../../db/StorageService';
import {STAFF_GLOBAL_SETTINGS} from '../../constant';
import Crashlytics from '../crashlytics';
import errorParser from '../errorParser';

const getGlobalSettings = () => {
	try {
		const {
			hasStaffAuthorization = false,
			expirationTime = 0,
			isExpired = false,
			inactivityTimeout = 0,
		} = Storage.get(STAFF_GLOBAL_SETTINGS) || {};

		return {
			hasStaffAuthorization,
			inactivityTimeout,
			isExpired: expirationTime <= Date.now() || isExpired,
		};
	} catch (error) {
		const parsedError = errorParser(error);
		Crashlytics.recordError(parsedError, 'Error getting staff global settings');
		return {
			hasStaffAuthorization: false,
			isExpired: true,
			inactivityTimeout: 0,
		};
	}
};

export default getGlobalSettings;
