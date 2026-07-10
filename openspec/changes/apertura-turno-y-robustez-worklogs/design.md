## Context

La apertura de turno está dividida entre `Shift.open` (solo crea turnos) y el helper `provider/helpers/openShift.js`, que decide crear/reusar/adoptar y escribe el estado interno de `Shift` desde afuera. El análisis operativo del 06/07/2026 (`/var/www/janis-picking-app/docs/reviews/analisis-worklogs-vquesada-20260706.html`) evidenció fallas de estado local con una raíz común: estado (turno, worklog en curso, buffer offline) que diverge de la realidad sin mecanismos que garanticen su coherencia.

Invariantes de dominio confirmadas contra el código:
- `getUserOpenShift` filtra por `status: 'opened'` y devuelve `{}` si no hay turno abierto.
- El backend no gestiona `paused` (solo `opened`/`closed`); la pausa es local, consecuencia de una actividad pausante en curso.
- El backend no acepta `shiftId` en el payload de worklog; asocia por turno abierto al momento del POST. No se puede enviar a turnos expirados.
- `EXCLUDED_WORKLOG_TYPES = ['default-picking-work', 'default-delivery-work']` son las actividades que NO pausan.

## Goals / Non-Goals

**Goals:**
- Centralizar la resolución de apertura en `Shift.open` y eliminar el helper.
- Garantizar que un worklog offline solo se envíe al turno al que pertenece.
- Invalidar el estado operativo local ante cambios de versión de la app.
- Garantizar que la pausa refleje siempre una actividad pausante en curso.

**Non-Goals:**
- Corregir la generación de la fecha corrupta de inactividad (bug ortogonal, follow-up).
- Fusionar `reOpen` con `open`.
- Cambiar el contrato hacia el consumidor (el `status` `paused` se mantiene).
- Soportar el primer arranque post-actualización sin conexión.

## Decisions

### D1 — `open` orquesta la apertura; sigue devolviendo solo el id
`open` absorbe la decisión nueva/reuso/adopción (obtiene `userId`, consulta el remoto) y devuelve siempre el id vigente. Alternativa considerada: mantener `open` como primitiva y crear `resolveOpenShift`. Se descartó por el pedido de que la lógica de apertura viva únicamente en `open`. La rama nueva usa `!userId || isEmptyObject(remoteShift)` (no `status !== 'opened'`, que es redundante porque `getUserOpenShift` ya filtra por abierto).

### D2 — `getWorkLogs` derivado por comparación de ids
La señal para rehidratar worklogs se deriva en la inicialización: `getWorkLogs = shiftId !== previousShiftId`. `open` no expone ese flag (semántica de UI fuera del dominio del turno). Reproduce el comportamiento actual (nueva/adopción → true, reuso → false).

### D3 — `reOpen` no se unifica
Comparte el endpoint `StaffService.openShift` con `open`, pero su intención (reabrir la misma shift ante `shift-closed error` y extender `dateToClose`) es distinta. Unificar rompería el contrato de `_withReopenRetry`, que debe reintentar sobre la shift en curso; con la resolución de `open` podría adoptar/crear otro turno y enviar worklogs al turno equivocado.

### D4 — `shiftId` local en el buffer, filtrado en el drenado
Como el backend no acepta `shiftId` en el payload, la asociación se garantiza por flujo: se estampa el `shiftId` de origen en cada registro offline (uso local) y se drena solo lo del turno vigente. El estampado va en `_saveOffLineWorkLogs` (choke point de open y finish) para cubrir el cierre offline de un worklog abierto online. No se agrega `userId`: es redundante (un `shiftId` pertenece a un único usuario).

### D5 — Compactación del buffer en la lectura
`_getOffLineWorkLogs` filtra por turno vigente y, si detecta huérfanos (longitud distinta), reescribe el buffer dejando solo los del turno. Es un getter con efecto de escritura, aceptado a propósito: pone la defensa contra el atasco en el punto exacto del bug (el drenado), sin depender de que `open` limpie.

