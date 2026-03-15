import React, {useEffect, useMemo, useState} from 'react';
import {promiseWrapper} from '@janiscommerce/apps-helpers';
import {useStorageValue} from '../hooks/useStorageValue';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import {openShift, downloadWorkLogTypes, getShiftWorkLogsFromJanis} from './helpers';
import {
	CURRENT_WORKLOG_DATA,
	CURRENT_WORKLOG_ID,
	EXCLUDED_WORKLOG_TYPES,
	SHIFT_DATA,
	SHIFT_ID,
	SHIFT_STATUS,
	STAFF_GLOBAL_SETTINGS,
	WORKLOG_TYPES_DATA,
} from '../constant';
import Shift from '../Shift';
import ShiftWorklogs from '../ShiftWorklogs';

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
	const {settings: globalSettings} = useStorageValue(STAFF_GLOBAL_SETTINGS, {});

	const [error, setError] = useState(null);
	const [openShiftResult, setOpenShiftResult] = useState({
		id: null,
		getWorkLogs: false,
	});
	const [isShiftLoading, setIsShiftLoading] = useState(false);

	const {workLogTypes = []} = workLogData;
	const {hasStaffAuthorization = false, inactivityTimeout = 0} = globalSettings || {};
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
			inactivityTimeout,
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
		inactivityTimeout,
		isShiftLoading,
	]);

	const shiftInitialization = async () => {
		setIsShiftLoading(true);

		const [isAuthorized, authError] = await promiseWrapper(Shift.checkStaffMSAuthorization());

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

		if (ShiftWorklogs.isValidWorkLog(currentWorkLog)) {
			Shift.setCurrentWorkLog(currentWorkLog);
		}

		if (ShiftWorklogs.isValidWorkLog(currentWorkLog) && !isExcludedWork) {
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
