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

	/**
	 * Parses and simplifies the structure of work records obtained from the personnel MS
	 * @param {Array} worklogTypes => Array of worklog types
	 * @returns {Array} worklogTypes => Array of worklog types
	 */

	// eslint-disable-next-line class-methods-use-this
	prepareWorkLogTypes(worklogTypes = []) {
		return worklogTypes
			.map((workType) => {
				const {
					id,
					referenceId,
					name,
					description = '',
					type = '',
					suggestedTime = 0,
				} = workType || {};

				if (!id || !referenceId) return undefined;

				return {
					id,
					referenceId,
					name,
					type,
					description,
					suggestedTime,
				};
			})
			.filter(Boolean);
	}
}

export default new ShiftWorklogs();
