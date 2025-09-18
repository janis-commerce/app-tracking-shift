import Crashlytics from '../../crashlytics';
import {STAFF_AUTH, STAFF_MS_AUTHORIZATION_EXPIRATION_TIME} from '../../../constant';
import Storage from '../../../db/StorageService';
import Shift from '../../../Shift';
import {getStaffAuthorizationData} from '../../storage';
import errorParser from '../../errorParser';

const isAuthorizedToUseStaffMS = async () => {
	try {
		Crashlytics.log('checking staff MS authorization');
		const {hasStaffAuthorization, isExpired} = getStaffAuthorizationData();

		if (hasStaffAuthorization && !isExpired) return true;
		if (!hasStaffAuthorization && !isExpired) return false;

		const isAuthorized = await Shift.checkStaffMSAuthorization();

		const data = {
			hasStaffAuthorization: isAuthorized,
			expirationTime: Date.now() + STAFF_MS_AUTHORIZATION_EXPIRATION_TIME,
			isExpired: false,
		};

		Storage.set(STAFF_AUTH, JSON.stringify(data));

		return isAuthorized;
	} catch (error) {
		const parsedError = errorParser(error);
		Crashlytics.recordError(parsedError, 'Error checking staff MS authorization');
		const data = {
			hasStaffAuthorization: false,
			expirationTime: 0,
			isExpired: true,
		};
		Storage.set(STAFF_AUTH, JSON.stringify(data));

		return Promise.reject(parsedError);
	}
};

export default isAuthorizedToUseStaffMS;
