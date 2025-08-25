import TimeTracker from '../../../db/TimeTrackerService';
import {isEmptyObject, isObject} from '../../helpers';

const saveWorkLogTimesInDB = async (workLog = {}) => {
	try {
		if (!isObject(workLog) || isEmptyObject(workLog)) return false;

		const {startDate, endDate, shiftId, id, referenceId, name} = workLog;

		const dataForDB = {
			shiftId,
			referenceId,
			name,
		};

		await TimeTracker.addEvent({
			id,
			type: 'start',
			time: startDate,
			payload: dataForDB,
		});

		if (endDate) {
			await TimeTracker.addEvent({
				id,
				type: 'finish',
				time: endDate,
				payload: dataForDB,
			});
		}

		return true;
	} catch (error) {
		return Promise.reject(error);
	}
};

export default saveWorkLogTimesInDB;
