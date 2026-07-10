## ADDED Requirements

### Requirement: Asociación de worklogs offline a su turno de origen

Cada registro persistido en el buffer offline SHALL incluir el `shiftId` del turno vigente al momento de guardarlo. El `shiftId` es de uso local y NO SHALL enviarse en el payload al backend (el backend asocia el worklog al turno abierto en el momento del POST).

#### Scenario: Guardar worklog offline
- **WHEN** se persiste un worklog en el buffer offline mediante `_saveOffLineWorkLogs`
- **THEN** el registro SHALL incluir `shiftId` con el id del turno vigente, además de `referenceId` y las fechas presentes

#### Scenario: Cierre offline de un worklog abierto online
- **WHEN** un worklog se abrió con conexión y se cierra sin conexión, creando su único registro offline en el `finish`
- **THEN** ese registro SHALL incluir el `shiftId` del turno vigente para no ser descartado como huérfano

### Requirement: Filtrado del buffer offline por turno vigente

Al drenar el buffer offline, el sistema SHALL enviar únicamente los registros cuyo `shiftId` coincide con el turno vigente. `ShiftWorklogs` SHALL exponer un método puro `getWorkLogsByShift(offlineWorkLogs, shiftId)` que filtra los registros por turno.

#### Scenario: Registros de otro turno en el buffer
- **WHEN** el buffer contiene registros de un turno distinto al vigente
- **THEN** esos registros SHALL quedar excluidos del envío al backend

#### Scenario: Registros del turno vigente
- **WHEN** el buffer contiene registros cuyo `shiftId` coincide con el turno vigente
- **THEN** esos registros SHALL incluirse en el drenado

### Requirement: Compactación del buffer descartando huérfanos

Cuando el buffer contenga registros que no pertenecen al turno vigente (dato muerto irrecuperable, ya que no pueden re-asociarse), el sistema SHALL descartarlos del almacenamiento, dejando solo los del turno vigente. Esto SHALL evitar el atasco del buffer por reintentos en bucle.

#### Scenario: Hay huérfanos en el buffer
- **WHEN** la cantidad de registros del buffer difiere de la cantidad de registros del turno vigente
- **THEN** el sistema SHALL reemplazar el contenido del buffer dejando únicamente los registros del turno vigente

#### Scenario: No hay huérfanos
- **WHEN** todos los registros del buffer pertenecen al turno vigente
- **THEN** el sistema SHALL no modificar el buffer
