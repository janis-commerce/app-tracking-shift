## 1. Dependencias

- [x] 1.1 Actualizar `@janiscommerce/app-storage` a `^1.4.0` y `@janiscommerce/app-device-info` a `^1.3.0` en `package.json`
- [x] 1.2 Reinstalar e ejecutar la suite de tests existente para verificar que el bump no rompe nada

## 2. Apertura unificada (`shift-opening`)

- [x] 2.1 Reescribir `Shift.open` con las ramas nueva/reuso/adopción; agregar imports `getUserId` e `isEmptyObject`
- [x] 2.2 Eliminar `lib/provider/helpers/openShift.js` y su export en `lib/provider/helpers/index.js`
- [x] 2.3 Actualizar `shiftInitialization` para llamar `Shift.open`, derivar `getWorkLogs = shiftId !== previousShiftId` e invocar `onError` inline
- [x] 2.4 Tests de las tres ramas de `open` en `__test__/Shift.test.js`; migrar/eliminar tests de `openShift.js`
- [x] 2.5 Tests de `shiftInitialization` en `__test__/ShiftTrackingProvider.test.js` (derivación de `getWorkLogs`, manejo de `onError`)

## 3. Worklogs offline por turno (`offline-worklogs`)

- [x] 3.1 Agregar `shiftId: this.id` en `_saveOffLineWorkLogs`
- [x] 3.2 Implementar `ShiftWorklogs.getWorkLogsByShift(offlineWorkLogs, shiftId)` (función pura)
- [x] 3.3 Modificar `_getOffLineWorkLogs` para filtrar por turno vigente y compactar el buffer descartando huérfanos
- [x] 3.4 (Opcional) Agregar `OfflineData.replaceAll(records)` para la compactación
- [x] 3.5 Tests: `getWorkLogsByShift`, estampado de `shiftId` (incluye cierre offline de worklog abierto online), filtrado y compactación

## 4. Invalidación por versión (`storage-version-invalidation`)

- [x] 4.1 Agregar `{expireWithVersion: true}` en los setters `id`/`status`/`data` y en `setCurrentWorkLog` de `Shift.js`
- [x] 4.2 Agregar `{expireWithVersion: true}` en `OfflineData.save` y `OfflineData.delete`
- [x] 4.3 Agregar `{expireWithVersion: true}` en `ShiftInactivity.startTimer` (`LAST_TIMER_RESET_AT`)
- [x] 4.4 Tests de invalidación por versión (mock de `app-device-info`) y de rehidratación coherente vía `open`

## 5. Pausa coherente (`shift-pause`)

- [x] 5.1 Reordenar `openWorkLog`: escribir la actividad (`setCurrentWorkLog`) antes de `_changeStatus('paused')`
- [x] 5.2 Condicionar `showPause` en `WithShiftTracking` a estado `paused` + worklog en curso válido no excluido
- [x] 5.3 Tests: reordenamiento de `openWorkLog` y condición del HOC (con/sin actividad, actividad excluida)

## 6. Marcador de inactividad (`inactivity-timer`)

- [x] 6.1 Exponer desde `ShiftInactivity` una purga de `LAST_TIMER_RESET_AT` (eliminar marcador + limpiar timer)
- [x] 6.2 Invocar la purga en `Shift.open` en las ramas nueva (junto a `deleteShiftRegisters`) y adopción
- [x] 6.3 Tests: marcador eliminado en nueva/adopción, conservado en reuso; la inactividad no dispara fecha anterior al turno

## 7. Cierre

- [x] 7.1 Ejecutar la suite completa y verificar cobertura
- [x] 7.2 Actualizar `CHANGELOG.md`
