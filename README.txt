ÍNDICE
──────
  1.  Descripción general
  2.  Tecnologías y dependencias
  3.  Estructura de archivos
  4.  Arquitectura de módulos (patrón IIFE)
  5.  Módulo: configuracion.js
  6.  Módulo: autenticacion.js
  7.  Módulo: categorias.js
  8.  Módulo: productos.js
  9.  Módulo: clientes.js          
  10. Módulo: ventas.js           
  11. Módulo: empleados.js
  12. Módulo: reportes.js
  13. Módulo: app.js (orquestador)
  14. Base de datos Supabase — tablas
  15. Interfaz — estructura visual
  16. Sistema de roles
  17. Pantalla de bienvenida
  18. Flujo completo de una venta   ← actualizado
  19. Limitaciones conocidas
  20. Despliegue y requisitos


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. DESCRIPCIÓN GENERAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Montana Importados es un sistema de gestión de ventas (POS) desarrollado como
aplicación web de una sola página (SPA) sin framework. Está orientado a un
negocio de tecnología y permite administrar productos, clientes, ventas,
empleados, deudas y reportes desde una interfaz atractiva.

La aplicación corre completamente en el navegador. Utiliza Supabase como base
de datos en la nube (PostgreSQL), EmailJS para envío de correos, y Chart.js
para visualización de datos. No requiere servidor propio ni build process.

