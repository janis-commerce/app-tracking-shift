import {
	isObject,
	isEmptyObject,
	isArray,
	isEmptyArray,
	generateRandomId,
} from '@janiscommerce/apps-helpers';
import {INTERNAL_WORKLOGS, EXCLUDED_WORKLOG_TYPES} from './constant';
import StaffApiServices from './StaffApiServices';

class ShiftWorklogs {
	async open(params) {
		try {
			const {referenceId = '', startDate = ''} = params || {};
			const {result} = await StaffApiServices.postWorklog({
				workLogTypeRefId: referenceId,
				startDate,
			});

			const {itemsCreated = [], itemsUpdated} = result || {};

			if (itemsCreated?.length) {
				const [createdWorklog = {}] = itemsCreated;
				return createdWorklog?.id;
			}

			const [updatedWorklog] = itemsUpdated || [];

			return updatedWorklog?.id;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async finish(params) {
		try {
			const {referenceId = '', endDate = ''} = params || {};
			const {result} = await StaffApiServices.postWorklog({
				workLogTypeRefId: referenceId,
				endDate,
			});

			const {itemsCreated = [], itemsUpdated} = result;
			if (itemsCreated?.length) {
				const [createdWorklog = {}] = itemsCreated;
				return createdWorklog?.id;
			}

			const [updatedWorklog] = itemsUpdated || [];

			return updatedWorklog?.id;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async getList(shiftId) {
		try {
			const {result: workLogs} = await StaffApiServices.getWorkLogsList({
				filters: {
					shiftId,
					status: ['inProgress', 'finished'],
				},
			});

			return workLogs || [];
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async batch(pendingWorkLogs = []) {
		try {
			if (!isArray(pendingWorkLogs) || isEmptyArray(pendingWorkLogs)) return null;

			await StaffApiServices.postWorklog(pendingWorkLogs);
			return null;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	createId(referenceId = '') {
		const id = generateRandomId();
		const workLogMapper = {
			[INTERNAL_WORKLOGS.PICKING_WORK.referenceId]: `picking-${id}`,
			[INTERNAL_WORKLOGS.DELIVERY_WORK.referenceId]: `delivery-${id}`,
			[INTERNAL_WORKLOGS.INACTIVITY.referenceId]: `inactivity-${id}`,
		};

		return workLogMapper[referenceId] || id;
	}

	formatForJanis(workLogs = []) {
		if (!isArray(workLogs) || isEmptyArray(workLogs)) return [];

		return workLogs
			.map((workLog) => {
				const {referenceId, startDate, endDate} = workLog || {};

				if (!referenceId) return null;

				return {
					workLogTypeRefId: referenceId,
					...(startDate && {startDate}),
					...(endDate && {endDate}),
				};
			})
			.filter(Boolean);
	}

	isValidWorkLog(workLog = {}) {
		return isObject(workLog) && !isEmptyObject(workLog) && !!workLog?.referenceId;
	}

	isPausingWorkLog(workLog = {}) {
		return this.isValidWorkLog(workLog) && !EXCLUDED_WORKLOG_TYPES.includes(workLog?.referenceId);
	}

	/**
	 * Filter work logs keeping only those that belong to the given shift and are
	 * not dated before it started. Records from another shift or dated before the
	 * shift began would make Janis reject the whole batch.
	 * @param {Object} params
	 * @param {Array} params.workLogs => Array of work log records
	 * @param {string} params.shiftId => ID of the shift to keep
	 * @param {string} params.shiftStartDate => ISO date the shift started at
	 * @returns {Array} work logs valid to be sent for the given shift
	 */

	filterShiftWorkLogs({workLogs, shiftId, shiftStartDate} = {}) {
		if (!isArray(workLogs)) return [];

		const shiftStartTime = shiftStartDate ? new Date(shiftStartDate).getTime() : null;

		return workLogs.filter((workLog) => {
			// Records saved by previous package versions have no shiftId: treat them as
			// belonging to the current shift and let the date filter discard the invalid ones.
			if (workLog?.shiftId && workLog.shiftId !== shiftId) return false;

			if (!shiftStartTime) return true;

			// Closing records only carry endDate: use it as the activity date so they
			// can still be validated against the shift start.
			const workLogDate = workLog?.startDate || workLog?.endDate;

			if (!workLogDate) return true;

			return new Date(workLogDate).getTime() >= shiftStartTime;
		});
	}
}

export default new ShiftWorklogs();
