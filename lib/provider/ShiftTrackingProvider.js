import React, {useEffect} from 'react';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import ShiftClass from '../Shift'

const ShiftTrackingProvider = ({ children, environment, onOpenShiftError = null}) => {

    const Shift = new ShiftClass({environment});

    const openShift = async () => {
        try {
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
        <ShiftTrackingContext.Provider>
            {children}
        </ShiftTrackingContext.Provider>
    );
};

export default ShiftTrackingProvider;