Módulos funcionales actuales:
  · Dashboard con KPIs, stock bajo, ventas recientes y tab de reportes
  · POS con carrito, descuentos y múltiples métodos de pago (incl. crédito/mixto)
  · Gestión de productos con subida de imágenes a Supabase Storage
  · Gestión de categorías con conteo de productos asociados
  · Gestión de clientes con ficha completa (compras + pagos + deuda)
  · Módulo de deudas con registro de pagos parciales o totales
  · Historial de ventas con detalle por venta
  · Reportes gráficos con exportación a PDF
  · Gestión de empleados y perfil personal
  · Configuración de datos de la empresa


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. TECNOLOGÍAS Y DEPENDENCIAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Frontend:
  ─────────
  · HTML5 / CSS3 / JavaScript ES6+ (Vanilla, sin framework)
  · Font Awesome 6.4.0 — iconografía
  · Google Fonts (Inter) — tipografía principal

  Backend / Servicios externos (CDN):
  ────────────────────────────────────
  · Supabase JS v2       — base de datos PostgreSQL en la nube + storage de imágenes
  · Chart.js             — gráficos de línea, dona y barras horizontales
  · EmailJS Browser v3   — envío de correos de recuperación de contraseña
  · jsPDF 2.5.1          — generación de archivos PDF
  · html2canvas 1.4.1    — captura de HTML para exportar a PDF

  Todas las dependencias se cargan desde CDN, sin instalación local.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. ESTRUCTURA DE ARCHIVOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  montana/
  ├── index.html                → Estructura HTML completa + todos los modales
  ├── LOGO.jpeg                 → Logotipo (debe estar en la raíz)
  ├── css/
  │   └── estilos.css           → Todos los estilos
  └── js/
      ├── configuracion.js      → Inicialización Supabase/EmailJS + utilidades
      ├── autenticacion.js      → Login, logout, recuperación de contraseña
      ├── categorias.js         → CRUD de categorías de productos
      ├── productos.js          → CRUD de productos + subida de imágenes
      ├── clientes.js           → CRUD de clientes + deudas + pagos + ficha de cliente
      ├── ventas.js             → POS (punto de venta) + historial + métodos mixtos
      ├── empleados.js          → CRUD de empleados + perfil del usuario activo
      ├── reportes.js           → Gráficos + exportación de reportes PDF
      └── app.js                → Orquestador: navegación, dashboard, inicialización

  Orden de carga de scripts (definido en index.html):
    configuracion.js → autenticacion.js → categorias.js → productos.js
    → clientes.js → ventas.js → empleados.js → reportes.js → app.js

  Este orden garantiza que window.appConfig esté disponible antes que cualquier
  módulo, y que todos los módulos estén listos antes que el orquestador (app.js).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. ARQUITECTURA DE MÓDULOS (PATRÓN IIFE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cada módulo funcional (salvo configuracion.js y app.js) sigue el patrón IIFE
(Immediately Invoked Function Expression) con API pública explícita:

  const NombreModulo = (() => {
      // Variables privadas
      let lista = [];

      // Funciones privadas (prefijo _)
      function _funcionInterna() { ... }

      // Funciones públicas
      async function cargar() { ... }

      // API pública expuesta
      return { cargar, otraFuncion };
  })();

  window.NombreModulo = NombreModulo;  // Exposición global para uso desde HTML

Esto logra encapsulamiento sin transpiladores: el estado interno de cada módulo
(listas en memoria, flags) no es accesible desde fuera salvo por los métodos
del return. Los módulos se comunican entre sí a través de window.NombreModulo.

Módulos y sus globales expuestos:
  window.Categorias   window.Productos   window.Clientes
  window.Ventas       window.Empleados   window.Reportes
  (Autenticacion no se expone en window, se usa solo desde app.js)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. MÓDULO: configuracion.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Responsabilidad:
  Centraliza credenciales, inicializa servicios externos y provee utilidades
  globales accesibles desde todos los módulos vía window.appConfig.

  Constantes:
  · SUPABASE_URL        — endpoint del proyecto Supabase
  · SUPABASE_ANON_KEY   — clave anónima pública de Supabase
  · EMAILJS_CONFIG      — { PUBLIC_KEY, SERVICE_ID, TEMPLATE_ID }

  Inicialización de Supabase:
  Se ejecuta al cargar el script. Crea el cliente con supabase.createClient().
  Si la biblioteca no está disponible, supabaseClient queda en null y el sistema
  muestra notificaciones de error sin romper la ejecución.

  Inicialización de EmailJS (inicializarEmailJS):
  Es lazy: intenta inicializar con reintentos cada 200ms hasta 20 veces (4s).
  Esto resuelve la condición de carrera entre la carga del CDN y la ejecución
  del script. Devuelve una Promise<boolean>.

  Utilidades expuestas en window.appConfig:
  · supabase           — cliente Supabase instanciado
  · emailjs            — objeto de configuración EmailJS
  · inicializarEmailJS — función de inicialización lazy con reintentos
  · mostrarNotificacion(mensaje, tipo) — toast animado (info/success/warning/error)
  · formatearMoneda(monto)    — formatea número a "$1,234.56"
  · formatearFecha(fechaStr)  — fecha larga con hora (zona horaria Argentina)
  · formatearFechaCorta(str)  — fecha corta DD/MM/AAAA (zona horaria Argentina)
  · ahora()                   — timestamp ISO con offset -03:00 (Argentina)
  · debounce(fn, espera)      — debounce estándar para inputs de búsqueda

  Zona horaria:
  Todas las funciones de fecha usan 'America/Argentina/Buenos_Aires' para
  garantizar coherencia independientemente del timezone del navegador del usuario.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. MÓDULO: autenticacion.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Responsabilidad:
  Maneja el ciclo completo de autenticación: login y recuperación de contraseña
  mediante token temporal.

  Flujo de login (iniciarSesion):
  1. Consulta la tabla "usuarios" filtrando por username y activo=true
  2. Compara la contraseña en texto plano (campo password de la tabla)
  3. Devuelve el objeto usuario completo si es correcto, null si falla
  4. Muestra notificación de error específica (usuario no encontrado /
     contraseña incorrecta)

  NOTA DE SEGURIDAD: Las contraseñas se almacenan y comparan en texto plano.
  Esto es funcional para entornos de uso interno cerrado pero NO es adecuado
  para producción con datos sensibles. En producción se recomienda usar bcrypt
  o el sistema de auth nativo de Supabase.

  Recuperación de contraseña:
  1. configurarRecuperacion() — inyecta el link "¿Olvidaste tu contraseña?"
     en el formulario de login (solo si no existe ya, evita duplicados)
  2. El usuario ingresa su email → enviarEmailRecuperacion()
  3. Se genera un token aleatorio de 40 caracteres hex con window.crypto
  4. Se intenta guardar en la tabla "password_reset_tokens" (expira en 1 hora)
     Si la tabla no existe, el token se guarda en memoria (objeto tokensReset)
  5. Se construye el link: dominio + #reset?token=TOKEN
  6. Se envía por EmailJS con nombre, email destino y link
     Si EmailJS falla, muestra un modal con el link copiable al portapapeles
  7. verificarTokenURL() — detecta #reset?token=... en la URL al cargar la página
     y abre automáticamente el modal de nueva contraseña
  8. Al confirmar la nueva contraseña: UPDATE en usuarios, marca token como
     used=true en Supabase y elimina de tokensReset en memoria

  API pública:
  · configurarRecuperacion() — agrega el link al formulario de login
  · verificarTokenURL()      — detecta tokens de recuperación en la URL
  · iniciarSesion(username, password) — valida credenciales, devuelve usuario o null


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. MÓDULO: categorias.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Responsabilidad:
  CRUD completo de categorías de productos. Mantiene la lista en memoria para
  que otros módulos (Productos, Ventas) la usen sin consultas adicionales.

  Tabla Supabase: "categorias"
  Campos: id, nombre, descripcion, activo

  Funciones:
  · cargar()        — carga todas las categorías en la variable privada lista[]
                      (usado por Productos y app.js al iniciarse)
  · cargarSeccion() — carga todas las categorías + conteo de productos por
                      categoría (query separada sobre productos activos),
                      renderiza la tabla y configura búsqueda en tiempo real
  · renderizarTabla(cats, conteo) — función interna que renderiza la tabla;
                      separada de cargarSeccion para poder reutilizarla al filtrar
  · mostrarModal(id)— abre el modal de creación/edición con datos precargados
  · guardar()       — INSERT o UPDATE según si hay id; maneja error 23505 (nombre
                      duplicado)
  · cambiarEstado(id, estadoActual) — toggle activo/inactivo con confirmación
  · eliminar(id, nombre, cantProductos) — bloquea si tiene productos asociados,
                      elimina físicamente con DELETE si no los tiene
  · getLista()      — devuelve la lista en memoria (acceso sin consulta)

  Lógica de eliminación segura:
  Si la categoría tiene productos asociados (cantProductos > 0), se rechaza la
  eliminación y se sugiere desactivarla. Solo se elimina si cantProductos === 0.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. MÓDULO: productos.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Responsabilidad:
  CRUD de productos con soporte de imágenes subidas a Supabase Storage.
  Mantiene lista en memoria de productos activos para el POS.

  Tabla Supabase: "productos"
  Campos: id, codigo, nombre, categoria_id, precio, costo, stock, stock_minimo,
          descripcion, imagen_url, activo
  Relación: JOIN con "categorias" para mostrar nombre de categoría

  Bucket Supabase Storage: "imagenes"
  Ruta de archivos: productos/producto_TIMESTAMP.ext

  Funciones:
  · cargar()          — carga solo productos activos con JOIN a categorias
                        (usado por POS y Dashboard)
  · cargarTodos()     — carga activos e inactivos (para la tabla de gestión)
  · cargarSeccion(cats) — renderiza tabla con todos los productos, configura
                          búsqueda en tiempo real y botón de agregar
  · mostrarModal(id)  — abre modal; si id=null es creación (llama a
                        _proximoCodigo para sugerir código), si tiene id edición
  · guardar()         — INSERT o UPDATE según productId en input hidden
  · cambiarEstado()   — toggle activo/inactivo (soft disable sin eliminar)
  · eliminar()        — DELETE permanente; puede fallar si hay ventas relacionadas
                        (restricción de FK en Supabase)
  · getLista()        — devuelve productos activos en memoria

  Sistema de upload de imágenes (_configurarUploader, _procesarImagen, _subirImagen):
  1. El área acepta click y drag & drop
  2. Valida tipo (image/*) y tamaño máximo 2MB
  3. Muestra preview local inmediato con URL.createObjectURL
  4. Sube el archivo a Supabase Storage con nombre único (timestamp)
  5. Obtiene la URL pública y la guarda en el input hidden #productImage
  6. Muestra estado: "Subiendo…" → "✓ Imagen subida" o "✗ Error"
  7. El botón de quitar imagen limpia todo el estado del uploader

  Código automático (_proximoCodigo):
  Consulta el último producto por ID y devuelve el código siguiente como string
  numérico incremental. El usuario puede editarlo antes de guardar.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. MÓDULO: clientes.js  [actualizado v1.1]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Responsabilidad:
  CRUD de clientes, gestión de deudas, registro de pagos y ficha completa
  por cliente con historial de compras y pagos.

  Tablas Supabase:
  · "clientes" — id, nombre, telefono, email, direccion, deuda_total, activo
  · "pagos"    — id, cliente_id, monto, fecha, metodo_pago, referencia, notas

  API pública completa:
  · cargar()              — carga clientes activos en memoria
  · cargarSeccion()       — renderiza tabla de clientes con búsqueda en tiempo real
  · mostrarModal(id)      — creación/edición de cliente
  · guardar()             — INSERT o UPDATE
  · eliminar(id, nombre)  — soft delete (activo=false)
  · cargarDeudas()        — renderiza sección de deudas (ver abajo)
  · mostrarModalPago()    — abre formulario de registro de pago
  · verHistorialDeuda()   — historial de pagos en modal dinámico
  · verFichaCliente(id)   — ficha completa del cliente (ver abajo) [NUEVO]
  · getLista()            — devuelve clientes en memoria

  ── Tabla de clientes (cargarSeccion) ────────────────────────────────────────

  Cada fila ahora muestra tres botones de acción:
  ┌──────────────────┬───────────────────────────────────────────────────────┐
  │ Botón            │ Acción                                                │
  ├──────────────────┼───────────────────────────────────────────────────────┤
  │ fa-user-circle   │ Abre la Ficha Completa del cliente [NUEVO]            │
  │ fa-edit          │ Abre el modal de edición de datos del cliente         │
  │ fa-trash         │ Solicita confirmación y hace soft delete              │
  └──────────────────┴───────────────────────────────────────────────────────┘

  ── Ficha Completa del Cliente (verFichaCliente) [NUEVO] ─────────────────────

  Función asíncrona que genera un modal dinámico completo con toda la
  información histórica del cliente. Se crea e inyecta en el DOM al llamarla
  y se elimina al cerrarse (#fichaClienteModal).

  Flujo de carga:
  1. Busca el cliente en la lista en memoria (sin consulta adicional)
  2. Construye el modal con un loader spinner mientras carga los datos
  3. Ejecuta dos consultas en paralelo con Promise.all:
     · ventas: SELECT con JOIN a usuarios, filtrado por cliente_id,
               ORDER BY fecha DESC, LIMIT 50
     · pagos:  SELECT *, filtrado por cliente_id,
               ORDER BY fecha DESC, LIMIT 50
  4. Calcula KPIs en memoria (sin consultas adicionales):
     · totalCompras  = suma de v.total de todas las ventas
     · totalPagado   = suma de p.monto de todos los pagos
     · deudaActual   = cliente.deuda_total (campo desnormalizado en DB)
     · cantVentas    = ventas.length
     · cantPagos     = pagos.length
  5. Renderiza el contenido del modal

  Estructura del modal:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ HEADER (sticky)                                                         │
  │   Avatar circular con ícono · Nombre · Teléfono · Email · [X]          │
  ├─────────────────────────────────────────────────────────────────────────┤
  │ KPIs (grid auto-fit, mínimo 160px por columna)                          │
  │   [Total Comprado]  [Total Pagado]  [Deuda Actual]  [N.º de Compras]   │
  │   Color de "Deuda Actual": rojo si > 0, verde si = 0                   │
  ├─────────────────────────────────────────────────────────────────────────┤
  │ TABS                                                                    │
  │   [🛒 Compras (N)]  [💵 Pagos (N)]                                     │
  │   La lógica de switching está en window.fichaTabSwitch (temporal)       │
  ├─────────────────────────────────────────────────────────────────────────┤
  │ Tab COMPRAS (activo por defecto)                                        │
  │   Tabla: Código · Fecha · Vendedor · Método · Total · Estado · [ojo]   │
  │   Si la venta tiene notas → fila secundaria con comentario en cursiva  │
  │   Botón ojo: cierra el modal y abre Ventas.verDetalle(id)              │
  │                                                                         │
  │ Tab PAGOS                                                               │
  │   Tabla: Fecha · Monto (verde) · Método · Referencia · Notas           │
  ├─────────────────────────────────────────────────────────────────────────┤
  │ FOOTER (sticky)                                                         │
  │   [Cerrar]  [$ Registrar Pago]  ← solo si deuda_total > 0             │
  │   "Registrar Pago" cierra el modal y abre mostrarModalPago()           │
  └─────────────────────────────────────────────────────────────────────────┘

  Nota sobre window.fichaTabSwitch:
  La función de switching de tabs se define en window (scope global) al
  renderizar el modal. Esto es necesario porque los onclick en el HTML
  generado dinámicamente no tienen acceso al closure del módulo IIFE.
  La función se sobreescribe cada vez que se abre una ficha y queda huérfana
  al cerrarse el modal (efecto colateral mínimo).

  ── Gestión de deudas (cargarDeudas) ─────────────────────────────────────

  · Consulta clientes con deuda_total > 0 y activo=true, ordenados por
    deuda_total DESC
  · Calcula el total agregado de deudas y la cantidad de deudores
  · Muestra la última venta de cada deudor via JOIN con ventas
  · Búsqueda en tiempo real sobre la tabla de deudores

  ── Registro de pagos (mostrarModalPago, registrarPago) ──────────────────

  1. Modal con nombre del cliente y deuda actual prellenos
  2. Campos: monto (max = deuda actual), método de pago, referencia, notas
  3. Al confirmar:
     a. INSERT en tabla "pagos" con timestamp actual (ahora())
     b. SELECT deuda_total actual del cliente (para evitar condición de carrera)
     c. UPDATE clientes SET deuda_total = MAX(0, deuda_actual - monto_pagado)
  4. Si algún paso falla se muestra error y no se actualiza el estado

  ── Historial de pagos (verHistorialDeuda) ───────────────────────────────

  Genera un modal dinámico (#historialPagosModal) con:
  · Tres tarjetas de resumen: total pagado, deuda actual, cantidad de pagos
  · Tabla de pagos con fecha, monto, método, referencia y notas
  · Últimos 20 pagos ordenados DESC


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. MÓDULO: ventas.js  [actualizado v1.1]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Responsabilidad:
  Punto de Venta (POS) completo: grilla de productos, carrito, checkout con
  soporte de pago mixto/crédito, e historial de ventas con detalle.

  Tablas Supabase:
  · "ventas"        — id, codigo, fecha, cliente_id, vendedor_id, subtotal,
                      descuento, total, estado, metodo_pago, notas
  · "venta_detalles"— id, venta_id, producto_id, cantidad, precio_unitario,
                      subtotal

  Estado interno:
  · carrito[]       — array de { id, nombre, precio, stock, cantidad }
  · usuarioActual   — referencia al usuario logueado (setUsuario lo asigna)

  ── POS — cargarPOS() ────────────────────────────────────────────────────

  1. Construye barra de filtros por categoría (_construirFiltrosCategorias)
     Agrupa categorías únicas de la lista de productos en memoria, ordena
     alfabéticamente y renderiza botones con data-cat
  2. Renderiza grilla de productos (_renderizarGrilla)
     Filtra simultáneamente por texto de búsqueda y categoría activa
     Muestra imagen del producto o placeholder con ícono si no tiene URL
  3. Configura input de búsqueda con filtrado en tiempo real
  4. Botón "Vaciar carrito" pide confirmación antes de limpiar

  ── Carrito ──────────────────────────────────────────────────────────────

  · _agregarAlCarrito(producto) — valida stock disponible antes de agregar.
    Si el producto ya está en el carrito, incrementa cantidad (max = stock)
  · cambiarCantidad(id, delta)  — +1 o -1; si llega a 0 llama quitarDelCarrito
  · quitarDelCarrito(id)        — filter del array, re-renderiza
  · _actualizarCarrito()        — re-renderiza items, calcula subtotal,
    aplica descuento, habilita/deshabilita botón de checkout

  ── Checkout — Modal y Métodos de Pago ───────────────────────────────────

  El modal de checkout tiene un campo "paymentMode" que controla qué campos
  adicionales se muestran:

  · simple   — efectivo, tarjeta o transferencia. El total se paga completo.
               No genera deuda.

  · mixto    — requiere cliente. Se muestran campos para desglosar cuánto
               se paga ahora y con qué método. El remanente se registra como
               deuda. El campo "parcialMonto" no puede superar el total.
               Se genera una nota automática con el desglose:
               "Efectivo: $X | Transf: $Y | Crédito: $Z"

  · credito  — requiere cliente. La totalidad del monto queda como deuda.
               El método_pago se registra como 'credito' en la tabla ventas.

  Validaciones previas a procesarVenta():
  · Si modo mixto o crédito sin cliente seleccionado → error y corte
  · Si monto parcial > total → error y corte

  ── procesarVenta() — Pasos de escritura ─────────────────────────────────

  Transacción en pasos secuenciales (sin atomicidad real):

  1. INSERT en "ventas" con:
     · codigo: 'V-' + Date.now() (único por timestamp)
     · metodo_pago: valor calculado según modo
     · notas: notas del usuario + notas generadas por modo mixto (concatenadas)
     · cliente_id: null si es venta general

  2. INSERT masivo en "venta_detalles" con todos los items del carrito

  3. UPDATE stock de cada producto (stock - cantidad vendida), uno por uno
     en loop secuencial (no en paralelo, para evitar condiciones de carrera)

  4. Si deudaGenerada > 0 y hay cliente:
     · SELECT deuda_total actual del cliente
     · UPDATE clientes SET deuda_total = deuda_actual + deudaGenerada

  Post-venta: limpia carrito, resetea descuento a 0, recarga Productos y
  Clientes en memoria (para reflejar nuevo stock y nueva deuda).

  ── Historial — cargarHistorial() ────────────────────────────────────────

  · Carga las últimas 50 ventas con JOIN a clientes y usuarios
  · Búsqueda en tiempo real sobre la tabla renderizada

  ── Detalle de venta — verDetalle(id) ────────────────────────────────────

  · Carga en paralelo (Promise.all): detalles de la venta + cabecera con
    JOIN a clientes y usuarios
  · Modal dinámico (#saleDetailModal) con tabla de productos, descuento
    (si aplica) y total. Se cierra al hacer click en overlay o botón.

  API pública:
  · setUsuario(u)       · cargarPOS()        · cambiarCantidad(id, delta)
  · quitarDelCarrito(id)· mostrarModalCheckout()
  · cargarHistorial()   · verDetalle(id)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. MÓDULO: empleados.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Responsabilidad:
  CRUD de empleados (usuarios del sistema) y gestión del perfil del usuario activo.

  Tabla Supabase: "usuarios"
  Campos: id, username, nombre, email, password, role (admin/empleado), activo

  Funciones:
  · setUsuario(usuario)  — recibe el usuario logueado desde app.js; lo usa para
                           proteger al usuario activo de desactivarse a sí mismo
  · cargarSeccion()      — carga y renderiza todos los usuarios; el usuario activo
                           no puede ver el botón de activar/desactivar en su propia
                           fila (condición: emp.id !== usuarioActual?.id)
  · mostrarModal(id)     — en edición carga datos del empleado desde Supabase,
                           cambia el label de contraseña a "opcional" y quita
                           el atributo required del campo password
  · guardar()            — INSERT para nuevos (contraseña obligatoria)
                           UPDATE para existentes (contraseña solo si se ingresa algo)
                           Maneja error 23505 (username duplicado)
  · cambiarEstado(id, nuevoEstado) — toggle activo/inactivo con confirmación

  Perfil (cargarPerfil, actualizarPerfil, cambiarContrasena):
  · cargarPerfil()       — precarga nombre, email y rol del usuario activo en el form
  · actualizarPerfil()   — UPDATE nombre y email; actualiza también el objeto en
                           memoria y el texto del header (currentUser) sin recargar
  · cambiarContrasena()  — valida contraseña actual comparando con
                           usuarioActual.password (texto plano), luego UPDATE en
                           Supabase y actualiza el objeto en memoria

  API pública:
  · setUsuario · cargarSeccion · mostrarModal · cambiarEstado · cargarPerfil


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. MÓDULO: reportes.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Responsabilidad:
  Gráficos interactivos de ventas y exportación de reportes en PDF/impresión.

  Gráficos (Chart.js):
  · Gráfico de ventas (renderizarGraficaVentas):
    — Línea con fill. Soporta 3 períodos: semanal (7 días), mensual (12 meses),
      anual (5 años)
    — El período activo se controla con botones que modifican periodoActual
    — Los datos se agrupan por clave de fecha (día/mes/año) usando reduce
    — Se destruye la instancia anterior antes de crear una nueva para evitar
      memory leaks de Chart.js
  · Gráfico de categorías (renderizarGraficaCategorias):
    — Dona con 55% de cutout. Agrupa unidades vendidas por categoría de producto
    — Si no hay datos muestra mensaje de texto en lugar del canvas
  · Top productos (renderizarTopProductos):
    — Barras horizontales (indexAxis: 'y'). Cantidad configurable (5/10/15)
    — Opacidad degradada por posición para jerarquía visual

  Exportación:
  · exportarVentas():
    1. Abre _selectorFechas() — modal con inputs fecha inicio/fin y rangos rápidos
       (hoy, ayer, semana, mes, trimestre)
    2. Consulta ventas en el rango con JOIN a clientes y usuarios
    3. Calcula totales por método de pago
    4. Genera HTML con estilos embebidos (_htmlReporteVentas)
    5. Muestra en mostrarVistaPrevia() con opciones de imprimir o descargar PDF

  · exportarStockBajo():
    Similar pero sin selector de fechas; filtra productos con stock <= stock_minimo

  Vista previa y exportación (mostrarVistaPrevia):
  · Crea un modal con el HTML del reporte renderizado en un div con fondo blanco
  · Botón "Imprimir": abre window.open con el HTML + script de autoprint
  · Botón "Descargar PDF": usa html2canvas para capturar el div a canvas,
    luego jsPDF para convertir a PDF y descargar
    Si html2canvas no está disponible, cae a la función de impresión

  Estilos de reportes (_estilosBase):
  Todos los colores de los reportes HTML usan !important para sobreescribir
  el tema oscuro de la aplicación y garantizar legibilidad en fondo blanco.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. MÓDULO: app.js (orquestador)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Responsabilidad:
  Punto de entrada principal. Coordina el ciclo de vida de la aplicación:
  autenticación, navegación entre secciones y carga del dashboard.

  Inicialización (_inicializar):
  · Registra event listeners: loginForm, logoutBtn, menuToggle, menuItems
  · Cierra el sidebar al hacer click fuera en móvil (viewport < 1024px)
  · Llama a Autenticacion.configurarRecuperacion() y verificarTokenURL()
  · Inicia inicializarEmailJS() de forma preventiva

  Flujo post-login (_manejarLogin):
  1. Llama a Autenticacion.iniciarSesion() — si devuelve null, se detiene
  2. Guarda el usuario en usuarioActual y lo pasa a Ventas y Empleados
  3. Actualiza header con nombre y rol del usuario
  4. Muestra/oculta items de menú con clase admin-only según el rol
  5. Muestra la pantalla de bienvenida neón (_mostrarBienvenida)
  6. Carga datos iniciales en paralelo: categorías, productos, clientes
  7. Redirige según rol: admin → dashboard, empleado → POS

  Navegación (_navegarSeccion):
  · Activa el ítem de menú clickeado (clase active)
  · Oculta todas las secciones y muestra la target via ID (seccionSection)
  · Llama a _cargarDatosSeccion(nombre) con el módulo correspondiente
  · Cierra sidebar en móvil automáticamente

  Mapa de secciones → módulos (_cargarDatosSeccion):
  ┌─────────────┬────────────────────────────────────────┐
  │ Sección     │ Función llamada                        │
  ├─────────────┼────────────────────────────────────────┤
  │ dashboard   │ cargarDashboard() — función local      │
  │ pos         │ Ventas.cargarPOS()                     │
  │ products    │ Productos.cargarSeccion(categorias)    │
  │ categories  │ Categorias.cargarSeccion()             │
  │ customers   │ Clientes.cargarSeccion()               │
  │ debts       │ Clientes.cargarDeudas()                │
  │ sales       │ Ventas.cargarHistorial()               │
  │ employees   │ Empleados.cargarSeccion()              │
  │ profile     │ Empleados.cargarPerfil()               │
  │ config      │ _cargarConfiguracion() — función local │
  └─────────────┴────────────────────────────────────────┘

  Dashboard (cargarDashboard):
  Consultas mixtas (memoria + Supabase):
  · Ventas de hoy: SUM total filtrado por fecha >= hoy (zona Argentina)
  · Total productos: longitud de Productos.getLista() (memoria)
  · Stock bajo: filtro stock <= stock_minimo sobre la lista en memoria
  · Clientes: longitud de Clientes.getLista() (memoria)
  · Top producto: reduce sobre venta_detalles agrupando por nombre de producto
  · Últimas 5 ventas: JOIN a clientes y usuarios, ORDER BY fecha DESC
  · Tabla de stock bajo: badge CRÍTICO (stock <= 3) o BAJO (stock <= minimo)

  Las tarjetas del dashboard son clickeables:
  · Ventas de Hoy    → navega a sección "sales"
  · Total Productos  → navega a sección "products"
  · Total Clientes   → navega a sección "customers"
  · Top Producto     → navega a sección "reports" y carga Reportes.cargar()
  · Stock Bajo       → abre modal detallado (_mostrarModalStockBajo) con tabla
                       completa de todos los productos con stock bajo o crítico

  Tabs del Dashboard (_inicializarTabsDashboard):
  El dashboard tiene dos tabs: "overview" (vista principal) y "reports"
  (acceso directo a reportes). La lógica de tab se inicializa una sola vez
  usando dataset.bound = '1' para evitar registrar listeners duplicados
  en cada visita al dashboard.

  Modal de Stock Bajo (_mostrarModalStockBajo):
  Modal dinámico (#lowStockDetailModal) con tabla de productos en stock bajo.
  Columnas: Código, Producto, Categoría, Stock Actual, Stock Mínimo, Estado.
  Se destruye y recrea en cada apertura (remove + createElement).

  Configuración (_cargarConfiguracion):
  · Lee tabla "configuracion" (clave/valor) y precarga campos de empresa
  · Muestra tabla de usuarios del sistema (solo lectura)
  · Al guardar: UPDATE por cada clave modificada (empresa_nombre, telefono,
    dirección) de forma secuencial con for...of


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. BASE DE DATOS SUPABASE — TABLAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  usuarios
  ────────
  id          bigint PK autoincrement
  username    text UNIQUE NOT NULL
  nombre      text NOT NULL
  email       text
  password    text NOT NULL            ← texto plano (ver nota de seguridad)
  role        text  ('admin' | 'empleado')
  activo      boolean DEFAULT true

  categorias
  ──────────
  id          bigint PK autoincrement
  nombre      text UNIQUE NOT NULL
  descripcion text
  activo      boolean DEFAULT true

  productos
  ─────────
  id          bigint PK autoincrement
  codigo      text
  nombre      text NOT NULL
  categoria_id bigint FK → categorias.id
  precio      numeric NOT NULL
  costo       numeric
  stock       integer DEFAULT 0
  stock_minimo integer DEFAULT 5
  descripcion text
  imagen_url  text
  activo      boolean DEFAULT true

  clientes
  ────────
  id          bigint PK autoincrement
  nombre      text NOT NULL
  telefono    text
  email       text
  direccion   text
  deuda_total numeric DEFAULT 0       ← campo desnormalizado, se actualiza
                                         en cada venta a crédito/mixta y pago
  activo      boolean DEFAULT true

  ventas
  ──────
  id          bigint PK autoincrement
  codigo      text UNIQUE             ← formato 'V-{timestamp}'
  fecha       timestamptz NOT NULL
  cliente_id  bigint FK → clientes.id (nullable — ventas generales)
  vendedor_id bigint FK → usuarios.id
  subtotal    numeric NOT NULL
  descuento   numeric DEFAULT 0
  total       numeric NOT NULL
  estado      text ('completada' | 'anulada')
  metodo_pago text ('efectivo' | 'tarjeta' | 'transferencia' | 'credito' |
                    'mixto')          ← 'mixto' agregado en v1.1
  notas       text                   ← puede incluir desglose de pago mixto

  venta_detalles
  ──────────────
  id              bigint PK autoincrement
  venta_id        bigint FK → ventas.id
  producto_id     bigint FK → productos.id
  cantidad        integer NOT NULL
  precio_unitario numeric NOT NULL
  subtotal        numeric NOT NULL

  pagos
  ─────
  id          bigint PK autoincrement
  cliente_id  bigint FK → clientes.id
  monto       numeric NOT NULL
  fecha       timestamptz NOT NULL
  metodo_pago text
  referencia  text
  notas       text

  password_reset_tokens (opcional — puede no existir)
  ─────────────────────────────────────────────────────
  id          bigint PK autoincrement
  user_id     bigint FK → usuarios.id
  token       text UNIQUE NOT NULL
  expires_at  timestamptz NOT NULL
  used        boolean DEFAULT false

  configuracion
  ─────────────
  id          bigint PK autoincrement
  clave       text UNIQUE NOT NULL
  valor       text
  Claves usadas: empresa_nombre, empresa_telefono, empresa_direccion

  Storage:
  Bucket "imagenes" — público, rutas: productos/producto_TIMESTAMP.ext

  Relaciones relevantes:
  ventas.cliente_id  → clientes.id  (nullable)
  ventas.vendedor_id → usuarios.id
  venta_detalles.venta_id   → ventas.id
  venta_detalles.producto_id → productos.id
  pagos.cliente_id  → clientes.id
  productos.categoria_id → categorias.id


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. INTERFAZ — ESTRUCTURA VISUAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Tema: oscuro con paleta violeta/púrpura
  Variables CSS principales:
  --primary          #7c3aed  (violeta principal)
  --primary-light    #a78bfa  (violeta claro, acentos)
  --primary-dark     #5b21b6  (violeta oscuro)
  --primary-subtle   rgba(139,92,246,0.1)
  --bg-base          #0f0f1a  (fondo principal)
  --bg-card          #16161f  (fondo de cards)
  --bg-raised        #1e1e2e  (fondo elevado)
  --text-primary     #e0e0f0
  --text-muted       #6b6b88
  --warning          #f59e0b
  --danger           #f43f5e

  Layout de la app:
  ┌──────────────────────────────────────────────────┐
  │  TOP NAV (logo + usuario + logout)               │
  ├──────────┬───────────────────────────────────────┤
  │          │                                       │
  │ SIDEBAR  │        MAIN CONTENT                   │
  │ (menú    │  (secciones con clase hidden/visible) │
  │  lateral)│                                       │
  │          │                                       │
  └──────────┴───────────────────────────────────────┘

  Responsive: en viewport < 1024px el sidebar se oculta y aparece con el
  botón hamburguesa; se cierra al tocar fuera o al navegar.

  Pantallas especiales:
  · #loginScreen    — visible al inicio, oculta tras login exitoso
  · #app            — oculta al inicio, visible tras login
  · #welcomeScreen  — oculta al inicio, aparece tras login por ~2.6s con fade out

  Modales estáticos (en el HTML desde el inicio, clase "hidden"):
  · #customerModal     — creación/edición de clientes
  · #paymentModal      — registro de pagos de deuda
  · #checkoutModal     — finalización de venta (POS)
  · #productModal      — creación/edición de productos
  · #categoryModal     — creación/edición de categorías
  · #employeeModal     — creación/edición de empleados

  Modales dinámicos (creados y destruidos en cada uso):
  · #fichaClienteModal      — ficha completa de cliente [NUEVO v1.1]
  · #historialPagosModal    — historial de pagos de un cliente
  · #saleDetailModal        — detalle de una venta del historial
  · #lowStockDetailModal    — detalle de productos con stock bajo
  · #modalRecuperar         — formulario de recuperación de contraseña
  · #modalNuevaContrasena   — formulario de nueva contraseña (desde token)

  Convención de cierre de modales:
  Los botones con clase .close-modal asignan su onclick al cierre del modal
  al momento de abrir el modal (no están hardcodeados en el HTML). Esto
  garantiza que el cierre apunte siempre al modal correcto. El overlay
  (click en el fondo oscuro) también cierra el modal.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. SISTEMA DE ROLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Roles disponibles: "admin" y "empleado"

  Diferencias de acceso:
  ┌─────────────────────────┬───────┬──────────┐
  │ Funcionalidad           │ Admin │ Empleado │
  ├─────────────────────────┼───────┼──────────┤
  │ Dashboard               │  ✓    │    ✗     │
  │ Punto de Venta (POS)    │  ✓    │    ✓     │
  │ Gestión de Productos    │  ✓    │    ✗     │
  │ Gestión de Categorías   │  ✓    │    ✗     │
  │ Gestión de Clientes     │  ✓    │    ✗     │
  │ Cuentas por Cobrar      │  ✓    │    ✗     │
  │ Historial de Ventas     │  ✓    │    ✗     │
  │ Mi Perfil               │  ✓    │    ✓     │
  │ Gestión de Empleados    │  ✓    │    ✗     │
  │ Reportes                │  ✓    │    ✗     │
  │ Configuración           │  ✓    │    ✗     │
  └─────────────────────────┴───────┴──────────┘

  La restricción se aplica ocultando los elementos del menú con clase
  admin-only en el HTML. No hay restricción a nivel de API (Supabase RLS);
  la seguridad es solo visual/frontend.

  Al iniciar sesión:
  · admin    → redirige a Dashboard
  · empleado → redirige directamente al POS

  Usuarios por defecto del sistema:
  · admin   / admin123  — rol Administrador
  · ventas  / ventas123 — rol Empleado


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. PANTALLA DE BIENVENIDA (animación post-login)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Se activa inmediatamente después de un login exitoso.
  Duración total: ~3.3 segundos (2.6s visible + 0.7s fade-out)

  Elementos visuales:
  · Fondo negro #070710 con grid de líneas violetas muy sutiles
  · Dos orbes de luz difusa en esquinas opuestas animados con CSS
  · 7 partículas flotantes de luz generadas en el HTML
  · Línea decorativa superior que se expande al entrar
  · Texto "BIENVENIDO" con tracking amplio y neón suave
  · Nombre del usuario con glow blanco/violeta pulsante
  · Texto secundario "al Sistema de Gestión de Montana Importados"
  · 3 puntos pulsantes como separador
  · Barra de progreso con gradiente violeta y shimmer animado

  Ciclo de vida:
  1. _mostrarBienvenida(nombre) en app.js inyecta el nombre
  2. Remueve clase 'hidden' → aparece la pantalla
  3. setTimeout 2600ms → agrega clase 'fade-out' (opacity: 0, transition 0.7s)
  4. setTimeout 650ms más → agrega 'hidden' → vuelve a display:none
  5. La app ya estaba cargada en el fondo durante la animación


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18. FLUJO COMPLETO DE UNA VENTA  [actualizado v1.1]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Flujo estándar (pago simple):
  ─────────────────────────────
  1. El usuario navega a "Punto de Venta"
  2. La grilla muestra productos activos con stock > 0 (de memoria, sin consulta)
  3. Puede filtrar por categoría (barra superior) o buscar por nombre/código
  4. Al hacer click en un producto → se agrega al carrito
     · Si ya estaba, se incrementa la cantidad
     · Si el stock es insuficiente, se muestra warning y no se agrega
  5. En el carrito puede ajustar cantidades (+/-) o eliminar productos
  6. Puede ingresar un descuento en el campo de descuento (recalcula total)
  7. Hace click en "Finalizar Venta" → se abre el modal de checkout
  8. En el modal selecciona:
     · Cliente (opcional — "Venta General" si no hay cliente)
     · Método de pago: efectivo / tarjeta / transferencia / crédito / mixto
     · Notas opcionales
  9. Hace click en "Confirmar Venta" → procesarVenta():
     a. INSERT en ventas
     b. INSERT masivo en venta_detalles
     c. UPDATE stock de cada producto vendido (secuencial)
  10. Notificación de éxito con el código de venta generado
  11. Carrito se limpia, stock y clientes en memoria se actualizan

  Flujo con pago mixto (pago parcial + deuda):
  ─────────────────────────────────────────────
  1–7. Igual al flujo estándar
  8. En el modal, el usuario selecciona modo "Mixto" y debe seleccionar cliente
  9. Se muestran campos adicionales:
     · Monto pagado ahora
     · Método del pago parcial
  10. El sistema calcula: deudaGenerada = total - montoPagado
  11. Se genera nota automática: "Efectivo: $X | Transf: $Y | Crédito: $Z"
  12. Al confirmar → procesarVenta():
      a–c. Igual al flujo estándar
      d. UPDATE clientes SET deuda_total += deudaGenerada
  13. Notificación de éxito: "Venta completada: V-XXX · Deuda registrada: $YYY"

  Flujo a crédito total:
  ──────────────────────
  1–7. Igual al flujo estándar
  8. El usuario selecciona modo "Crédito" y debe seleccionar cliente
  9. Al confirmar: deudaGenerada = total completo
     UPDATE clientes SET deuda_total += total
  10. metodo_pago se registra como 'credito' en la tabla ventas


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
19. LIMITACIONES CONOCIDAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  · Contraseñas en texto plano — sin hash. Aceptable para uso interno cerrado.

  · Sin Row Level Security (RLS) en Supabase — cualquiera con la anon key
    puede leer/escribir todas las tablas desde el cliente.

  · Ventas no son atómicas — si falla el update de stock, la venta ya fue
    insertada. Requeriría una Edge Function en Supabase para ser transaccional.

  · El campo deuda_total en clientes es desnormalizado — se actualiza
    manualmente en cada venta a crédito/mixta y en cada pago. Si una
    operación falla a mitad del proceso puede quedar inconsistente con la
    suma real de ventas y pagos.

  · Estado de ventas siempre "completada" — el campo "estado" existe en la
    tabla pero no hay lógica de anulación en el frontend. Las ventas no
    pueden cancelarse desde la interfaz.

  · La columna "estado" del historial de ventas refleja el estado del
    procesamiento de la venta (completada/anulada), NO el estado del cobro.
    Una venta "completada" puede tener deuda pendiente si fue a crédito.

  · Sin paginación real en tablas — ventas carga máximo 50 registros,
    pagos historial carga máximo 20/50 registros. Sin paginación para
    otros módulos (puede ser lento con grandes volúmenes).

  · window.fichaTabSwitch es una función global temporal — se sobreescribe
    con cada apertura de la ficha de cliente. No causa problemas en uso
    normal, pero puede generar comportamiento inesperado si hubiera dos
    fichas abiertas simultáneamente (lo cual el HTML no permite).

  · Sin modo offline — requiere conexión a internet constante (Supabase + CDNs).

  · La anon key de Supabase está expuesta en el código fuente del cliente.
    Es una limitación inherente a toda app frontend sin backend propio.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
20. DESPLIEGUE Y REQUISITOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Requisitos mínimos:
  · Servidor web que sirva archivos estáticos (Apache, Nginx, Netlify, Vercel,
    GitHub Pages, o simplemente abrir index.html en un navegador moderno)
  · Conexión a internet (para Supabase y los CDNs)
  · Navegador moderno con soporte ES6+ (Chrome 80+, Firefox 75+, Edge 80+)

  Despliegue local:
  · Copiar la carpeta montana/ con la estructura completa
  · Asegurarse que LOGO.jpeg esté en la raíz junto a index.html
  · Abrir index.html en el navegador (o servir con Live Server / similar)

  Variables a reemplazar para nuevo proyecto:
  En js/configuracion.js:
  · SUPABASE_URL         → URL del proyecto Supabase propio
  · SUPABASE_ANON_KEY    → Clave anónima del proyecto Supabase propio
  · EMAILJS_CONFIG       → PUBLIC_KEY, SERVICE_ID, TEMPLATE_ID de EmailJS propio

  No hay archivo .env ni proceso de build. Todos los cambios son directos en
  los archivos JS.

  Checklist para nuevo despliegue:
  □ Reemplazar credenciales en configuracion.js
  □ Crear las tablas en Supabase (ver sección 14)
  □ Crear bucket "imagenes" en Supabase Storage como público
  □ Crear tabla password_reset_tokens (opcional, para recuperación de contraseña)
  □ Insertar al menos un usuario administrador en la tabla "usuarios"
  □ Insertar claves en tabla "configuracion":
      empresa_nombre, empresa_telefono, empresa_direccion
  □ Configurar plantilla de EmailJS para el template de recuperación

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Última actualización: Mayo 2026 · v1.1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━