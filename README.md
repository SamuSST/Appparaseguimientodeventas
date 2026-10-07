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

En **Settings → Pages**, selecciona **Deploy from a branch**, rama `gh-pages` y carpeta `/(root)`. La primera ejecución debe terminar correctamente antes de que aparezca el último sitio.

Para publicar manualmente desde un equipo con permisos de escritura al repositorio, ejecuta:

```sh
pnpm run pages:deploy
```

La aplicación está compilada con la base `/Appparaseguimientodeventas/` y rutas hash para evitar 404 al actualizar o abrir enlaces internos. Los enlaces internos tienen esta forma: `https://samusst.github.io/Appparaseguimientodeventas/#/admin`.
