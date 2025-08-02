import StaffApiServices from "./StaffApiServices";
import TimeTracker from "./db/TimeTrackerService";

/**
 * Class to manage work shifts
 * @class Shift
 * @param {Object} params
 * @param {string} params.environment => Environment to use for the Request Service
 */

class Shift {
    constructor({environment}) {
        this.staffService = new StaffApiServices({environment});
    }

    /**
     * Open a work shift in the staff MS and record this event in the time tracking database.
     * @param {Object} params 
     * @throws {Error} error
     * @returns {Promise<string>} shiftId => ID related to the shift that has just been opened for the user
     */

    async open(params = {}) {
        const {date} = params
        try {
            const {result} = await this.staffService.openShift();
            const {id: shiftId = ''} = result || {};

            await TimeTracker.addEvent({
                id: shiftId,
                time: date || new Date().toISOString(),
                type: "start",
            }).catch(() => null);

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
            const {result} = await this.staffService.closeShift();
            const {id: shiftId = ''} = result || {};

            await TimeTracker.addEvent({
                id: shiftId,
                time: date || new Date().toISOString(),
                type: "finish",
            }).catch(() => null);

            return Promise.resolve(shiftId);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async getUserOpenShift(params = {}) {
        const {userId} = params;
        const filters = {
            userId,
            status: "opened",
        }
        try {
            const {result : shifts} = await this.staffService.getShiftsList({filters});
            const [openShift = {}] = shifts || [];
            
            return Boolean(openShift) ? openShift : {};
        } catch (error) {
            return Promise.reject(error);
        }
    }

    isAnOpenShift(shift) {
        const {status, id} = shift || {}
        return status === "opened" && id;
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
}


export default Shift;
