import React, {useEffect} from 'react';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import ShiftClass from '../Shift'
import getUserId from '../utils/getUserId';

const ShiftTrackingProvider = ({ children, environment, onOpenShiftError = null}) => {

    const Shift = new ShiftClass({environment});

    const openShift = async () => {
        try {
            const userId = await getUserId();
            console.log('userId', userId)

            if(!userId) return await Shift.open();
            
            const currentShift = await Shift.getUserOpenShift({userId});
            
            if(Shift.isAnOpenShift(currentShift)) return;

            return await Shift.open();
        } catch (error) {
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