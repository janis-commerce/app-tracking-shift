# HDI-3441 — La inactividad se reportaba con fecha futura

**Paquete:** `@janiscommerce/app-tracking-shift` · **Versión:** 2.3.3-beta.0 · **App afectada:** Picking · **Fecha:** 28/07/2026

---

## De qué se trata

La aplicación de Picking registra qué está haciendo el operario a lo largo de su turno. Si deja de interactuar con la pantalla durante cierta cantidad de minutos —un tiempo que se configura por cliente—, la app abre automáticamente un registro de **inactividad**. Cuando el operario vuelve y toca **"Reanudar actividad"**, ese registro se cierra y se retoma la tarea.

El ticket reportaba que ese registro de inactividad estaba quedando con una hora de inicio **que todavía no había llegado**, y que el operario quedaba trabado al intentar volver a su tarea.

Al investigarlo encontramos **dos fallas distintas**, con causas que no tienen nada que ver entre sí, pero que se cruzaban en el mismo escenario y se veían como un único problema:

| | Falla | Estado |
|---|---|---|
| **1** | El registro de inactividad se creaba con una hora de inicio ubicada en el futuro | Reportada en el ticket |
| **2** | En un caso puntual, la app generaba registros de inactividad sin parar y quedaba trabada | **No** estaba reportada: apareció durante las pruebas |

Las dos quedaron corregidas y verificadas en un dispositivo real.

---

## Falla 1 — El registro de inactividad arrancaba en el futuro

### Qué se veía

- Al tocar **"Reanudar actividad"**, la app devolvía el error *"The activity's end date is earlier than its start date"* (la fecha de fin es anterior a la de inicio). El operario quedaba trabado: podía reintentar todas las veces que quisiera y siempre fallaba, hasta que el reloj real alcanzaba esa hora inventada. Según el tiempo de inactividad configurado para el cliente, eso podía ser varios minutos de no poder trabajar.
- El contador que se muestra en la pantalla de inactividad mostraba números raros. Un cliente reportó textualmente `0-1:0-9:0-2`. Eso no es un formato roto al azar: son valores negativos, y con ese dato se puede reconstruir que la hora de inicio estaba **8 minutos y 2 segundos adelantada**.
- Al sistema de personal llegaban registros con horarios incoherentes, tanto el de inactividad como el de la tarea anterior, lo que ensuciaba el reporte de actividades del operario.

### Por qué pasaba

Para armar el registro, la app necesita saber **en qué momento empezó la inactividad**. Ese dato no se guardaba. Lo que se guardaba era otra cosa: **la hora de la última vez que el operario tocó la pantalla**. Y el inicio de la inactividad se *calculaba* sumándole el tiempo de inactividad configurado.

Es como si en lugar de anotar *"la pava silba a las 10:10"* anotáramos *"puse la pava a las 10:00"* y diéramos por hecho que siempre silba diez minutos después. Funciona mientras nadie toque la hornalla.

Y acá alguien tocaba la hornalla. Cuando el operario cierra la app (o la manda a segundo plano) y vuelve **antes** de que se cumpla el tiempo de inactividad, la app hace algo correcto: en lugar de arrancar el conteo de cero, lo arranca solamente por el tiempo que falta. El problema es que, al hacerlo, **también actualizaba la hora de "última vez que tocó la pantalla" poniendo la hora actual** — aunque el operario no hubiera tocado nada. Ese dato quedaba mintiendo, y la suma que dependía de él daba un momento futuro.

**Ejemplo con un tiempo de inactividad de 10 minutos:**

| Hora | Qué pasa |
|---|---|
| **10:00** | El operario interactúa con la pantalla. Se guarda "última interacción: 10:00" y arranca un conteo de 10 minutos. |
| **10:03** | Cierra la app. El conteo muere, pero el dato guardado sobrevive. |
| **10:05** | Vuelve a abrir la app. La app calcula bien: "ya pasaron 5 minutos, arranco un conteo por los 5 que faltan". **Pero además pisa el dato: ahora dice "última interacción: 10:05"**, aunque el operario no tocó nada. |
| **10:10** | Se cumplen los 5 minutos y salta la inactividad. La cuenta hace 10:05 + 10 minutos y da **10:15**: cinco minutos en el futuro. |
| **10:11** | El operario toca "Reanudar actividad". La app intenta cerrar un registro que, según sus propios datos, todavía no empezó. Error, y sigue fallando hasta las 10:15. |

