## ADDED Requirements

### Requirement: Resolución unificada de apertura en `Shift.open`

`Shift.open` SHALL ser el único responsable de resolver el turno vigente al inicializar. MUST obtener el `userId` internamente, consultar el turno abierto remoto del usuario y resolver uno de tres caminos (nueva, reuso, adopción), devolviendo SIEMPRE el id del turno vigente sin exponer flags adicionales.

#### Scenario: Sin usuario o sin turno abierto remoto (nueva)
- **WHEN** `open` se ejecuta y no hay `userId`, o `getUserOpenShift` devuelve un objeto vacío
- **THEN** el sistema SHALL limpiar todo el estado local (`deleteShiftRegisters`), crear un turno nuevo en el staff MS, persistir su id/data/status (`opened`) y devolver el nuevo id

#### Scenario: Turno remoto abierto con el mismo id (reuso)
- **WHEN** `open` obtiene un turno remoto abierto cuyo id coincide con `Shift.id`
- **THEN** el sistema SHALL no modificar ningún estado local y devolver el id vigente

#### Scenario: Turno remoto abierto con id distinto (adopción)
- **WHEN** `open` obtiene un turno remoto abierto cuyo id difiere de `Shift.id`
- **THEN** el sistema SHALL limpiar el worklog en curso, adoptar el turno remoto (id/status/data) y devolver el id remoto

#### Scenario: Falla en la resolución
- **WHEN** cualquier operación dentro de `open` lanza un error
- **THEN** el sistema SHALL registrar el error parseado en Crashlytics y rechazar la promesa con ese error

### Requirement: Derivación de la necesidad de rehidratar worklogs

La inicialización del provider SHALL derivar si debe rehidratar el historial de worklogs comparando el id del turno previo contra el id devuelto por `Shift.open`, sin depender de un flag producido por la lógica de apertura.

#### Scenario: La identidad del turno cambió
- **WHEN** el id devuelto por `open` difiere del id previo a la llamada
- **THEN** el sistema SHALL marcar que se deben obtener los worklogs del turno

#### Scenario: La identidad del turno se conservó
- **WHEN** el id devuelto por `open` es igual al id previo a la llamada
- **THEN** el sistema SHALL no obtener los worklogs, preservando el estado local (incluidos los pendientes offline)

### Requirement: Eliminación del helper de apertura del provider

El sistema SHALL dejar de exponer el helper `openShift` del provider; toda la lógica de apertura vive en `Shift.open`. El provider SHALL invocar el callback de error de apertura (`onError`) al fallar la resolución.

#### Scenario: Error de apertura durante la inicialización
- **WHEN** `Shift.open` rechaza durante `shiftInitialization`
- **THEN** el provider SHALL invocar `onError` con el error, exponer un error de tipo `openShift` y detener la carga

### Requirement: Rehidratación del worklog en curso como dominio de `Shift`

La rehidratación del worklog en curso SHALL vivir en `Shift.refreshWorkLogs`: obtener los worklogs del turno vigente, detectar el que está en progreso, persistirlo y ajustar el estado del turno de forma coherente con la actividad. El provider SHALL invocar ese método y encargarse solo del estado de presentación (error y señal de UI), sin manipular `Shift.setCurrentWorkLog` ni `Shift.status` desde afuera.

#### Scenario: Worklog en curso pausante
- **WHEN** `refreshWorkLogs` encuentra un worklog en progreso válido no excluido
- **THEN** el sistema SHALL persistirlo como worklog en curso y cambiar el estado del turno a `paused`

#### Scenario: Worklog en curso excluido
- **WHEN** `refreshWorkLogs` encuentra un worklog en progreso válido pero excluido
- **THEN** el sistema SHALL persistirlo como worklog en curso y NO SHALL pausar el turno

#### Scenario: Sin worklog en curso
- **WHEN** `refreshWorkLogs` no encuentra un worklog en progreso válido
- **THEN** el sistema SHALL no modificar el worklog en curso

### Requirement: `reOpen` permanece como flujo independiente

`reOpen` SHALL operar siempre sobre el turno en curso (reabrirlo ante un `shift-closed error` y extender su fecha de cierre) y NO SHALL resolver, crear ni adoptar otro turno.

#### Scenario: Reintento tras turno cerrado
- **WHEN** una operación falla con un error de turno cerrado y se dispara `_withReopenRetry`
- **THEN** el sistema SHALL reabrir la misma shift vigente (sin cambiar su id) y reintentar la operación original
