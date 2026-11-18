# Sistema inteligente de gestión y predicción de inventarios

Proyecto: *Sistema inteligente de gestión y predicción de inventarios basado en aprendizaje automático y un modelo de lenguaje de gran tamaño (LLM) con asistente conversacional para optimizar el control de stock en una empresa de Los Olivos, 2026.*

Monorepo con tres servicios que se levantan juntos con Docker:

| Servicio | Carpeta | Tecnología | Puerto |
|---|---|---|---|
| Web | `apps/web` | Next.js 14 (App Router, TypeScript), Tailwind CSS, componentes estilo shadcn/ui, iconos Lucide y gráficos Recharts | 3000 |
| API | `apps/api` | Python 3.12, FastAPI, SQLAlchemy | 8000 |
| Base de datos | (imagen oficial) | PostgreSQL 16 | interno |

## Las tres partes del título

1. **Gestión del inventario:** productos, stock mínimo, entradas y salidas (kardex) y alerta de stock bajo.
2. **Predicción de la demanda (aprendizaje automático):** `apps/api/app/services/forecast.py`. Usa las salidas de cada producto como demanda histórica. Con 12 meses o más aplica XGBoost y reporta MAE y RMSE frente a un promedio móvil de 3 meses; con 6 a 11 meses usa ese promedio; con menos de 6 no predice. También sugiere la cantidad a reponer.
3. **Asistente conversacional (LLM):** `apps/api/app/services/assistant.py`. El modelo de lenguaje (API de Claude) no calcula: usa herramientas que leen PostgreSQL (stock, salidas, predicción) y explica el resultado.

## Puesta en marcha

```bash
cp .env.example .env        # edita POSTGRES_PASSWORD, ADMIN_PASSWORD, JWT_SECRET y, para el asistente, GEMINI_API_KEY
docker compose up --build -d
docker compose exec api python -m app.seed   # opcional: datos DE PRUEBA (inventados)
```

- Web: http://localhost:3000 (entra con ADMIN_USER y ADMIN_PASSWORD de tu `.env`)
- Documentación de la API: http://localhost:8000/docs
- Apagar: `docker compose down` (los datos quedan en el volumen `pgdata`; `make reset-db` los borra).

## Cargar los datos reales

1. **Productos** (pantalla *Productos y predicción*): `.xlsx` o `.csv` con las columnas `sku, nombre, categoria, stock, stock_minimo`.
2. **Historial de movimientos** (pantalla *Entradas y salidas*): `.xlsx` o `.csv` con `sku, fecha, tipo, cantidad`, donde `tipo` es `entrada` o `salida`. Por defecto no cambia el stock actual; sirve para que el modelo aprenda. Para un buen resultado se necesitan 12 meses o más.

## Pantallas

- **Panel de stock:** indicadores, entradas y salidas de los últimos 12 meses, más vendidos y productos bajo su mínimo.
- **Productos:** crear, editar, eliminar, importar Excel y ver la predicción de cada producto con gráfico.
- **Reposición sugerida:** cuánto pedir de todos los productos (1 a 6 meses), exportable a CSV.
- **Entradas y salidas:** registro de movimientos y carga del historial.
- **Asistente:** chat con el LLM, que consulta la base de datos mediante herramientas.

## Pruebas

```bash
make test        # pytest con SQLite en memoria; no necesita Docker
```

## Pendiente

- Roles de usuario (hoy hay un único administrador definido en `.env`).
- Migraciones con Alembic (hoy las tablas se crean al iniciar).
- HTTPS (pon `COOKIE_SECURE=true` al activarlo) y copias de respaldo del volumen `pgdata`.
- Los datos de `app.seed` son inventados; no los mezcles con los reales.

## Asistente (LLM)

