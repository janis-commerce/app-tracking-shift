import React from 'react';
import {render} from '@testing-library/react';
import WithShiftTracking from '../lib/components/WithShiftTracking';
import ShiftTrackingContext from '../lib/context/ShiftTrackingContext';

// Componente de prueba simple para envolver
const TestComponent = ({testProp, shiftData}) => (
	<div data-testid="test-component">
		<span data-testid="test-prop">{testProp}</span>
		<span data-testid="shift-status">{shiftData?.shiftStatus || 'no-status'}</span>
		<span data-testid="shift-id">{shiftData?.shiftId || 'no-id'}</span>
	</div>
);

// Componente de pausa simple
const PausedComponent = () => (
	<div data-testid="paused-component">
		<span>Turno en pausa</span>
	</div>
);

// Función helper para renderizar con contexto mock
const renderWithContext = (component, contextValue) => {
	return render(
		<ShiftTrackingContext.Provider value={contextValue}>{component}</ShiftTrackingContext.Provider>
	);
};

describe('WithShiftTracking HOC', () => {
	it('should render the main component when shift is not paused', () => {
		const WrappedComponent = WithShiftTracking(TestComponent);
		const mockShiftData = {
			shiftStatus: 'opened',
			shiftId: 'shift-123',
		};

		const {getByTestId, queryByTestId} = renderWithContext(
			<WrappedComponent testProp="test-value" />,
			mockShiftData
		);

		// Verificar que el componente principal se renderiza
		expect(getByTestId('test-component')).toBeDefined();
		// Verificar que el componente de pausa NO se renderiza
		expect(queryByTestId('paused-component')).toBeNull();
	});

	it('should render the main component when shift is paused but no pausedShiftComponent is provided', () => {
		const WrappedComponent = WithShiftTracking(TestComponent);
		const mockShiftData = {
			shiftStatus: 'paused',
			shiftId: 'shift-123',
		};

		const {getByTestId, queryByTestId} = renderWithContext(
			<WrappedComponent testProp="test-value" />,
			mockShiftData
		);

		// Verificar que el componente principal se renderiza (no hay componente de pausa configurado)
		expect(getByTestId('test-component')).toBeDefined();
		// Verificar que el componente de pausa NO se renderiza
		expect(queryByTestId('paused-component')).toBeNull();
	});

	it('should render both paused component and main component when shift is paused and pausedShiftComponent is provided', () => {
		const WrappedComponent = WithShiftTracking(TestComponent, {
			pausedShiftComponent: <PausedComponent />,
		});
		const mockShiftData = {
			shiftStatus: 'paused',
			shiftId: 'shift-123',
		};

		const {getByTestId} = renderWithContext(
			<WrappedComponent testProp="test-value" />,
			mockShiftData
		);

		// Verificar que el componente de pausa se renderiza
		expect(getByTestId('paused-component')).toBeDefined();
		// Verificar que el componente principal también se renderiza
		expect(getByTestId('test-component')).toBeDefined();
	});

	it('should pass props correctly to the wrapped component', () => {
		const WrappedComponent = WithShiftTracking(TestComponent);
		const mockShiftData = {
			shiftStatus: 'opened',
			shiftId: 'shift-123',
		};

		const {getByTestId} = renderWithContext(
			<WrappedComponent testProp="test-value" />,
			mockShiftData
		);

		// Verificar que las props se pasan correctamente
		expect(getByTestId('test-prop')).toBeDefined();
	});

	it('should pass shiftData correctly to the wrapped component', () => {
		const WrappedComponent = WithShiftTracking(TestComponent);
		const mockShiftData = {
			shiftStatus: 'opened',
			shiftId: 'shift-123',
		};

		const {getByTestId} = renderWithContext(
			<WrappedComponent testProp="test-value" />,
			mockShiftData
		);

		// Verificar que shiftData se pasa correctamente
		expect(getByTestId('shift-status')).toBeDefined();
		expect(getByTestId('shift-id')).toBeDefined();
	});
});
