import React, {useEffect, useMemo, useState} from 'react';
import {useMMKVString} from 'react-native-mmkv';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import {
	openShift,
	downloadWorkLogTypes,
	isAuthorizedToUseStaffMS,
	getShiftWorkLogsFromJanis,
	saveWorkLogTimesInDB,
} from '../utils/provider';
import {
	CURRENT_WORKLOG_DATA,
	CURRENT_WORKLOG_ID,
	EXCLUDED_WORKLOG_TYPES,
	SHIFT_DATA,
	SHIFT_ID,
	SHIFT_STATUS,
	STAFF_AUTH,
	WORKLOG_TYPES_DATA,
} from '../constant';
import {useMMKVObject} from '../hooks/useMMKVObject';
import {isValidObject, promiseWrapper} from '../utils/helpers';
import Crashlytics from '../utils/crashlytics';
import Storage from '../db/StorageService';

const ShiftTrackingProvider = ({children, onError = null}) => {
	const [shiftStatus] = useMMKVString(SHIFT_STATUS);
	const [shiftId] = useMMKVString(SHIFT_ID);
	const [shiftData] = useMMKVObject(SHIFT_DATA, {});

	const [currentWorkLogId] = useMMKVString(CURRENT_WORKLOG_ID);
	const [workLogData] = useMMKVObject(WORKLOG_TYPES_DATA, {});
	const [currentWorkLogData] = useMMKVObject(CURRENT_WORKLOG_DATA, {});

	const [staffAuthData] = useMMKVObject(STAFF_AUTH, {});

	const [error, setError] = useState(null);
	const [openShiftResult, setOpenShiftResult] = useState({
		id: null,
		getWorkLogs: false,
	});

	const {workLogTypes = []} = workLogData;
	const {hasStaffAuthorization = false} = staffAuthData;

	const contextValues = useMemo(() => {
		return {
			shiftId,
			shiftStatus,
			shiftData,
			workLogTypes,
			currentWorkLogData,
			currentWorkLogId,
			hasStaffAuthorization,
			error,
		};
	}, [
		shiftId,
		shiftStatus,
		shiftData,
		workLogTypes,
		currentWorkLogData,
		currentWorkLogId,
		error,
		hasStaffAuthorization,
	]);

	const handleShiftTrackingInit = async () => {
		const [isAuthorized, authError] = await promiseWrapper(isAuthorizedToUseStaffMS());

		if (authError) {
			setError({
				message: authError?.message,
				type: 'staffMSAuthorization',
			});
			return;
		}

		if (!isAuthorized) return;

		const [shiftResult, openError] = await promiseWrapper(openShift(onError));

		if (openError) {
			setError({
				message: openError?.message,
				type: 'openShift',
			});
			return;
		}

		const {openShiftId, getWorkLogs} = shiftResult;

		setOpenShiftResult((prev) => ({
			...prev,
			id: openShiftId,
			getWorkLogs,
		}));

		const [, downloadError] = await promiseWrapper(downloadWorkLogTypes(onError));

		if (downloadError) {
			setError({
				message: downloadError?.message,
				type: 'downloadWorkLogTypes',
			});
		}
	};

	const getShiftWorkLogsHistory = async () => {
		const [workLogs, workLogsError] = await promiseWrapper(
			getShiftWorkLogsFromJanis(openShiftResult.id)
		);

		if (workLogsError) {
			setError({
				message: workLogsError?.message,
				type: 'getWorkLogsFromJanis',
			});
			return;
		}

		const {openWorkLogs, closedWorkLogs} = workLogs;
		const [currentWorkLog = {}] = openWorkLogs;
		const isExcludedWork = EXCLUDED_WORKLOG_TYPES.includes(currentWorkLog?.referenceId);

		if (isValidObject(currentWorkLog)) {
			Storage.set(CURRENT_WORKLOG_ID, currentWorkLog.id);
			Storage.set(CURRENT_WORKLOG_DATA, JSON.stringify(currentWorkLog));
		}

		if (isValidObject(currentWorkLog) && !isExcludedWork) {
			Storage.set(SHIFT_STATUS, 'paused');
		}

		const promises = [currentWorkLog, ...closedWorkLogs].map((workLog) =>
			saveWorkLogTimesInDB(workLog).catch((workLogError) => {
				Crashlytics.recordError(workLogError, 'error trying to save work log times in db', workLog);
			})
		);

		await Promise.all(promises);

		setOpenShiftResult((prev) => ({
			...prev,
			getWorkLogs: false,
		}));
	};

	useEffect(() => {
		handleShiftTrackingInit();
	}, []);

	useEffect(() => {
		if (openShiftResult?.id && openShiftResult?.getWorkLogs) {
			getShiftWorkLogsHistory();
		}
	}, [openShiftResult]);

	return (
		<ShiftTrackingContext.Provider value={contextValues}>{children}</ShiftTrackingContext.Provider>
	);
};

export default ShiftTrackingProvider;
