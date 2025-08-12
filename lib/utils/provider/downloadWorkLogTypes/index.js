import Shift from '../../../Shift';
import {getWorkLogTypesData} from '../../storage';
import {WORKLOG_TYPES_DATA, WORKLOG_TYPES_EXPIRATION_TIME} from '../../../constant';
import Storage from '../../../db/StorageService';
import Crashlytics from '../../crashlytics';
import {isFunction} from '../../helpers';

const downloadWorkLogTypes = async (onDownloadError) => {
	try {
		const {isExpired} = getWorkLogTypesData();

		if (!isExpired) return null;

		const workLogTypes = await Shift.fetchWorklogTypes();

		const data = {
			workLogTypes,
			expirationTime: Date.now() + WORKLOG_TYPES_EXPIRATION_TIME,
		};

		Storage.set(WORKLOG_TYPES_DATA, JSON.stringify(data));
		return null;
	} catch (error) {
		Crashlytics.recordError(error, 'Error downloading worklog types');
		if (isFunction(onDownloadError)) onDownloadError(error);
		return Promise.reject(error?.result || error);
	}
};

export default downloadWorkLogTypes;
