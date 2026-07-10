## ADDED Requirements

### Requirement: El marcador de inactividad se elimina al cambiar de turno

`LAST_TIMER_RESET_AT` SHALL eliminarse cada vez que `Shift.open` cambia la identidad del turno (ramas nueva y adopción). En el reuso (mismo turno) NO SHALL eliminarse. Esto garantiza que el marcador siempre corresponda al turno vigente y nunca sea anterior a su inicio.

#### Scenario: Apertura de un turno nuevo
- **WHEN** `open` crea un turno nuevo (rama nueva)
- **THEN** el sistema SHALL eliminar `LAST_TIMER_RESET_AT`

#### Scenario: Adopción de un turno remoto distinto
- **WHEN** `open` adopta un turno remoto con id distinto al local (rama adopción)
- **THEN** el sistema SHALL eliminar `LAST_TIMER_RESET_AT`

#### Scenario: Reuso del turno vigente
- **WHEN** `open` reusa el turno con el mismo id
- **THEN** el sistema SHALL conservar `LAST_TIMER_RESET_AT`

### Requirement: La inactividad no genera fechas anteriores al turno

Como consecuencia de eliminar el marcador al cambiar de turno, la detección de inactividad NO SHALL generar un worklog de inactividad con `startDate` anterior al inicio del turno vigente producido por un marcador de un turno anterior.

#### Scenario: Marcador heredado de un turno anterior
- **WHEN** existía un `LAST_TIMER_RESET_AT` de un turno anterior y se abre un turno distinto
- **THEN** el marcador SHALL haberse eliminado en la apertura, de modo que la detección de inactividad parta de un estado limpio y no dispare una inactividad con fecha retroactiva