Por defecto usa Gemini (`LLM_PROVIDER=gemini`), que tiene nivel gratuito con límites de uso que Google puede cambiar.
En el nivel gratuito Google puede usar los datos enviados para mejorar sus productos. Si prefieres Claude, pon
`LLM_PROVIDER=claude` y `ANTHROPIC_API_KEY`. En ambos casos el modelo no calcula nada: consulta tus datos mediante
herramientas (buscar productos, stock bajo, predicción y más vendidos) y los explica en español.
Si el modelo configurado deja de existir, cambia `GEMINI_MODEL` (por ejemplo, `gemini-3.1-flash-lite`).

## Novedades de esta versión

- **Tema claro** y diseño de marca (barra lateral, indicadores, tablas con encabezado negro).
- **Login** con «Recordarme» (sesión de `REMEMBER_DAYS` días, 30 por defecto; sin marcar dura `TOKEN_HOURS` horas).
- **Análisis con IA** en el Panel: el sistema calcula las cifras y el modelo las explica, marca alertas y sugiere
  acciones. Solo consulta al modelo al pulsar el botón, y guarda el resultado mientras los datos no cambien.
- **Cursor brillante** (`src/components/glow-cursor.tsx`): se desactiva en pantallas táctiles y con «reducir movimiento».
  Para quitarlo, borra la línea `<GlowCursor ... />` de `src/app/layout.tsx`.

## Actualizar el proyecto

`actualizar.ps1` aplica un zip nuevo conservando tu `.env` y tu base de datos:

```powershell
powershell -ExecutionPolicy Bypass -File .\actualizar.ps1 -Zip "C:\ruta\fargoz-inventario.zip"
```

## Modo claro / oscuro

El botón de la luna/sol (arriba a la derecha) cambia el tema y lo recuerda en el navegador. El modo claro bloquea los
oscurecedores automáticos del navegador para que se vea tal como está diseñado.

## Si Gemini está saturado

Cuando Google responde «503: mucha demanda», el sistema reintenta 3 veces y luego prueba `GEMINI_FALLBACK_MODEL`.
Si aun así falla, muestra un mensaje claro: espera uno o dos minutos y vuelve a intentar.

## Si el asistente tarda

- Cada consulta a Google espera como máximo `GEMINI_TIMEOUT_SECONDS` (30 s); si se agota, pasa al modelo alternativo.
- `GEMINI_THINKING_LEVEL=low` hace que el modelo piense menos y responda antes. Súbelo a `medium` si quieres respuestas más elaboradas.
- Los tiempos reales quedan en el registro: `docker compose logs api --tail 40` muestra «Asistente: respondió en X s».

## Publicar en internet

Mira `DEPLOY.md` (Vercel para la web, Render para la API y Neon para la base de datos), con sus advertencias y límites.

## Seguridad

**Ya implementado**
- Sesión con cookie `httpOnly`, `SameSite=Lax` y opción `Secure`; toda la API exige sesión salvo el login y `/health`.
- Bloqueo de intentos fallidos por usuario y dirección (5 cada 5 min) y tope por usuario (20 cada 15 min); los intentos
  quedan en el registro (`docker compose logs api`).
- Cabeceras de seguridad en la web (CSP, anti-incrustación, HSTS, `nosniff`, Referrer-Policy, Permissions-Policy) y
  `noindex` para que los buscadores no la indexen.
- Importaciones de Excel/CSV con límite de tamaño, de filas y protección contra «bombas zip».
- En producción, los errores 500 no muestran detalles internos (solo un código para buscarlo en el registro) y se
  ocultan `/docs`.
- Límite de consultas a la IA (30 de chat y 12 de análisis cada 10 min).
- Contenedores sin privilegios de administrador; versiones de Python y Node fijadas; Dependabot semanal.
- El asistente solo puede **leer** datos: sus herramientas no modifican nada.

**Cómo auditar las dependencias:** `make audit` (npm audit + pip-audit).

**Pendiente (si la empresa lo usa de verdad):** varios usuarios con roles y contraseñas cifradas, registro de quién hizo
cada cambio, segundo factor (2FA), respaldos automáticos y cambio de contraseña desde la app.
Ningún sistema es 100 % seguro; esto no reemplaza una auditoría profesional.
