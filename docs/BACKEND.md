# Backend de drmr

Aplicación Next.js 16 con base de datos PostgreSQL para el registro correlativo de clientes.
Panel privado de administración para consultar registros, gestionar piezas e importar datos.
Mensajería de confirmación con clientes mediante la API de Meta en Instagram.

## Correr en local

Comandos para iniciar el entorno local de desarrollo:

```bash
npm ci
npm run db:start
npm run db:migrate
npm run admin -- create
npm run dev
```

El panel de administración se abre en la URL:

```text
http://localhost:3000/admin/login
```

El panel vive en `/admin` y el inicio de sesión en `/admin/login`. Las protecciones son el bloqueo por intentos fallidos, los límites de tasa, las sesiones en base de datos, la CSP con nonce y la directiva noindex.

Para detener la base de datos local al finalizar el trabajo:

```bash
npm run db:stop
```

## Variables de entorno

| Variable | Para qué | Local | Producción |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio para metadatos, Open Graph y sitemap | `http://localhost:3000` | Obligatoria en producción y con HTTPS. URL canónica del dominio (ej. `https://drmr.com.mx`). Si el host no es exactamente `drmr.com.mx`, el sitio sale con `noindex` y `robots.txt` bloquea todo (sin sitemap) para no competir con el sitio vigente |
| `VERCEL_PROJECT_PRODUCTION_URL` | URL de producción asignada en el proyecto de Vercel | Vacío | Dominio del proyecto en Vercel |
| `APP_ENV` | Entorno de ejecución (`local`, `test`, `preview`, `production`) | `local` | `production` (debe coincidir con `VERCEL_ENV`) |
| `DATABASE_URL` | Cadena de conexión PostgreSQL (protocolo `postgres:` o `postgresql:`) | `postgres://postgres:postgres@127.0.0.1:54330/drmr_dev` | URL de conexión de Railway. Prohibido incluir parámetros TLS en la URL |
| `DATABASE_SSL_MODE` | Modo de verificación TLS (`disable`, `verify-ca`, `verify-full`) | `disable` | `verify-ca` para Railway. Prohibido `disable` en producción |
| `DATABASE_CA_CERT` | Certificado raíz CA en formato PEM para validar el servidor de base de datos | Vacío | Certificado raíz de Railway. Obligatorio si el modo es `verify-ca` |
| `DATABASE_POOL_MAX` | Número máximo de conexiones por pool de base de datos | `10` | Número de conexiones (ej. `10`) |
| `APP_SECRET` | Clave secreta de la aplicación para HMAC y tokens de expediente | Valor aleatorio de al menos 32 caracteres | Clave de al menos 32 caracteres. No puede iniciar con `local-only` |
| `PII_ENCRYPTION_KEY` | Clave AES-256-GCM para cifrar WhatsApp y correo (32 bytes en base64) | 32 bytes en base64 | 32 bytes en base64 |
| `APP_BASE_URL` | URL base pública de la aplicación | `http://localhost:3000` | URL HTTPS pública del proyecto. No puede ser localhost |
| `RATE_LIMIT_MODE` | Modo del limitador de tasa (`enforce` o `disabled`) | `enforce` o `disabled` | `enforce`. Prohibido `disabled` en producción |
| `BOT_PROTECTION_MODE` | Protección contra bots (`turnstile` o `disabled`) | `disabled` | `turnstile`. Prohibido `disabled` en producción |
| `TURNSTILE_SECRET_KEY` | Clave secreta del servidor para Cloudflare Turnstile | Vacío o clave de pruebas | Clave secreta real de Cloudflare. Prohibido usar claves de prueba (`1x0000`, etc.) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Llave pública (site key) del widget de Cloudflare Turnstile; pública, se fija en tiempo de build | Vacío (sin widget) | Site key real que corresponda a `TURNSTILE_SECRET_KEY` y al hostname del despliegue |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Lista de nombres de host permitidos separados por comas | `localhost,127.0.0.1` | Dominios oficiales de producción. Prohibido incluir localhost |
| `VERCEL` | Variable asignada de forma automática por Vercel al ejecutar | Vacío | Definida por Vercel (`1`) |
| `VERCEL_ENV` | Entorno de despliegue en Vercel (`development`, `preview`, `production`) | Vacío | Asignada por Vercel. Obligatoria cuando `VERCEL` está presente |
| `MESSAGING_MODE` | Modo de mensajería (`disabled`, `log`, `instagram`) | `disabled` o `log` | `instagram` o `disabled`. Prohibido `log` en producción |
| `META_APP_ID` | Identificador numérico de la aplicación de Meta | Vacío | Obligatorio si el modo es `instagram` |
| `META_APP_SECRET` | Secreto de la aplicación de Meta (mínimo 16 caracteres) | Vacío | Obligatorio si el modo es `instagram` |
| `INSTAGRAM_LOGIN_CONFIG_ID` | ID de configuración de Facebook Login for Business | Vacío | Obligatorio si el modo es `instagram` |
| `META_WEBHOOK_VERIFY_TOKEN` | Token para la verificación inicial del webhook de Meta | Vacío | Token de al menos 16 caracteres. Obligatorio si el modo es `instagram` |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | Clave AES-256-GCM para cifrar el token de Instagram en base de datos | Vacío | 32 bytes en base64. Obligatorio si el modo es `instagram` |
| `INSTAGRAM_BUSINESS_USERNAME` | Nombre de usuario profesional de la cuenta de Instagram | `drmrs.archive` | `drmrs.archive` en minúsculas. Obligatorio si el modo es `instagram` y `INSTAGRAM_ALLOW_ANY_ACCOUNT` no es `true` |
| `INSTAGRAM_ALLOW_ANY_ACCOUNT` | `true` permite conectar cualquier cuenta profesional de Instagram (se debe compartir exactamente una en el diálogo de Meta); vacío limita la conexión a `INSTAGRAM_BUSINESS_USERNAME` | Vacío | `true` o vacío. Con `true`, el enlace `ig.me` usa el usuario de la cuenta conectada si `INSTAGRAM_BUSINESS_USERNAME` está vacío |
| `META_GRAPH_API_BASE_URL` | URL base de Graph API terminada en versión | `https://graph.facebook.com/v27.0` | `https://graph.facebook.com/v27.0` |
| `CRON_SECRET` | Clave secreta para autorizar la ejecución del cron de mensajes | Vacío | Mínimo 32 caracteres. Obligatorio si el modo es `instagram` |

