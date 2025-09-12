import Storage from '../../../db/StorageService';
import Crashlytics from '../../crashlytics';
import {SHIFT_ID, SHIFT_STATUS, SHIFT_DATA} from '../../../constant';
import getUserId from '../../userInfo/getUserId';
import Shift from '../../../Shift';
import {isFunction} from '../../helpers';
import {deleteStoredWorkLog, setObject} from '../../storage';

const openShift = async (onOpenShiftError) => {
	try {
		const shiftId = Storage.getString(SHIFT_ID);
		const userId = await getUserId();

		if (!userId) {
			await Shift.deleteShiftRegisters();
			const openShiftId = await Shift.open();
			return {
				openShiftId,
				getWorkLogs: true,
			};
		}

		const currentShift = await Shift.getUserOpenShift({id: shiftId, userId});

		if (currentShift?.status !== 'opened') {
			await Shift.deleteShiftRegisters();
			const openShiftId = await Shift.open();
			return {
				openShiftId,
				getWorkLogs: true,
			};
		}

		if (shiftId === currentShift.id)
			return {
				openShiftId: currentShift.id,
				getWorkLogs: false,
			};

		deleteStoredWorkLog();
		Storage.set(SHIFT_ID, currentShift.id);
		Storage.set(SHIFT_STATUS, currentShift.status);
		setObject(SHIFT_DATA, currentShift);

		return {
			openShiftId: currentShift.id,
			getWorkLogs: true,
		};
	} catch (error) {
		Crashlytics.recordError(error, 'Error opening shift in staff service');
		if (isFunction(onOpenShiftError)) onOpenShiftError(error);
		return Promise.reject(error?.result || error);
	}
};

export default openShift;
