import Storage from '../../db/StorageService';

export {default as getWorkLogTypesData} from './getWorkLogTypesData';
export {default as getShiftData} from './getShiftData';
export {default as getStaffAuthorizationData} from './getStaffAuthorizationData';
export {default as deleteStoredWorkLog} from './deleteStoredWorkLog';

export const setObject = (key, value) => {
	const jsonValue = JSON.stringify(value);
	Storage.set(key, jsonValue);
};

export const getObject = (key, defaultValue = {}) => {
	try {
		const jsonValue = Storage.getString(key);
		return JSON.parse(jsonValue);
	} catch (error) {
		return defaultValue;
	}
};
