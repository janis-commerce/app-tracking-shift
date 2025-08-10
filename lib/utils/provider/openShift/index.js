import Storage from '../../../db/StorageService';
import Crashlytics from '../../crashlytics';
import {
	SHIFT_ID,
	SHIFT_STATUS,
	SHIFT_DATA,
	CURRENT_WORKLOG_ID,
	CURRENT_WORKLOG_DATA,
} from '../../../constant';
import getUserId from '../../userInfo/getUserId';
import Shift from '../../../Shift';

const openShift = async (onError) => {
	try {
		const shiftId = Storage.getString(SHIFT_ID);
		const userId = await getUserId();

		if (!userId) {
			await Shift.open();
			return;
		}

		const currentShift = await Shift.getUserOpenShift({id: shiftId, userId});

		if (currentShift?.status !== 'opened') {
			await Shift.open();
			return;
		}

		if (shiftId === currentShift.id) return;

		Storage.delete(CURRENT_WORKLOG_ID);
		Storage.delete(CURRENT_WORKLOG_DATA);
		Storage.set(SHIFT_ID, currentShift.id);
		Storage.set(SHIFT_STATUS, currentShift.status);
		Storage.set(SHIFT_DATA, JSON.stringify(currentShift));
	} catch (error) {
		Crashlytics.recordError(error, 'Error opening shift in staff service');
		if (onError) onError(error);
	}
};

export default openShift;
