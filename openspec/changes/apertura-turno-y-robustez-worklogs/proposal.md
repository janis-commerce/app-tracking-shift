## Why

La lógica de apertura de turno está repartida entre `Shift.open` (solo crea turnos nuevos) y el helper `provider/helpers/openShift.js`, que decide entre crear/reusar/adoptar y manipula el estado interno de `Shift` desde afuera, rompiendo la encapsulación. Además, el análisis operativo del 06/07/2026 detectó fallas de estado local que comparten esa raíz: buffer offline atascado que reintenta en bucle (52 errores 400), datos arrastrados entre versiones de la app, y turnos que quedan en pausa sin actividad en curso dejando al usuario sin poder reanudar.

## What Changes

- Unificar toda la resolución de apertura inicial (nueva/reuso/adopción) dentro de `Shift.open`, que obtiene el `userId` internamente y siempre devuelve el id del turno vigente.
- **BREAKING** (interno del package): eliminar el helper `provider/helpers/openShift.js`; su lógica pasa a `Shift.open`. `getWorkLogs` se deriva en la inicialización comparando el id previo contra el devuelto.
- Estampar el `shiftId` de origen en cada registro del buffer offline y filtrar/compactar por turno vigente al drenar, descartando huérfanos.
- Invalidar el estado operativo local ante cambios de versión de la app vía `expireWithVersion` (requiere upgrade de `@janiscommerce/app-storage` y `@janiscommerce/app-device-info`).
- Garantizar que la pausa refleje siempre una actividad pausante en curso: prevención en `openWorkLog` (orden de escrituras) y red de presentación en `WithShiftTracking`.
- Eliminar `LAST_TIMER_RESET_AT` al cambiar de identidad de turno, para que la detección de inactividad no arrastre un reset viejo y genere worklogs con fecha anterior al turno.

## Capabilities

### New Capabilities
- `shift-opening`: resolución de apertura de turno al inicializar (crear, reusar o adoptar un turno abierto) y su contrato con el provider.
- `offline-worklogs`: persistencia, asociación por turno, filtrado y drenado del buffer de worklogs offline.
- `storage-version-invalidation`: invalidación del estado operativo local cuando cambia la versión de la app.
- `shift-pause`: coherencia y presentación del estado de pausa del turno respecto a la actividad en curso.
- `inactivity-timer`: ciclo de vida del marcador de inactividad (`LAST_TIMER_RESET_AT`) atado a la identidad del turno.

### Modified Capabilities
<!-- Sin capabilities previas en openspec/specs/. -->

## Impact

- Código: `lib/Shift.js`, `lib/ShiftWorklogs.js`, `lib/OfflineData.js`, `lib/ShiftInactivity.js`, `lib/provider/ShiftTrackingProvider.js`, `lib/provider/helpers/index.js`, `lib/components/WithShiftTracking/index.js`. Se elimina `lib/provider/helpers/openShift.js`.
- Dependencias: `@janiscommerce/app-storage` `^1.1.0` → `^1.4.0` (mín. 1.3.0); `@janiscommerce/app-device-info` `^1.1.0` → `^1.3.0`.
- Comportamiento: primer arranque tras actualizar requiere internet para re-resolver el turno; worklogs offline no asociables al turno vigente se descartan.
- Tests: `__test__/Shift.test.js`, `__test__/ShiftTrackingProvider.test.js`, más tests nuevos de `ShiftWorklogs.getWorkLogsByShift` y del HOC.
