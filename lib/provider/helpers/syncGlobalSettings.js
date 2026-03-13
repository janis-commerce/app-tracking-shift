import Crashlytics from '../../utils/crashlytics';
import {STAFF_GLOBAL_SETTINGS, STAFF_GLOBAL_SETTINGS_EXPIRATION_TIME} from '../../constant';
import Storage from '../../db/StorageService';
import Shift from '../../Shift';
import {getGlobalSettings} from '../../utils/storage';
import errorParser from '../../utils/errorParser';

/**
 * Sync the global settings
 * @returns {Promise<null>} null if the global settings are not expired, otherwise returns a rejected promise with the error
 * @throws {Error} if the global settings download fails
 */

const syncGlobalSettings = async () => {
	const {isExpired} = getGlobalSettings();

	if (!isExpired) return null;

	try {
		Crashlytics.log('[ShiftTracking.syncGlobalSettings] fetching global staff settings');
		const {enabledShiftAndWorkLog, inactivityTimeout} = await Shift.getGlobalStaffSettings();

		Storage.set(STAFF_GLOBAL_SETTINGS, {
			hasStaffAuthorization: enabledShiftAndWorkLog,
			expirationTime: Date.now() + STAFF_GLOBAL_SETTINGS_EXPIRATION_TIME,
			isExpired: false,
			inactivityTimeout,
		});

		return null;
	} catch (error) {
		const parsedError = errorParser(error);
		Crashlytics.recordError(
			parsedError,
			'[ShiftTracking.syncGlobalSettings] Error fetching global staff settings'
		);

		Storage.set(STAFF_GLOBAL_SETTINGS, {
			hasStaffAuthorization: false,
			expirationTime: 0,
			isExpired: true,
			inactivityTimeout: 0,
		});

		return Promise.reject(parsedError);
	}
};

export default syncGlobalSettings;