Generación de secretos criptográficos mediante Node.js:

```bash
# Para APP_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# Para PII_ENCRYPTION_KEY e INSTAGRAM_TOKEN_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Para CRON_SECRET y META_WEBHOOK_VERIFY_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Cuentas del panel

La administración de cuentas se realiza exclusivamente mediante el script `scripts/admin.mjs`:

```bash
# Crear un nuevo administrador
npm run admin -- create

# Restablecer contraseña de una cuenta
npm run admin -- reset-password <correo>

# Desactivar una cuenta
npm run admin -- deactivate <correo>

# Ejecución sobre base de datos remota
npm run admin -- create --confirm-remote
```

Políticas y reglas de autenticación:
- Intentos fallidos y bloqueo: acumular 5 intentos fallidos consecutivos bloquea la cuenta automáticamente durante 15 minutos. Un inicio exitoso o un restablecimiento manual limpia el contador.
- Duración de sesiones: las sesiones almacenadas en la base de datos tienen un límite absoluto de 12 horas y expiran tras 2 horas de inactividad. La base de datos almacena únicamente el hash SHA-256 del token de sesión.
- Roles de usuario: existen dos roles, `OWNER` y `ADMIN`. Ambos gestionan el panel, pero únicamente un usuario con rol `OWNER` puede conectar o desconectar la cuenta de Instagram.
- Sin segundo factor: no existe autenticación de dos factores (2FA o TOTP) por decisión expresa del dueño.
- Protección remota: el flag `--confirm-remote` es obligatorio si la base de datos configurada no reside en un host local, evitando modificaciones accidentales en producción.

## Importar el Google Sheet

Procedimiento de migración inicial desde Google Sheets:
1. Exportar la hoja de cálculo de Google Sheets en formato CSV.
2. Ingresar a la sección `Importar` dentro del panel privado.
3. Cargar el archivo CSV para evaluar la previsualización de filas válidas y duplicadas.
4. Confirmar la operación para insertar los registros en la base de datos.

Nombres de columnas aceptados por el analizador:
- `numero`: aliases `numero`, `no`, `no.`, `#`, `num`, `registro`, `numero de registro`, `registro no`.
- `nombre` (obligatoria): aliases `nombre`, `name`, `nombre completo`.
- `whatsapp` (obligatoria): aliases `whatsapp`, `telefono`, `tel`, `celular`, `phone`, `numero de whatsapp`. Se normaliza automáticamente a 12 dígitos con código de país (`52...`).
- `correo`: aliases `correo`, `email`, `mail`, `e-mail`, `correo electronico`.
- `instagram` (obligatoria): aliases `instagram`, `ig`, `usuario`, `usuario de instagram`. Acepta handles con `@` o enlaces completos a perfiles.
- `talla`: aliases `talla`, `size`. Admite `S`, `M`, `L`, `XL` o `NO_SE` para valores vacíos o no especificados.
- `dreamer`: aliases `dreamer`, `quien deberia estar en el archivo`, `nominado`.
- `origen`: aliases `src`, `origen`, `fuente`, `source` (por defecto se asigna `importado`).
- `fecha`: aliases `fecha`, `timestamp`, `marca temporal`, `fecha de registro`, `date`. Admite fechas locales `dd/mm/yyyy hh:mm`, seriales numéricos de hoja de cálculo o formato ISO 8601.

