import TimeTracker from "./db/TimeTrackerService";
import StaffService from "./StaffApiServices";
import Storage from "./db/StorageService";

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
        const {date} = params
        try {
            const {result : shift} = await StaffService.openShift();
            const {id: shiftId = ''} = shift || {};

            const openShift = await this.getUserOpenShift({id: shiftId});
            console.log('openShift', openShift)

            await this._startTracking({id: shiftId, date});

            Storage.set('shift.id', shiftId);
            Storage.set('shift.state', 'opened');

            return Promise.resolve(shiftId);
        } catch (error) {
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
        const {date} = params
        try {
            const {result : shift} = await StaffService.closeShift();
            const {id: shiftId = ''} = shift || {};

            await this._finishTracking({id: shiftId, date});

            Storage.set('shift.id', shiftId);
            Storage.set('shift.state', 'closed');

            return Promise.resolve(shiftId);
        } catch (error) {
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
            const {result : shifts} = await StaffService.getShiftsList({
                filters: {
                userId,
                    status: "opened",
                    ...(id && {id}),
                    ...rest
                }
            });
            const [openShift] = shifts || [];
            
            return Boolean(openShift) ? openShift : {};
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
        try {
            await TimeTracker.deleteAllEvents();
            return Promise.resolve(true);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async _startTracking(params) {
        const {id, date} = params;
        return await TimeTracker.addEvent({
            id,
            time: date || new Date().toISOString(),
            type: "start",
        }).catch(() => null);
    }

    async _finishTracking(params) {
        const {id, date} = params;
        return await TimeTracker.addEvent({
            id,
            time: date || new Date().toISOString(),
            type: "finish",
        }).catch(() => null);
    }
}

export default new Shift();
