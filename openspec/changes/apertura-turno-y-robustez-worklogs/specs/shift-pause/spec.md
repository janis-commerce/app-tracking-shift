## ADDED Requirements

### Requirement: Coherencia entre pausa y actividad en curso

El estado `paused` es exclusivo del package y SHALL representar siempre una actividad pausante en curso (worklog válido cuyo `referenceId` no pertenece a `EXCLUDED_WORKLOG_TYPES`). El estado del turno SHALL reflejar siempre la actividad en curso en los flujos que la manejan (`openWorkLog`, `finishWorkLog`).

#### Scenario: Escritura de estado y actividad en `openWorkLog`
- **WHEN** se abre un worklog mediante `openWorkLog`
- **THEN** el sistema SHALL persistir la actividad en curso ANTES de ajustar el estado, de modo que un corte del proceso deje `opened` con actividad (recuperable) y nunca `paused` sin actividad

#### Scenario: Apertura de un worklog pausante
- **WHEN** se abre un worklog pausante (válido y no excluido) mediante `openWorkLog`
- **THEN** el sistema SHALL cambiar el estado del turno a `paused`

#### Scenario: Apertura de un worklog no pausante
- **WHEN** se abre un worklog no pausante (excluido) mediante `openWorkLog` estando el turno `paused`
- **THEN** el sistema SHALL devolver el estado del turno a `opened`

#### Scenario: Estado paused huérfano heredado
- **WHEN** un usuario tiene un estado `paused` sin actividad en curso proveniente de una versión anterior
- **THEN** al actualizar la app la invalidación por versión SHALL limpiar el estado y `open` SHALL re-resolver el turno de forma coherente

### Requirement: Presentación de la pausa condicionada a actividad pausante

El HOC `WithShiftTracking` SHALL mostrar el `pausedShiftComponent` únicamente cuando el turno esté `paused` Y exista una actividad en curso válida cuyo `referenceId` no esté en `EXCLUDED_WORKLOG_TYPES`.

#### Scenario: Pausa con actividad pausante válida
- **WHEN** el turno está `paused` y hay un worklog en curso válido no excluido
- **THEN** el HOC SHALL mostrar el `pausedShiftComponent`

#### Scenario: Pausa sin actividad en curso
- **WHEN** el turno está `paused` pero no hay worklog en curso válido
- **THEN** el HOC SHALL no mostrar el `pausedShiftComponent`, permitiendo al usuario operar y evitando el bloqueo al reanudar

#### Scenario: Actividad en curso excluida
- **WHEN** el turno está `paused` pero el worklog en curso pertenece a `EXCLUDED_WORKLOG_TYPES`
- **THEN** el HOC SHALL no mostrar el `pausedShiftComponent`