Reglas del proceso:
- Los números de registro presentes en la hoja se conservan intactos.
- La ejecución repetida del proceso es idempotente: no se crean registros duplicados si el número, WhatsApp o Instagram ya existen.
- La importación debe completarse antes de habilitar el formulario público para asegurar la secuencia correlativa de los registros nuevos.

## Instagram

La integración con Instagram utiliza la API de Meta y requiere interacción previa del usuario:
- Plantillas de mensaje: las plantillas de mensaje (Plantillas de Instagram, variables {nombre} {numero} {talla} {estado} {link} {fecha_drop}) se envían desde la página de conversación de cada registro.
- Ventana de 24 horas: las políticas de Meta prohíben iniciar conversaciones comerciales en frío. El cliente debe enviar el primer mensaje a la cuenta.
- Mecanismo de vinculación: al registrarse, la pantalla de confirmación entrega un enlace directo `https://ig.me/m/drmrs.archive?ref=<codigo>` con un código único de 6 caracteres. Cuando el cliente abre la conversación o envía el código, el webhook de Meta captura el evento y vincula el identificador de usuario (`instagram_scoped_id`) al registro. De forma complementaria, el sistema vincula automáticamente por nombre de usuario de Instagram si la coincidencia es única.
- Bienvenida automática: al registrarse una persona nueva por el formulario web, el sistema encola el mensaje de bienvenida de Instagram. Se envía en cuanto la persona escribe a la cuenta (enlace "Abrir Instagram" de la confirmación), o de inmediato si ya había escrito antes y su ventana de 24 horas sigue abierta. Los registros importados no reciben este mensaje automáticamente.
- Requisitos en Meta para los fundadores:
  1. Cuenta profesional de Instagram con nombre de usuario `drmrs.archive`, asociada a un portafolio comercial de Meta (Business Portfolio).
  2. Aplicación creada en Meta for Developers con configuración de Facebook Login for Business y token de usuario del sistema (System User).
  3. Permisos aprobados: `instagram_basic` e `instagram_manage_messages`.
  4. Webhook registrado con la URL `https://<dominio>/api/webhooks/instagram` y el token de verificación configurado en `META_WEBHOOK_VERIFY_TOKEN`.
  5. Campos de suscripción del webhook: `messages`, `messaging_seen`, `messaging_referral`, `message_reactions`, `messaging_postbacks`.
  6. URI de redirección OAuth registrada: `https://<dominio>/api/instagram/callback`.
  7. Proceso de App Review ante Meta para permitir el uso público fuera de usuarios con rol de prueba.
- Variables de entorno requeridas cuando `MESSAGING_MODE=instagram`: `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_LOGIN_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY` y `CRON_SECRET`, más `INSTAGRAM_BUSINESS_USERNAME` salvo que `INSTAGRAM_ALLOW_ANY_ACCOUNT=true` (en ese caso se acepta cualquier cuenta profesional y el enlace `ig.me` usa el usuario de la cuenta conectada).
- Modo de contingencia (Sin enviar): los mensajes que no pueden entregarse automáticamente o cuya ventana de 24 horas expiró se listan en el panel para copia manual y contacto mediante `ig.me/m/<usuario>`.
- Cron de despacho: endpoint programado `/api/cron/messages` protegido mediante cabecera `Authorization: Bearer <CRON_SECRET>`, ejecutado diariamente a las 14:00 UTC según `vercel.json` para procesar la cola de salida de mensajes pendientes.

## Seguridad

