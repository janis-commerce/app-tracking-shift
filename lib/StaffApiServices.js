import Request from './utils/request';
import {isValidString} from './utils/helpers';

class StaffApiServices {
	constructor() {
		this.service = 'staff';
	}

	/**
	 * Opens an user's shift
	 * @param {Object} params
	 * @param {string} params.warehouseId - shift current warehouse ID
	 * @returns {Promise<Object>} - Response from the API
	 */

	async openShift({warehouseId} = {}) {
		try {
			return await Request.post({
				service: this.service,
				namespace: 'shift-open',
				body: {
					...(isValidString(warehouseId) && {warehouseId}),
				},
			});
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async updateShift({warehouseId} = {}) {
		try {
			return await Request.post({
				service: this.service,
				namespace: 'shift-update',
				body: {
					...(isValidString(warehouseId) && {warehouseId}),
				},
			});
		} catch (error) {
			return Promise.reject(error);
		}
	}
	/**
	 * Closes current user's shift
	 * @returns {Promise<Object>} - Response from the API
	 */

	async closeShift() {
		try {
			return await Request.post({
				service: this.service,
				namespace: 'shift-close',
			});
		} catch (error) {
			return Promise.reject(error);
		}
	}

	/**
	 * Posts work logs to the API
	 * @param {Object|Array<Object>} workLogs - Work log object or array of work log objects
	 * @param {string} workLogs.workLogTypeRefId - Reference ID of the work log type
	 * @param {Date} workLogs.startDate - Start date and time of the work log
	 * @param {Date} workLogs.endDate - End date and time of the work log
	 * @returns {Promise<Object>} - Response from the API
	 * @example
	 * // Single work log object
	 * postWorklog({
	 *   workLogTypeRefId: "123",
	 *   startDate: new Date("2024-01-01T09:00:00"),
	 *   endDate: new Date("2024-01-01T17:00:00")
	 * });
	 *
	 * // Array of work log objects
	 * postWorklog([
	 *   {
	 *     workLogTypeRefId: "123",
	 *     startDate: new Date("2024-01-01T09:00:00"),
	 *     endDate: new Date("2024-01-01T12:00:00")
	 *   },
	 *   {
	 *     workLogTypeRefId: "456",
	 *     startDate: new Date("2024-01-01T13:00:00"),
	 *     endDate: new Date("2024-01-01T17:00:00")
	 *   }
	 * ]);
	 */
	async postWorklog(workLogs) {
		try {
			if (!Array.isArray(workLogs)) {
				workLogs = [workLogs];
			}

			return await Request.post({
				service: this.service,
				namespace: 'work-log',
				body: [...workLogs],
			});
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async getShiftsList(params) {
		const {filters, sort} = params || {};
		try {
			return await Request.list({
				service: this.service,
				namespace: 'shift',
				queryParams: {
					...(filters && {filters}),
					...(sort && {sort}),
				},
			});
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async getWorkLogTypes() {
		try {
			return await Request.list({
				service: this.service,
				namespace: 'work-log-type',
				headers: {
					pageSize: 100,
				},
				queryParams: {
					filters: {
						status: 'active',
						type: ['work', 'pause', 'problem'],
						isInternal: 'false',
					},
				},
			});
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async getSetting(setting) {
		try {
			return await Request.get({
				service: this.service,
				namespace: 'setting',
				pathParams: [setting],
			});
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async getWorkLogsList(params) {
		const {filters, sort} = params || {};
		try {
			return await Request.list({
				service: this.service,
				namespace: 'work-log',
				queryParams: {
					...(filters && {filters}),
					...(sort && {sort}),
				},
			});
		} catch (error) {
			return Promise.reject(error);
		}
	}
}

export default new StaffApiServices();
