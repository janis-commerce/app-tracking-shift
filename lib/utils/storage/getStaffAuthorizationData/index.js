import Storage from '../../../db/StorageService';
import {STAFF_AUTH} from '../../../constant';
import Crashlytics from '../../crashlytics';

const getStaffAuthorizationData = () => {
	try {
		const staffAuthRaw = Storage.getString(STAFF_AUTH);
		const parsedAuth = JSON.parse(staffAuthRaw);
		const {hasStaffAuthorization = false, expirationTime = 0, isExpired = false} = parsedAuth;

		return {
			hasStaffAuthorization,
			isExpired: expirationTime <= Date.now() || isExpired,
		};
	} catch (error) {
		Crashlytics.recordError(error, 'Error getting staff authorization data');
		return {
			hasStaffAuthorization: false,
			isExpired: true,
		};
	}
};

export default getStaffAuthorizationData;
