import Formatter from '../../../Formatter';
import Shift from '../../../Shift';

const getShiftWorkLogsFromJanis = async (shiftId) => {
	try {
		const shiftWorkLogs = await Shift.getWorkLogs(shiftId);
		const registeredWorkLogs = Formatter.formatWorkLogsFromJanis(shiftWorkLogs);
		const [openWorkLogs, closedWorkLogs] = Formatter.splitWorkLogsByStatus(registeredWorkLogs);

		return {
			openWorkLogs,
			closedWorkLogs,
		};
	} catch (error) {
		return Promise.reject(error);
	}
};

export default getShiftWorkLogsFromJanis;
