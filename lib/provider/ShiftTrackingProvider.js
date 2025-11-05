import React, {useEffect, useMemo, useState} from 'react';
import {useMMKVString} from 'react-native-mmkv';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import {
	openShift,
	downloadWorkLogTypes,
	isAuthorizedToUseStaffMS,
	getShiftWorkLogsFromJanis,
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
	const [isShiftLoading, setIsShiftLoading] = useState(false);

	const {workLogTypes = []} = workLogData;
	const {hasStaffAuthorization = false} = staffAuthData;

	const contextValues = useMemo(() => {
		return {
			shiftId,
			shiftStatus,
			shiftData,
			workLogTypes,
			hasWorkTypes: !!workLogTypes?.length,
			currentWorkLogData,
			currentWorkLogId,
			hasStaffAuthorization,
			error,
			isShiftLoading,
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
		isShiftLoading,
	]);

	const handleShiftTrackingInit = async () => {
		setIsShiftLoading(true);
		const [isAuthorized, authError] = await promiseWrapper(isAuthorizedToUseStaffMS());

		if (authError) {
			setIsShiftLoading(false);
			setError({
				message: authError?.message,
				type: 'staffMSAuthorization',
			});
			return;
		}

		if (!isAuthorized) {
			setIsShiftLoading(false);
			return;
		}

		const [shiftResult, openError] = await promiseWrapper(openShift(onError));

		if (openError) {
			setIsShiftLoading(false);
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

		setIsShiftLoading(false);
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

		const {openWorkLogs} = workLogs;
		const [currentWorkLog = {}] = openWorkLogs;
		const isExcludedWork = EXCLUDED_WORKLOG_TYPES.includes(currentWorkLog?.referenceId);

		if (isValidObject(currentWorkLog)) {
			Storage.set(CURRENT_WORKLOG_ID, currentWorkLog.id);
			Storage.set(CURRENT_WORKLOG_DATA, JSON.stringify(currentWorkLog));
		}

		if (isValidObject(currentWorkLog) && !isExcludedWork) {
			Storage.set(SHIFT_STATUS, 'paused');
		}

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
