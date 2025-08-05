import Request from './utils/request';

class StaffApiServices {
	constructor() {
		this.service = 'staff';
	}

	async openShift() {
		try {
			return await Request.post({
				service: this.service,
				namespace: 'shift-open',
			});
		} catch (error) {
			return Promise.reject(error);
		}
	}

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

	async postWorklog(params) {
		const {referenceId, startTime, endTime} = params || {};
		try {
			return await Request.post({
				service: this.service,
				namespace: 'work-log',
				body: {
					workLogTypeRefId: referenceId,
					startDate: startTime,
					endDate: endTime,
				},
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
}

export default new StaffApiServices();
