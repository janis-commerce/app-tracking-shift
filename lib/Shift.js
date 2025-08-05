import TimeTracker from './db/TimeTrackerService';
import StaffService from './StaffApiServices';
import Storage from './db/StorageService';
import Crashlytics from './utils/crashlytics';

/**
 * Class to manage work shifts
 * @class Shift
 */

class Shift {
	/**
	 * Open a work shift in the staff MS and record this event in the time tracking database.
	 * @param {Object} params
	 * @throws {Error} error
	 * @returns {Promise<string>} shiftId => ID related to the shift that has just been opened for the user
	 */

	async open(params = {}) {
		Crashlytics.log('user open shift');
		const {date} = params;
		try {
			const {result: shift} = await StaffService.openShift();
			const {id: shiftId = ''} = shift || {};

			const openShift = await this.getUserOpenShift({id: shiftId});

			await this._startTracking({
				id: shiftId,
				date: date || openShift.startDate,
			});

			Storage.set('shift.id', shiftId);
			Storage.set('shift.status', 'opened');
			Storage.set('shift.data', JSON.stringify(openShift));

			return shiftId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error opening shift in staff service');
			return Promise.reject(error);
		}
	}

	/**
	 * Finish a work shift in the staff MS and record this event in the time tracking database.
	 * @param {Object} params
	 * @throws {Error} error
	 * @returns {Promise<string>} shiftId => ID related to the shift that has just been closed for the user
	 */

	async finish(params = {}) {
		Crashlytics.log('user close shift');
		const {date} = params;
		try {
			const {result: shift} = await StaffService.closeShift();
			const {id: shiftId = ''} = shift || {};

			await this._finishTracking({id: shiftId, date});

			Storage.set('shift.status', 'closed');

			return shiftId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error closing shift in staff service');
			return Promise.reject(error);
		}
	}

	/**
	 * Get the open shift for a user
	 * @param {Object} params
	 * @param {string} params.userId => ID related to the user
	 * @param {string} params.id => ID related to the shift
	 * @throws {Error} error
	 * @returns {Promise<Object>} shift => The open shift for the user
	 */

	async getUserOpenShift(params = {}) {
		const {userId, id, ...rest} = params;
		try {
			const {result: shifts} = await StaffService.getShiftsList({
				filters: {
					userId,
					status: 'opened',
					...(id && {id}),
					...rest,
				},
			});
			const [openShift] = shifts || [];

			return openShift || {};
		} catch (error) {
			return Promise.reject(error);
		}
	}

	/**
	 * Delete all registers related to the shift in the time tracking database.
	 * @throws {Error} error
	 * @returns {Promise<boolean>} true => if the registers were deleted successfully
	 */

	async deleteShiftRegisters() {
		Crashlytics.log('user delete shift registers');
		try {
			Storage.clearAll();
			return await TimeTracker.deleteAllEvents();
		} catch (error) {
			Crashlytics.recordError(error, 'Error deleting registers from shift tracking database');
			return Promise.reject(error);
		}
	}

	/**
	 * @private
	 * Start id tracking in the time tracking database.
	 * @param {Object} params
	 * @param {string} params.id => ID related to the shift
	 * @param {string} params.date => Date related to the shift
	 * @param {Object} params.payload => Payload related to the shift
	 */

	async _startTracking(params) {
		const {id, date, payload} = params;
		await TimeTracker.addEvent({
			id,
			time: date || new Date().toISOString(),
			type: 'start',
			payload,
		}).catch(() => null);
	}

	/**
	 * @private
	 * Finish id tracking in the time tracking database.
	 * @param {Object} params
	 * @param {string} params.id => ID related to the shift
	 * @param {string} params.date => Date related to the shift
	 * @param {Object} params.payload => Payload related to the shift
	 */

	async _finishTracking(params) {
		const {id, date, payload} = params;
		await TimeTracker.addEvent({
			id,
			time: date || new Date().toISOString(),
			type: 'finish',
			payload,
		}).catch(() => null);
	}
}

export default new Shift();
