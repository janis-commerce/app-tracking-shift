import {isArray, isEmptyArray} from './utils/helpers';

class Formatter {
	static formatWorkLogsFromJanis(workLogs = []) {
		if (!isArray(workLogs)) {
			workLogs = [workLogs].filter(Boolean);
		}

		if (isEmptyArray(workLogs)) return [];

		return workLogs.map((workLog) => {
			const {id, shiftId, workLogTypeRefId, startDate, endDate, status, workLogTypeName} = workLog;

			return {
				id,
				shiftId,
				referenceId: workLogTypeRefId,
				startDate,
				endDate,
				status,
				name: workLogTypeName,
			};
		});
	}

	static splitWorkLogsByStatus(workLogs = []) {
		if (!isArray(workLogs) || isEmptyArray(workLogs)) return [[], []];

		return workLogs.reduce(
			([openWorkLogs, finishedWorkLogs], workLog) => {
				const {status} = workLog || {};

				if (status === 'inProgress') {
					openWorkLogs.push(workLog);
				}

				if (status === 'finished') {
					finishedWorkLogs.push(workLog);
				}

				return [openWorkLogs, finishedWorkLogs];
			},
			[[], []]
		);
	}
}

export default Formatter;
