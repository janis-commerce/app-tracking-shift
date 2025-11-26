import Storage from '../../../db/StorageService';
import {STAFF_AUTH} from '../../../constant';
import Crashlytics from '../../crashlytics';
import errorParser from '../../errorParser';

const getStaffAuthorizationData = () => {
	try {
		const {
			hasStaffAuthorization = false,
			expirationTime = 0,
			isExpired = false,
		} = Storage.get(STAFF_AUTH) || {};

		return {
			hasStaffAuthorization,
			isExpired: expirationTime <= Date.now() || isExpired,
		};
	} catch (error) {
		const parsedError = errorParser(error);
		Crashlytics.recordError(parsedError, 'Error getting staff authorization data');
		return {
			hasStaffAuthorization: false,
			isExpired: true,
		};
	}
};

export default getStaffAuthorizationData;
