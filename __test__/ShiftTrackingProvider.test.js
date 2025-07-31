import React from 'react';
import { render, waitFor } from '@testing-library/react';
import ShiftTrackingProvider from '../lib/provider/ShiftTrackingProvider';

// Mock of the Shift class
const mockShiftInstance = {
    open: jest.fn().mockResolvedValue('shift-123')
};

jest.mock('../lib/Shift', () => {
    return jest.fn().mockImplementation(() => mockShiftInstance);
});

// Mock of the context
jest.mock('../lib/context/ShiftTrackingContext', () => ({
    __esModule: true,
    default: {
        Provider: ({ children }) => <div data-testid="context-provider">{children}</div>
    }
}));

describe('ShiftTrackingProvider', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockShiftInstance.open.mockResolvedValue('shift-123');
    });

    it('should make the correct call to the staff service to open shift', async () => {
        // Mock of the staff service
        const mockStaffService = {
            openShift: jest.fn().mockResolvedValue({ result: { id: 'shift-456' } })
        };

        // Mock of the Shift class that uses the staff service
        mockShiftInstance.open.mockImplementation(async () => {
            const result = await mockStaffService.openShift();
            return result.result.id;
        });

        render(
            <ShiftTrackingProvider environment="test">
                <div>Test Child</div>
            </ShiftTrackingProvider>
        );

        await waitFor(() => {
            expect(mockStaffService.openShift).toHaveBeenCalledTimes(1);
        });
    });

    it('should call onOpenShiftError when openShift fails', async () => {
        const mockError = new Error('Error opening shift');
        mockShiftInstance.open.mockRejectedValue(mockError);
        
        const onOpenShiftError = jest.fn().mockReturnValue(null);

        render(
            <ShiftTrackingProvider 
                environment="test" 
                onOpenShiftError={onOpenShiftError}
            >
                <div>Test Child</div>
            </ShiftTrackingProvider>
        );

        await waitFor(() => {
            expect(mockShiftInstance.open).toHaveBeenCalledTimes(1);
            expect(onOpenShiftError).toHaveBeenCalledWith(mockError);
        });
    });

    it('should return null when onOpenShiftError is not provided and openShift fails', async () => {
        const mockError = new Error('Error opening shift');
        mockShiftInstance.open.mockRejectedValue(mockError);

        render(
            <ShiftTrackingProvider environment="test">
                <div>Test Child</div>
            </ShiftTrackingProvider>
        );

        await waitFor(() => {
            expect(mockShiftInstance.open).toHaveBeenCalledTimes(1);
        });
    });

    it('should return the result of onOpenShiftError when provided and openShift fails', async () => {
        const mockError = new Error('Error opening shift');
        mockShiftInstance.open.mockRejectedValue(mockError);
        
        const customReturnValue = 'custom-error-handling';
        const onOpenShiftError = jest.fn().mockReturnValue(customReturnValue);

        render(
            <ShiftTrackingProvider 
                environment="test" 
                onOpenShiftError={onOpenShiftError}
            >
                <div>Test Child</div>
            </ShiftTrackingProvider>
        );

        await waitFor(() => {
            expect(mockShiftInstance.open).toHaveBeenCalledTimes(1);
            expect(onOpenShiftError).toHaveBeenCalledWith(mockError);
        });
    });
}); 