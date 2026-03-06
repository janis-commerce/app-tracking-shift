import Formatter from '../../../Formatter';
import Shift from '../../../Shift';

const getShiftWorkLogsFromJanis = async (shiftId) => {
	try {
		const formattedWorkLogs = await Shift.getWorkLogs(shiftId);
		const [openWorkLogs, closedWorkLogs] = Formatter.splitWorkLogsByStatus(formattedWorkLogs);

		return {
			openWorkLogs,
			closedWorkLogs,
		};
	} catch (error) {
		return Promise.reject(error);
	}
};

export default getShiftWorkLogsFromJanis;
