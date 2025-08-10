import Shift from '../../../Shift';
import {getWorkLogTypesData} from '../../storage';
import {WORKLOG_TYPES_DATA, WORKLOG_TYPES_EXPIRATION_TIME} from '../../../constant';
import Storage from '../../../db/StorageService';
import Crashlytics from '../../crashlytics';

const downloadWorkLogTypes = async () => {
	try {
		const {isExpired} = getWorkLogTypesData();

		if (!isExpired) return;

		const workLogTypes = await Shift.fetchWorklogTypes();

		const data = {
			workLogTypes,
			expirationTime: Date.now() + WORKLOG_TYPES_EXPIRATION_TIME,
		};

		Storage.set(WORKLOG_TYPES_DATA, JSON.stringify(data));
	} catch (error) {
		Crashlytics.recordError(error, 'Error downloading worklog types');
	}
};

export default downloadWorkLogTypes;