Capas de seguridad implementadas en el sistema:
- Validación de origen y tamaño en formulario público: validación estricta de cabecera `Origin` (`isSameOriginRequest`) y límite de 16 KB en el cuerpo de la petición en `POST /api/registro`.
- Verificación de bot con Cloudflare Turnstile: validación del token en el servidor mediante la API de Cloudflare, restringida a la acción `registro` y a nombres de host autorizados, rechazando claves de prueba en producción.
- Limitación de tasa (rate limiting) distribuida: contadores en la tabla `rate_limit_counters` con ventanas de tiempo fijas y claves hasheadas con HMAC para IPs públicas, números de WhatsApp, expedientes y accesos al panel.
- Numeración correlativa sin huecos bajo bloqueo transaccional: asignación protegida mediante `pg_advisory_xact_lock` con cálculo `COALESCE(MAX(registration_number), 0) + 1` en una única transacción serializada.
- Cifrado en reposo para datos de contacto: números de WhatsApp y correos electrónicos se cifran con AES-256-GCM utilizando `PII_ENCRYPTION_KEY`, vectores de inicialización independientes y datos autenticados asociados (AAD).
- Índice ciego para detección de duplicados: cálculo de HMAC con clave secreta sobre el teléfono de WhatsApp para validar unicidad sin exponer los datos en texto plano.
- Enlaces de expediente no adivinables y revocables: rutas `/expediente/<numero>-<code>` generadas con HMAC-SHA256 truncado a 10 caracteres en base32 sin almacenamiento en base de datos. La revocación se realiza incrementando el campo `link_version`.
- Derivación de contraseñas con scrypt: almacenamiento de claves administrativas procesadas con el algoritmo scrypt y parámetros de alto costo computacional.
- Sesiones en base de datos protegidas por hash: la tabla `admin_sessions` almacena únicamente el hash SHA-256 del token emitido, impidiendo la recuperación de sesiones en caso de lectura no autorizada de la tabla.
- Bloqueo temporal por ataques de fuerza bruta: suspensión automática de accesos durante 15 minutos tras 5 fallos consecutivos de autenticación.
- Panel de administración en `/admin` con inicio de sesión en `/admin/login`. Protecciones: bloqueo por intentos fallidos, límites de tasa, sesiones en base de datos, CSP con nonce y noindex.
- Política de seguridad de contenido (CSP) con nonce dinámico: cabecera Content-Security-Policy generada en cada petición con nonce criptográfico aleatorio, impidiendo la inyección de scripts externos, complementada con directivas anti-indexación (`X-Robots-Tag: noindex, nofollow`) y no almacenamiento en caché.
- Bitácora de auditoría inmutable (append-only): tabla `audit_logs` con registros de todas las operaciones sensibles del sistema y de administradores, sin rutas de modificación ni borrado.
- Validación de firmas en webhooks de Meta: verificación criptográfica de la cabecera `X-Hub-Signature-256` utilizando el secreto de la aplicación y comparación en tiempo constante (`timingSafeEqual`).
- Cifrado de credenciales de integración de Meta: el token de acceso obtenido en el flujo OAuth se almacena cifrado con AES-256-GCM en la tabla `instagram_connection` usando `INSTAGRAM_TOKEN_ENCRYPTION_KEY`.
- Conexión TLS con verificación estricta de CA: comunicación con la base de datos remota configurada en modo `DATABASE_SSL_MODE=verify-ca` contra el certificado raíz fijado de Railway.

Limitaciones conocidas:
- Cualquier persona que conozca el correo de un administrador puede activar el bloqueo de 15 minutos de esa cuenta enviando 5 contraseñas incorrectas.
- En Vercel Hobby el cron se ejecuta una vez al día, por lo que los reintentos de Instagram también se mueven cuando llega un webhook, un administrador envía un mensaje o alguien abre Mensajes.

## Publicar (cuando el dueño lo apruebe)

Estado actual del proyecto: nada ha sido desplegado aún. La infraestructura completa permanece en local hasta recibir la autorización expresa del dueño.

Pasos para el despliegue una vez autorizado:
1. Crear la base de datos PostgreSQL en Railway utilizando la plantilla o imagen `postgres-ssl:18` y habilitar el TCP proxy público.
2. Obtener el certificado raíz de la autoridad certificadora de Railway ejecutando el siguiente comando contra el host del proxy:
   ```bash
   openssl s_client -starttls postgres -connect <proxy-host>:<port> -showcerts
   ```
   Copiar el último certificado de la cadena mostrada (el certificado raíz PEM).
3. Configurar las variables de conexión a la base de datos: `DATABASE_URL` con la URL del proxy TCP de Railway, `DATABASE_SSL_MODE=verify-ca` y `DATABASE_CA_CERT` con el contenido del certificado PEM.
4. Ejecutar las migraciones de esquema contra Railway antes del primer despliegue de la aplicación:
   ```bash
   node --env-file=<archivo_env_produccion> scripts/db-migrate.mjs
   ```
5. Crear el primer usuario administrador con rol `OWNER` utilizando el flag `--confirm-remote`:
   ```bash
   node --env-file=<archivo_env_produccion> scripts/admin.mjs -- create --confirm-remote
   ```
6. Configurar en el proyecto de Vercel todas las variables de entorno de producción requeridas (`APP_ENV=production`, `APP_SECRET`, `PII_ENCRYPTION_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DATABASE_SSL_MODE`, `DATABASE_CA_CERT`, `BOT_PROTECTION_MODE=turnstile`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_HOSTNAMES`, `RATE_LIMIT_MODE=enforce`).
7. Configurar `NEXT_PUBLIC_SITE_URL` con el dominio oficial (ej. `https://drmr.com.mx`) y autorizar el dominio en el panel de Cloudflare Turnstile.
8. Realizar el despliegue de la aplicación en Vercel.