Mientras tanto, el contador de la pantalla muestra "cuánto tiempo pasó desde que empezó la inactividad", que en este caso da negativo: de ahí los números raros.

### Dos aclaraciones importantes

**Es una regresión.** El cálculo se cambió en mayo de 2026. La idea nueva —"la inactividad empezó cuando se cumplió el tiempo de espera"— es conceptualmente más correcta que la anterior, pero solo se sostiene si el conteo corrió completo. Los reinicios parciales, que son los que ocurren al volver a la app, la rompían.

**No era el reloj del celular.** Un análisis previo atribuía el problema a que el reloj del dispositivo se hubiera atrasado. Eso quedó descartado: la falla es predecible, se puede reproducir a voluntad y no necesita ninguna condición rara del entorno. Un reloj alterado igual produciría el mismo síntoma, pero no hacía falta para explicar lo reportado.

---

## Falla 2 — La app generaba registros de inactividad sin parar

Esta falla no estaba en el ticket. Apareció mientras probábamos la corrección de la primera, y **comprobamos que ya existía antes de nuestros cambios**: la reprodujimos igual con el código original.

### Qué se veía

Al volver a abrir la app cuando el tiempo de inactividad **ya se había cumplido por completo**, la aplicación quedaba sin responder. Por detrás estaba creando un registro de inactividad nuevo aproximadamente cada medio segundo, de forma indefinida. Además, el envío al sistema de personal nunca terminaba, porque el ciclo consumía toda la capacidad de procesamiento.

### Por qué pasaba

La pantalla no lee el estado del turno directamente del almacenamiento del celular. Lo lee de una especie de **pizarra compartida** que se mantiene actualizada gracias a unos "vigilantes": cada uno se queda atento a un dato y, cuando ese dato cambia en el almacenamiento, lo copia a la pizarra.

El registro de la actividad en curso se guarda en dos partes, una inmediatamente después de la otra: **su identificador** y **sus datos** (qué tipo de actividad es, cuándo empezó, etc.).

Lo que descubrimos es que **el vigilante de los datos se estaba desconectando y volviendo a conectar todo el tiempo**, en cada refresco de la pantalla. El vigilante del identificador no tenía ese problema y se mantenía siempre conectado.

Pensalo como dos teléfonos esperando una noticia. Uno está siempre descolgado y atiende bien. Al otro lo cuelgan y lo vuelven a discar constantemente, y la llamada llega justo en el segundo en que está colgado.

En este camino en particular, la escritura del registro ocurre exactamente en medio del refresco de la pantalla, es decir, justo cuando el vigilante de los datos está desconectado. Resultado: **la pizarra se enteraba del identificador nuevo, pero se quedaba con los datos viejos.**

Y de ahí sale el ciclo sin fin:

1. La app abre un registro de inactividad.
2. La verificación que debería decir "ya estamos en inactividad, no hace falta abrir otro" mira **los datos**, que quedaron viejos. Entonces no frena nada.
3. El **identificador**, que sí se actualizó, es justamente lo que hace que la pantalla se refresque y vuelva a revisar si corresponde abrir una inactividad.
4. Vuelve al punto 1.

Estuvo escondida todo este tiempo porque, en el uso normal, las escrituras no ocurren en medio del refresco de la pantalla: pasan cuando el operario toca un botón o cuando se cumple un temporizador, momentos en los que el vigilante sí está conectado y todo funciona.

---

## Cómo lo corregimos

### Corrección de la falla 1 — Guardar cuándo vence, en lugar de cuándo fue la última actividad

Volvamos a la pava. En lugar de anotar *"puse la pava a las 10:00"* y hacer la cuenta cada vez, ahora anotamos directamente *"la pava silba a las 10:10"*. Es el dato que realmente nos interesa, y no hay ninguna cuenta que pueda salir mal.

