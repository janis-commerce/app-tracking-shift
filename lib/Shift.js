import StaffApiServices from './StaffApiServices';
import TimeTracker from './db/TimeTrackerService';
import Crashlytics from './utils/crashlytics';
import ShiftWorklogs from './ShiftWorklogs';

/**
 * Class to manage work shifts
 * @class Shift
 * @param {Object} params
 * @param {string} params.environment => Environment to use for the Request Service
 */

class Shift {
	constructor({environment}) {
		this.staffService = new StaffApiServices({environment});
		this.worklogs = new ShiftWorklogs();
	}

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
			const {result} = await this.staffService.openShift();
			const {id: shiftId = ''} = result || {};

			await TimeTracker.addEvent({
				id: shiftId,
				time: date || new Date().toISOString(),
				type: 'start',
			}).catch(() => null);

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
			const {result} = await this.staffService.closeShift();
			const {id: shiftId = ''} = result || {};

			await TimeTracker.addEvent({
				id: shiftId,
				time: date || new Date().toISOString(),
				type: 'finish',
			}).catch(() => null);

			return shiftId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error closing shift in staff service');
			return Promise.reject(error);
		}
	}

	/**
	 * Fetch the work log types from the staff MS and prepare them for register an activity.
	 * @throws {Error} error
	 * @returns {Promise<Array>} workLogTypes => Array of work log types
	 */

	async fetchWorklogTypes() {
		try {
			const {result: workLogTypes = []} = await this.staffService.getWorkLogTypes();

			return this.worklogs.prepareWorkLogTypes(workLogTypes);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	/**
	 * Delete all registers related to the shift in the time tracking database.
	 * @throws {Error} error
	 * @returns {Promise<boolean>} true => if the registers were deleted successfully
	 */

	// eslint-disable-next-line class-methods-use-this
	async deleteShiftRegisters() {
		Crashlytics.log('user delete shift registers');
		try {
			return await TimeTracker.deleteAllEvents();
		} catch (error) {
			Crashlytics.recordError(error, 'Error deleting registers from shift tracking database');
			return Promise.reject(error);
		}
	}
}

export default Shift;
