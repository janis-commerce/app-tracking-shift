import React, {useEffect} from 'react';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import ShiftClass from '../Shift'

const ShiftTrackingProvider = ({ children, environment,userId = '', onOpenShiftError = null}) => {

    const Shift = new ShiftClass({environment});

    const openShift = async () => {
        try {
            if(!userId) return await Shift.open();
            
            const isShiftOpened = await Shift.isUserShiftOpened({userId});
            
            if(isShiftOpened) return;

            return await Shift.open();
        } catch (error) {
            if(onOpenShiftError) return onOpenShiftError(error);
            return null;
        }
    }

    useEffect(() => {
        if(Boolean(userId)){
            openShift();
        }
    }, [userId])
    
    return (
        <ShiftTrackingContext.Provider value={{}}>
            {children}
        </ShiftTrackingContext.Provider>
    );
};

export default ShiftTrackingProvider;