Concretamente: la app dejó de guardar la hora de la última interacción y ahora guarda **el momento en que se cumple el tiempo de inactividad**. Cuando eso ocurre, el inicio del registro se lee de ahí, sin sumas ni suposiciones. El dato pasó a llamarse `TIMER_EXPIRES_AT` en lugar de `LAST_TIMER_RESET_AT`.

Lo que hace robusta esta solución es una propiedad que antes no existía: **todos los conteos legítimos de un mismo ciclo terminan en el mismo momento.** Volviendo al ejemplo: el conteo completo que arrancó a las 10:00 vence a las 10:10, y el conteo parcial de 5 minutos que se armó a las 10:05 vence *también* a las 10:10. Distinta duración, distinto momento de arranque, mismo vencimiento.

Por eso pisar el dato dejó de ser peligroso: cualquier reinicio legítimo escribe **el mismo valor que ya estaba**. La pregunta "¿quién tiene permitido escribir este dato y quién no?" simplemente desaparece. Con la hora de última interacción, en cambio, cada escritura destruía el dato anterior de forma irrecuperable.

Sumamos además **dos topes de seguridad**, que no cambian nada en el funcionamiento normal y solo actúan si algo se saliera de lo esperado:

- El inicio de una inactividad nunca puede ser posterior al momento en que se detecta.
- Un conteo reanudado nunca puede durar más que el tiempo de inactividad configurado.

Estos dos topes cubren el caso del reloj del celular atrasado, que era la otra vía posible hacia el mismo síntoma.

### Corrección de la falla 2 — Que el vigilante se quede conectado

El vigilante se desconectaba por un detalle técnico: recibía su "valor por defecto" (el que usa cuando todavía no hay nada guardado) como un objeto que se creaba de nuevo en cada refresco. Como para el sistema un objeto nuevo es un cambio, interpretaba que había que desconectar y volver a conectar.

Ahora ese valor por defecto se guarda en un lugar fijo, así que ya no se percibe como un cambio. **El vigilante se conecta una sola vez y se queda.** No hay más ventanas en las que una escritura pueda pasar desapercibida.

Como refuerzo, en el momento de conectarse el vigilante vuelve a leer el dato, para cubrir la posibilidad de que algo se haya escrito entre la lectura inicial y la conexión.

Vale aclarar que **esta corrección alcanza más de lo que el ticket reportaba**: ese mismo mecanismo alimenta todos los datos del turno en la pizarra compartida, y cuatro de ellos tenían exactamente la misma debilidad, todavía sin manifestarse.

---

## Qué alternativas evaluamos para la falla principal

Antes de decidir, analizamos tres caminos. El criterio que definió la elección fue **dónde queda garantizada la corrección**: una solución que depende de que cada persona que toque el código en el futuro la use correctamente es más frágil que una donde el dato, por su propia naturaleza, no puede quedar mal.

### 1. Guardar el momento de vencimiento — **la elegida**

Es la que se explicó arriba: se guarda el dato que realmente se necesita, en lugar de guardar uno intermedio y calcular.

**Por qué la elegimos:** elimina la categoría completa del problema, no un caso puntual. No hay cuenta que pueda fallar, ni forma de arruinar el dato usándolo mal, porque cualquier escritura legítima escribe lo mismo. Además simplificó el código que lo consume, en lugar de agregarle condiciones.

### 2. Un parámetro para indicar "no pises el dato" — descartada

Era la propuesta del análisis original: seguir guardando la hora de última interacción, pero agregar un parámetro para que los reinicios parciales no la sobrescriban.

**Por qué la descartamos:** funciona, pero deja la trampa armada. Ese parámetro existe únicamente para resolver el caso de un consumidor puntual, y cualquier llamada futura que se olvide de pasarlo **vuelve a introducir la falla en silencio**, sin que ninguna prueba lo detecte. La corrección quedaría dependiendo de la memoria de quien escriba el próximo cambio.

### 3. Un método aparte para reanudar el conteo — descartada

En lugar de un parámetro, tener dos operaciones con nombres distintos: una para "empezar un ciclo nuevo" y otra para "continuar uno que ya venía".

