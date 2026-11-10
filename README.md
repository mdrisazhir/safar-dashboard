# Safar Tours · Números

Panel con las cifras de facturación de Safar Tours (por cobrar, por pagar, margen del año e ingresos y gastos por mes). Se muestra incrustado en la página principal de Notion.

## Cómo funciona

1. Cada hora, GitHub Actions ejecuta `scripts/build.mjs`.
2. El script lee la tabla **Facturas** de Notion con la API y calcula los números.
3. Los guarda **cifrados** (AES-256-GCM) en `data.json` y publica la carpeta `site/` en GitHub Pages.
4. `site/index.html` descifra los datos en el navegador con la clave que va en el enlace, después de `#`. Esa parte del enlace no se envía nunca al servidor, así que en GitHub solo hay datos ilegibles.

## Puesta en marcha (una sola vez)

1. **Integración de Notion.** En https://www.notion.so/my-integrations crea una integración interna, por ejemplo "Panel Safar", con permiso solo de lectura, y copia el token.
2. **Dale acceso a Facturas.** En Notion, abre la tabla Facturas, pulsa **···** → **Conexiones** y añade la integración.
3. **Secretos en GitHub.** En el repositorio, ve a Settings → Secrets and variables → Actions y crea:
   - `NOTION_TOKEN`: el token del paso 1.
   - `DASH_KEY`: la clave de cifrado. Para generarla: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
4. **Pages.** En Settings → Pages → Source, elige **GitHub Actions**.
5. **Primera publicación.** En Actions → "Actualizar números", pulsa **Run workflow**.
6. **Incrustar en Notion.** El enlace es `https://<usuario>.github.io/<repo>/#<DASH_KEY>`. En Notion escribe `/insertar` (o `/embed`) y pégalo.

## Probar en local

```bash
DASH_KEY=<clave> MOCK=1 node scripts/build.mjs   # datos de prueba
cd site && python3 -m http.server 8000           # abrir http://localhost:8000/#<clave>
```

## Ampliar

- Nuevos cálculos: en la función `calcular()` de `scripts/build.mjs`.
- Nuevas tarjetas: en `pintar()` de `site/index.html`. Vistas del gráfico (mensual, trimestral, anual): en `serie()`.

Para leer otra tabla de Notion (por ejemplo, Tours), dale acceso a la integración y añade otra consulta en `build.mjs`.
