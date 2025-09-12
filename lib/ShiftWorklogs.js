import StaffApiServices from './StaffApiServices';
import {isArray, isEmptyArray} from './utils/helpers';

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

	async postPendingBatch(pendingWorkLogs = []) {
		try {
			if (!isArray(pendingWorkLogs) || isEmptyArray(pendingWorkLogs)) return null;

			await StaffApiServices.postWorklog(pendingWorkLogs);
			return null;
		} catch (error) {
			return Promise.reject(error);
		}
	}
}

export default new ShiftWorklogs();
