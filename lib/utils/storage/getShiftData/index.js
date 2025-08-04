import Storage from '../../../db/StorageService';

const getShiftData = () => {
	const shiftData = Storage.getString('shift.data');
	try {
		return JSON.parse(shiftData);
	} catch (error) {
		return shiftData;
	}
};

export default getShiftData;
