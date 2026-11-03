# App para seguimiento de ventas

Aplicación para consultar el seguimiento de ventas, clientes atendidos y cumplimiento de metas.

## Desarrollo local

```sh
pnpm install
pnpm dev
```

## Compilar

```sh
pnpm build
```

El sitio está configurado para el repositorio `Appparaseguimientodeventas` y usa rutas hash para funcionar en GitHub Pages. Por eso las rutas internas se ven como `/#/admin` o `/#/cda/1`.

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` compila y publica automáticamente cada push a `main` en la rama `gh-pages`. También se puede iniciar manualmente desde la pestaña **Actions**.

Antes de publicar, configura estos secretos en **Settings → Secrets and variables → Actions → New repository secret**, usando los valores de tu proyecto Supabase:

- `VITE_SUPABASE_URL`: Project URL.
- `VITE_SUPABASE_ANON_KEY`: publishable/anon key. No uses la clave `service_role`.

En **Settings → Pages**, selecciona **Deploy from a branch**, rama `gh-pages` y carpeta `/(root)`. La primera ejecución debe terminar correctamente antes de que aparezca el último sitio.

## Cuentas de vendedores y administradores

El panel `/admin` permite crear usuarios con contraseña temporal. La contraseña se muestra al administrador una sola vez; la primera vez que ingresen, deberán elegir una contraseña propia. La creación y el cambio obligatorio se procesan con funciones de Supabase para no exponer la clave `service_role` en el navegador.

Antes de usar esta función, desde la raíz del proyecto:

1. Inicia sesión en Supabase CLI y vincula el proyecto (`supabase login` y `supabase link --project-ref <project-ref>`).
2. Aplica la migración que agrega el indicador de cambio obligatorio: `supabase db push`.
3. Publica ambas funciones: `supabase functions deploy crear-usuario-admin` y `supabase functions deploy cambiar-password-temporal`.

### Correo de bienvenida

Al crear una cuenta, `crear-usuario-admin` envía a la persona un correo con su usuario, la contraseña temporal y el enlace para ingresar, desde una cuenta de Gmail.

1. En la cuenta de Gmail que enviará los correos, activa la verificación en dos pasos.
2. Crea una contraseña de aplicación en https://myaccount.google.com/apppasswords (16 caracteres). No uses la contraseña normal de Gmail.
3. Guarda los secretos en Supabase y vuelve a publicar la función:

```sh
supabase secrets set GMAIL_USER=tucorreo@gmail.com
supabase secrets set GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
supabase functions deploy crear-usuario-admin
```

Opcionalmente, `APP_URL` cambia el enlace de ingreso (por defecto usa la URL de GitHub Pages). Gmail permite unos 500 correos al día. Si el correo no se puede enviar, la cuenta igual se crea y el panel muestra la contraseña temporal para entregarla manualmente.

El proyecto usa las claves JWT nuevas de Supabase (ES256 y clave `sb_publishable_…`), así que al desplegar las funciones hay que **desactivar "Verify JWT"** (`--no-verify-jwt` en la CLI). La verificación de la sesión se hace dentro de cada función con `auth.getUser()`.

Las funciones verifican el JWT y el rol activo del administrador antes de crear cuentas. Usan la clave de servicio disponible en el entorno de Supabase; nunca la agregues a variables `VITE_*`, al repositorio ni a GitHub Pages. Las cuentas nuevas de vendedor ya tienen una ruta de panel individual; los datos de ventas aparecerán cuando se vinculen registros reales a esa cuenta.

Para publicar manualmente desde un equipo con permisos de escritura al repositorio, ejecuta:

```sh
pnpm run pages:deploy
```

La aplicación está compilada con la base `/Appparaseguimientodeventas/` y rutas hash para evitar 404 al actualizar o abrir enlaces internos. Los enlaces internos tienen esta forma: `https://samusst.github.io/Appparaseguimientodeventas/#/admin`.
