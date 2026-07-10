## ADDED Requirements

### Requirement: Invalidación del estado operativo por versión de la app

El estado operativo local del turno SHALL invalidarse automáticamente cuando cambie la versión de la app, mediante la opción `expireWithVersion` de `@janiscommerce/app-storage`. Las keys marcadas MUST ser: `SHIFT_ID`, `SHIFT_STATUS`, `SHIFT_DATA`, `CURRENT_WORKLOG_ID`, `CURRENT_WORKLOG_DATA`, `OFFLINE_DATA` y `LAST_TIMER_RESET_AT`. Las cachés con TTL propio (`WORKLOG_TYPES_DATA`, `STAFF_SETTINGS`) NO SHALL marcarse.

#### Scenario: Lectura tras cambio de versión
- **WHEN** se lee una key marcada con `expireWithVersion` y la versión de la app difiere de la almacenada
- **THEN** el sistema SHALL invalidar la key y devolver `null`

#### Scenario: Lectura en la misma versión
- **WHEN** se lee una key marcada con `expireWithVersion` sin cambio de versión
- **THEN** el sistema SHALL devolver el valor almacenado

### Requirement: Rehidratación coherente tras invalidación

Tras invalidarse el estado del turno por versión, la re-resolución SHALL emerger de la maquinaria de `Shift.open` sin lógica especial de detección de versión: el turno se re-resuelve y, si su identidad cambió, se rehidrata el worklog en curso desde el backend.

#### Scenario: Worklog abierto que existe en el backend
- **WHEN** el estado se invalidó por versión y el turno tenía un worklog abierto registrado en el backend
- **THEN** el sistema SHALL re-resolver el turno y rehidratar el worklog en curso desde el backend

#### Scenario: Worklog abierto solo offline (perdido)
- **WHEN** el estado se invalidó por versión y el worklog en curso solo existía en el buffer offline
- **THEN** el worklog en curso SHALL quedar vacío y una finalización SHALL fallar de forma controlada en lugar de enviar un cierre huérfano

### Requirement: Dependencias mínimas para invalidación por versión

El package SHALL declarar `@janiscommerce/app-storage` en `^1.4.0` (mínimo 1.3.0) y `@janiscommerce/app-device-info` en `^1.3.0`, requeridos para `expireWithVersion`.

#### Scenario: Dependencia de versión ausente
- **WHEN** `@janiscommerce/app-device-info` no está disponible
- **THEN** la invalidación por versión SHALL desactivarse en silencio sin interrumpir el resto de las operaciones de storage