**Por qué la descartamos:** es mejor que el parámetro, porque los nombres comunican la intención y es más difícil equivocarse. Pero deja viva la cuenta original y su suposición de fondo ("el conteo corrió completo"), que es el verdadero origen del problema. Arreglaba el síntoma con mejor forma, no la causa.

### Qué tomamos del análisis original

Ese análisis planteaba tres niveles de corrección:

- **Nivel 1** (el parámetro para no pisar el dato) → **reemplazado** por la alternativa elegida.
- **Nivel 2** (limitar el inicio de la inactividad al momento actual) → **incorporado**, es uno de los dos topes de seguridad.
- **Nivel 3** (dejar de trabar al operario ante cualquier inconsistencia futura de fechas al cerrar un registro) → **quedó fuera de alcance**. Modifica el comportamiento de una función que otras apps consumen, así que conviene evaluarlo por separado y revisar antes quién depende de ese error. Sigue siendo una mejora válida y pendiente.

---

## Cómo lo verificamos

Probamos en un dispositivo real, reproduciendo el escenario exacto de la falla: trabajar en el flujo de preparación, cerrar la app **antes** de que se cumpla el tiempo de inactividad, volver a abrirla sin tocar nada y esperar a que salte la inactividad.

**La prueba de que la corrección funciona** está en el reinicio parcial. Ocurrió con una duración distinta (80 segundos en lugar de los 180 configurados) y en otro momento, y sin embargo registró **el mismo vencimiento** que el arranque original: la diferencia fue de un solo milisegundo. Eso es exactamente la propiedad que buscábamos.

Y el resultado final:

| | Valor |
|---|---|
| Hora de inicio registrada | 22 milisegundos **en el pasado**, coincidiendo con el vencimiento real |
| Lo que habría pasado con el código anterior | Hora de inicio **100 segundos en el futuro** |
| Registros de inactividad generados | 1 (antes: uno cada medio segundo, sin parar) |
| "Reanudar actividad" | Cerró al primer intento, sin errores |
| Pruebas automatizadas | 180 en verde |

El último punto es el más importante desde el lado del usuario: **el operario pudo retomar su tarea sin quedar trabado**, que era el síntoma reportado en el ticket.

---

## Qué se modificó

| Componente | Modificación |
|---|---|
| Módulo de inactividad | Guarda el momento de vencimiento del conteo en lugar de la hora de última interacción |
| Detección de inactividad | Lee el vencimiento en lugar de calcularlo, e incorpora los dos topes de seguridad |
| Lector del almacenamiento | Mantiene su vigilante conectado de forma estable y relee el dato al conectarse |
| Nombre del dato guardado | `LAST_TIMER_RESET_AT` pasa a ser `TIMER_EXPIRES_AT` |
| Pruebas automatizadas | Adaptadas al dato nuevo. Suite completa en verde |

**Sobre el dato viejo que quedó en los celulares:** no hace falta ninguna migración. Al cambiar de nombre y estar configurado para invalidarse cuando cambia la versión de la app, el dato anterior se descarta solo en la primera apertura.

---

## Qué probar en QA

El escenario crítico es el que reproduce la falla, y tiene un detalle que es fácil pasar por alto: hay que cerrar la app **antes** de que se cumpla el tiempo de inactividad, no después.

1. Abrir turno y entrar al flujo de preparación.
2. Interactuar con la pantalla (esto es lo que registra la actividad).
3. Cerrar la app por completo y esperar **menos** que el tiempo de inactividad configurado.
4. Volver a abrirla y **no tocar la pantalla** hasta que aparezca la pantalla de inactividad.
5. Verificar que el contador **nunca muestre números negativos o raros**.
6. Tocar "Reanudar actividad" y verificar que cierra al primer intento, sin errores.

Conviene cubrir también el caso complementario, que es el que destapó la segunda falla: dejar la app cerrada por **más** que el tiempo de inactividad completo y volver a abrirla. La app tiene que responder con normalidad y generar un único registro de inactividad.

---

*Janis Commerce © 2026 · HDI-3441 · `@janiscommerce/app-tracking-shift` v2.3.3-beta.0*
