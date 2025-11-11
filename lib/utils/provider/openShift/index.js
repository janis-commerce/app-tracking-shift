import Crashlytics from '../../crashlytics';
import getUserId from '../../userInfo/getUserId';
import Shift from '../../../Shift';
import {isFunction} from '../../helpers';
import errorParser from '../../errorParser';

const openShift = async (onOpenShiftError) => {
	try {
		const userId = await getUserId();
		console.log('userId', userId);

		if (!userId) {
			await Shift.deleteShiftRegisters();
			const openShiftId = await Shift.open();
			console.log('openShiftId', openShiftId);
			return {
				openShiftId,
				getWorkLogs: true,
			};
		}

		const currentShift = await Shift.getUserOpenShift({id: Shift.id, userId});
		console.log('currentShift', currentShift);
		if (currentShift?.status !== 'opened') {
			await Shift.deleteShiftRegisters();
			console.log('deleteShiftRegisters');
			const openShiftId = await Shift.open();
			console.log('openShiftId', openShiftId);
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

		console.log('deleteCurrentWorkLog');
		Shift.deleteCurrentWorkLog();
		console.log('id', currentShift.id);
		Shift.id = currentShift.id;
		Shift.status = currentShift.status;
		Shift.data = currentShift;
		console.log('shiftId', Shift.id);
		console.log('shiftStatus', Shift.status);
		console.log('shiftData', Shift.data);
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