### D6 — Invalidación por versión del estado operativo
`expireWithVersion` sobre las 7 keys operativas. La rehidratación emerge de `open`: al invalidarse `SHIFT_ID`, `previousShiftId` es `null`, `open` adopta el turno remoto y `getWorkLogs` resulta `true`. Alternativa considerada: solo `OFFLINE_DATA`; se descartó porque dejaba estados incoherentes (worklog en curso huérfano) al reusar el turno.

### D7 — Pausa: prevención + red de vista (sin método reconcile)
Raíz: `paused` se almacena aunque sea derivable de la actividad, y `openWorkLog` lo escribe en dos operaciones no atómicas. Se reordena `openWorkLog` (actividad antes que status) para que un corte deje `opened` con actividad (recuperable) en vez de `paused` sin actividad. Los estados heredados se limpian con la invalidación por versión (D6). El HOC `WithShiftTracking` suma una red: muestra la pausa solo con actividad pausante válida. Alternativas descartadas: método `reconcilePauseStatus`/corrección inline (mutación correctiva innecesaria si se previene y se limpia por versión) y eliminar `paused` del status (rompe el contrato con el consumidor).

### D8 — Inactividad: eliminar el marcador al cambiar de turno
El worklog de inactividad lo genera el package en `WithInactivityDetection.startInactivityWorkLog`, con `startDate = lastTimerResetAt + timeOut`. `LAST_TIMER_RESET_AT` persiste en storage y solo se borra en `ShiftInactivity.stopTimer`, que no corre ante un kill abrupto del proceso ni al cambiar de turno (`deleteShiftRegisters` no lo toca). Un marcador stale de un turno anterior hace que, al montar el HOC, `elapsedTime >= timeOut` dispare una inactividad con fecha retroactiva (causa de la fecha corrupta del análisis). Decisión: eliminar `LAST_TIMER_RESET_AT` cuando `open` cambia la identidad del turno (ramas nueva y adopción). Con eso, el marcador siempre proviene de actividad dentro del turno vigente, por lo que `resetAt >= inicioTurno` y la fecha anterior al turno se vuelve imposible por construcción. Para no acoplar `Shift` a la key de inactividad, la purga se expone desde `ShiftInactivity` y `open` la invoca. Alternativa descartada: validar el `startDate` en `openWorkLog` y rechazar — rechaza el síntoma pero no purga el marcador stale, dejando un reintento silencioso perpetuo en cada foco del HOC.

## Risks / Trade-offs

- Primer arranque post-actualización sin internet → `open` falla (necesita `getUserOpenShift`). Mitigación: actualizar la app implica conectividad; se documenta como supuesto.
- Worklogs offline pendientes legítimos del turno vigente se pierden al actualizar (invalidación de `OFFLINE_DATA`) → Mitigación: coherente con la política de descartar datos cuya integridad no se puede garantizar entre binarios; el riesgo de arrastrar fechas corruptas es peor.
- `_getOffLineWorkLogs` con efecto de escritura puede sorprender → Mitigación: documentar el comportamiento y cubrirlo con tests.
- La red de vista del HOC solo protege el componente del package; si el consumidor lee `shiftStatus` crudo, la coherencia la dan D6 + D7 → Mitigación: se mantiene el `status` crudo correcto mediante prevención + invalidación.
- Upgrade de dependencias (`app-storage`, `app-device-info`) podría introducir cambios → Mitigación: `app-storage` 1.4.0 mantiene el default export; verificar suite de tests tras el bump.

## Migration Plan

1. Bump de dependencias y verificación de la suite existente.
2. Implementar Bloques por capability (apertura, offline-worklogs, invalidación, pausa).
3. Migrar/eliminar tests del helper `openShift`.
4. Publicar en versión nueva: la invalidación por versión limpia estados heredados de usuarios afectados al actualizar.
5. Rollback: revertir el package a la versión previa; el estado local viejo vuelve a leerse (sin invalidación).

## Open Questions

- ¿Conviene exponer un `OfflineData.replaceAll(records)` para la compactación en lugar de `deleteAll` + `save` en loop? (detalle de implementación)
- Registrar por separado el bug de generación de la fecha de inactividad (follow-up).
