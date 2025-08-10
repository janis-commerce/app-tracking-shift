import Storage from '../../../db/StorageService';
import {SHIFT_DATA} from '../../../constant';

/**
 * @description Get the shift data from the storage
 * @returns {Object} The shift data
 * @example
 * const shiftData = getShiftData();
 * console.log(shiftData); // {
    "id": "631fb04c8fe08f51a8ee5949",
    "startDate": "2024-01-15T09:00:00.000Z",
    "dateToClose": "2024-01-15T17:00:00.000Z",
    "dateMaxToClose": "2024-01-15T17:00:00.000Z",
    "userId": "6a1fc1eeb5b68406e0487a10",
    "displayId": "240715-EARPIQ",
    "dateCreated": "2019-07-12T19:00:00.000Z",
    "dateModified": "2019-07-20T19:00:00.000Z",
    "userCreated": "6a1fc1eeb5b68406e0487a10",
    "userModified": "7e1fc1eeb5b68406e048796",
    "status": "opened"
}
 */

const getShiftData = () => {
	const shiftData = Storage.getString(SHIFT_DATA);
	try {
		return JSON.parse(shiftData);
	} catch (error) {
		return shiftData;
	}
};

export default getShiftData;
