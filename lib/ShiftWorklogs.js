import StaffApiServices from './StaffApiServices';
import TrackerRecords from './TrackerRecords';

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

	async getShiftTrackedWorkLogs(shiftId) {
		try {
			if (!shiftId) throw new Error(`Shift ID is required, but got ${shiftId}`);

			const shiftWorkLogs = await TrackerRecords.getClientShiftActivities(shiftId);
			shiftWorkLogs.sort((a, b) => new Date(a?.time) - new Date(b?.time));

			return shiftWorkLogs;
		} catch (error) {
			return Promise.reject(error);
		}
	}
}

export default new ShiftWorklogs();
