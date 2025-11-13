import {INTERNAL_WORKLOGS} from './constant';
import StaffApiServices from './StaffApiServices';
import {generateRandomId, isArray, isEmptyArray} from './utils/helpers';

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
}

export default new ShiftWorklogs();
