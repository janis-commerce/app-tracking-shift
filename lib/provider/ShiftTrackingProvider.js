import React, {useEffect} from 'react';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import Shift from '../Shift'
import getUserId from '../utils/getUserId';
import Crashlytics from '../utils/crashlytics';

const ShiftTrackingProvider = ({ children, onOpenShiftError = null}) => {

    const openShift = async () => {
        Crashlytics.log('open shift by provider');
        try {
            const userId = await getUserId();

            if(!userId) return await Shift.open();
            
            const currentShift = await Shift.getUserOpenShift({userId});
            
            if(currentShift?.status === 'opened') return;

            return await Shift.open();
        } catch (error) {
            Crashlytics.recordError(error, 'Error opening shift in staff service');
            if(onOpenShiftError) return onOpenShiftError(error);
            return null;
        }
    }

    useEffect(() => {
        openShift();
    }, [])
    
    return (
        <ShiftTrackingContext.Provider value={{}}>
            {children}
        </ShiftTrackingContext.Provider>
    );
};

export default ShiftTrackingProvider;