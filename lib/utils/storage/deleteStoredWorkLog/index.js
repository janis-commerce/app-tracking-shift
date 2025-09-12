import {CURRENT_WORKLOG_DATA, CURRENT_WORKLOG_ID} from '../../../constant';
import Storage from '../../../db/StorageService';

const deleteStoredWorkLog = () => {
	Storage.delete(CURRENT_WORKLOG_ID);
	Storage.delete(CURRENT_WORKLOG_DATA);
};

export default deleteStoredWorkLog;
