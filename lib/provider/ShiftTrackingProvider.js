import React, {useEffect} from 'react';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import Shift from '../Shift';
import getUserId from '../utils/userInfo/getUserId';
import Crashlytics from '../utils/crashlytics';
import Storage from '../db/StorageService';
import {getShiftData} from '../utils/storage';

const ShiftTrackingProvider = ({children, onOpenShiftError = null}) => {
	const shiftId = Storage.getString('shift.id');
	const shiftStatus = Storage.getString('shift.status');
	const shiftData = getShiftData();

	const openShift = async () => {
		Crashlytics.log('open shift by provider');
		try {
			const userId = await getUserId();

			if (!userId) return await Shift.open();

			const currentShift = await Shift.getUserOpenShift({userId});

			if (currentShift?.status !== 'opened') {
				await Shift.open();
			} else {
				Storage.set('shift.id', currentShift.id);
				Storage.set('shift.status', currentShift.status);
				Storage.set('shift.data', JSON.stringify(currentShift));
			}
		} catch (error) {
			Crashlytics.recordError(error, 'Error opening shift in staff service');
			if (onOpenShiftError) return onOpenShiftError(error);
			return null;
		}
	};

	useEffect(() => {
		openShift();
	}, []);

	return (
		<ShiftTrackingContext.Provider value={{shiftId, shiftStatus, shiftData}}>
			{children}
		</ShiftTrackingContext.Provider>
	);
};

export default ShiftTrackingProvider;
