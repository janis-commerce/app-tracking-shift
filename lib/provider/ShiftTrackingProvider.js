import React, {useEffect, useMemo, useState} from 'react';
import {useStorageValue} from '../hooks/useStorageValue';
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
import {isValidObject, promiseWrapper} from '../utils/helpers';
import Shift from '../Shift';

/**
 * ShiftTrackingProvider component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @param {Object} props.additionalInfo - Additional information for shift tracking
 * @param {string} props.additionalInfo.warehouseId - Warehouse ID to associate with the shift
 * @param {Function} props.onError - Error callback handler
 */
const ShiftTrackingProvider = ({children, additionalInfo = {}, onError = null}) => {
	const shiftStatus = useStorageValue(SHIFT_STATUS);
	const shiftId = useStorageValue(SHIFT_ID);
	const shiftData = useStorageValue(SHIFT_DATA, {});

	const currentWorkLogId = useStorageValue(CURRENT_WORKLOG_ID);
	const workLogData = useStorageValue(WORKLOG_TYPES_DATA, {});
	const currentWorkLogData = useStorageValue(CURRENT_WORKLOG_DATA, {});

	const staffAuthData = useStorageValue(STAFF_AUTH, {});

	const [error, setError] = useState(null);
	const [openShiftResult, setOpenShiftResult] = useState({
		id: null,
		getWorkLogs: false,
	});
	const [isShiftLoading, setIsShiftLoading] = useState(false);

	const {workLogTypes = []} = workLogData;
	const {hasStaffAuthorization = false} = staffAuthData;
	const {warehouseId = ''} = additionalInfo;

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

	const shiftInitialization = async () => {
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

		const [shiftResult, openError] = await promiseWrapper(
			openShift({
				warehouseId,
				onOpenShiftError: onError,
			})
		);

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
			Shift.setCurrentWorkLog(currentWorkLog);
		}

		if (isValidObject(currentWorkLog) && !isExcludedWork) {
			Shift.status = 'paused';
		}

		setOpenShiftResult((prev) => ({
			...prev,
			getWorkLogs: false,
		}));
	};

	useEffect(() => {
		shiftInitialization();
	}, []);

	useEffect(() => {
		const handleWarehouseChange = async () => {
			if (warehouseId && Shift.isOpen) {
				try {
					await Shift.update({warehouseId});
				} catch (errorWarehouseChange) {
					setError({
						message: errorWarehouseChange?.message,
						type: 'updateShift',
					});
				}
			}
		};
		handleWarehouseChange();
	}, [warehouseId]);

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
