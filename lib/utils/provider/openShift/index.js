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
import {isFunction} from '../../helpers';
import TimeTracker from '../../../db/TimeTrackerService';

const openShift = async (onOpenShiftError) => {
	try {
		const shiftId = Storage.getString(SHIFT_ID);
		const userId = await getUserId();

		if (!userId) {
			await Shift.open();
			return true;
		}

		const currentShift = await Shift.getUserOpenShift({id: shiftId, userId});

		if (currentShift?.status !== 'opened') {
			await Shift.open();
			return true;
		}

		if (shiftId === currentShift.id) return true;

		Storage.delete(CURRENT_WORKLOG_ID);
		Storage.delete(CURRENT_WORKLOG_DATA);
		Storage.set(SHIFT_ID, currentShift.id);
		Storage.set(SHIFT_STATUS, currentShift.status);
		Storage.set(SHIFT_DATA, JSON.stringify(currentShift));

		await TimeTracker.addEvent({
			id: currentShift.id,
			time: currentShift.startDate,
			type: 'start',
		}).catch(() => null);

		return true;
	} catch (error) {
		Crashlytics.recordError(error, 'Error opening shift in staff service');
		if (isFunction(onOpenShiftError)) onOpenShiftError(error);
		return Promise.reject(error?.result || error);
	}
};

export default openShift;
