import Crashlytics from '../../crashlytics';
import getUserId from '../../userInfo/getUserId';
import Shift from '../../../Shift';
import {isFunction} from '../../helpers';
import errorParser from '../../errorParser';

const openShift = async ({onOpenShiftError, warehouseId}) => {
	try {
		const userId = await getUserId();
		if (!userId) {
			await Shift.deleteShiftRegisters();
			const openShiftId = await Shift.open({warehouseId});
			return {
				openShiftId,
				getWorkLogs: true,
			};
		}

		const currentShift = await Shift.getUserOpenShift({id: Shift.id, userId});
		if (currentShift?.status !== 'opened') {
			await Shift.deleteShiftRegisters();
			const openShiftId = await Shift.open({warehouseId});
			return {
				openShiftId,
				getWorkLogs: true,
			};
		}

		if (Shift.id === currentShift.id)
			return {
				openShiftId: currentShift.id,
				getWorkLogs: false,
			};

		Shift.deleteCurrentWorkLog();
		Shift.id = currentShift.id;
		Shift.status = currentShift.status;
		Shift.data = currentShift;

		return {
			openShiftId: currentShift.id,
			getWorkLogs: true,
		};
	} catch (error) {
		const parsedError = errorParser(error);
		Crashlytics.recordError(parsedError, 'Error opening shift in staff service');
		if (isFunction(onOpenShiftError)) onOpenShiftError(parsedError);
		return Promise.reject(parsedError);
	}
};

export default openShift;
