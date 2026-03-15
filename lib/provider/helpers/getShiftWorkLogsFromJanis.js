import Formatter from '../../Formatter';
import Shift from '../../Shift';

const getShiftWorkLogsFromJanis = async (shiftId) => {
	const formattedWorkLogs = await Shift.getWorkLogs(shiftId);
	const [openWorkLogs, closedWorkLogs] = Formatter.splitWorkLogsByStatus(formattedWorkLogs);

	return {
		openWorkLogs,
		closedWorkLogs,
	};
};

export default getShiftWorkLogsFromJanis;
