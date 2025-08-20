import {isArray, isEmptyArray} from './utils/helpers';
import {INTERNAL_WORKLOGS} from './constant';

class Formatter {
	static formatWorkLogId(workLog, id) {
		const workLogMapper = {
			[INTERNAL_WORKLOGS.PICKING_WORK.referenceId]: `picking-${id}`,
			[INTERNAL_WORKLOGS.DELIVERY_WORK.referenceId]: `delivery-${id}`,
			default: id,
		};

		return workLogMapper[workLog] || workLogMapper.default;
	}

	static formatWorkLogsFromJanis(workLogs = []) {
		if (!isArray(workLogs)) {
			workLogs = [workLogs].filter(Boolean);
		}

		if (isEmptyArray(workLogs)) return [];

		return workLogs.map((workLog) => {
			const {id, shiftId, workLogTypeRefId, startDate, endDate, status, workLogTypeName} = workLog;

			const formattedId = Formatter.formatWorkLogId(workLogTypeRefId, id);

			return {
				id: formattedId,
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
