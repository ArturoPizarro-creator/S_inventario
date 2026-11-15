# Publicar el sistema en internet

Esta guía publica el sistema con **Vercel (web) + Render (API) + Neon (PostgreSQL)**. Los planes gratuitos cambian
seguido: confirma los límites en cada sitio antes de empezar. **Docker en tu computadora sigue siendo la forma
principal y probada de ejecutarlo**; esto es una publicación adicional.

```
Navegador ──► Vercel (web Next.js) ──/api──► Render (API Python) ──► Neon (PostgreSQL)
                                                  └──► Google Gemini
```

## Antes de empezar: tres advertencias

1. **Vercel Hobby (gratis) es solo para uso personal y no comercial.** Según sus normas, cualquier despliegue hecho
   para el beneficio económico de alguien cuenta como comercial. Para una demostración de tesis puede servir; si la
   empresa lo va a usar en su operación, corresponde el plan Pro (de pago) u otro alojamiento.
2. **La API gratuita de Render se duerme tras 15 minutos sin uso** y tarda cerca de un minuto en despertar: la primera
   consulta después de un rato será lenta. Un servicio de pago pequeño (desde unos 7 USD/mes) no se duerme.
3. **No uses la base de datos gratuita de Render:** se borra a los 30 días. Usa Neon, que no caduca (0,5 GB gratis).

Tu información de inventario quedará en servidores de terceros, y con el plan gratuito de Gemini Google puede usar lo
que se envíe para mejorar sus productos.

## Paso 0: subir el código a GitHub

1. Crea una cuenta en github.com y un repositorio **privado** vacío.
2. En la carpeta del proyecto:
   ```powershell
   git init
   git add .
   git status        # comprueba que NO aparezca .env, .env.respaldo ni ningún .sql
   git commit -m "Sistema de inventario Fargoz"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/fargoz-inventario.git
   git push -u origin main
   ```
   El archivo `.env` (tus claves) está en `.gitignore`: no debe subirse nunca.

## Paso 1: base de datos en Neon

1. Crea una cuenta en neon.com y un proyecto (elige una región cercana a la de Render).
2. Copia la **connection string** (empieza con `postgresql://…`). No hace falta cambiarla: el sistema añade solo el
   driver. Si la web de Neon ofrece «pooled» y «direct», usa **direct**.

## Paso 2: la API en Render

1. Crea una cuenta en render.com y conéctala con tu GitHub.
2. **New → Blueprint** y elige tu repositorio (usa `render.yaml`). Si prefieres a mano: **New → Web Service**,
   Docker, *Root Directory* `apps/api`, plan Free, *Health Check Path* `/health`.
3. Completa las variables que pide:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | la cadena de Neon |
   | `ADMIN_USER` | tu usuario |
   | `ADMIN_PASSWORD` | una contraseña **larga y única** (no la de pruebas) |
   | `GEMINI_API_KEY` | tu clave de Google AI Studio |
   | `JWT_SECRET` | la genera Render |
   | `ENVIRONMENT` / `COOKIE_SECURE` | `production` / `true` (ya vienen en el plano) |

4. Cuando termine el despliegue, abre `https://TU-API.onrender.com/health`: debe responder `{"status":"ok"}`.
   Anota esa dirección.

## Paso 3: la web en Vercel

1. Crea una cuenta en vercel.com con tu GitHub → **Add New → Project** → elige el repositorio.
2. En la configuración antes de desplegar:
   - **Root Directory:** `apps/web`
   - **Framework:** Next.js (lo detecta solo)
   - **Environment Variables:** `API_INTERNAL_URL` = `https://TU-API.onrender.com` (sin barra al final)
3. **Deploy.** Importante: esa variable se lee al construir; si la cambias después, hay que **volver a desplegar**.
4. Abre la dirección `https://….vercel.app`, inicia sesión y revisa cada pantalla.

## Paso 4: cargar tus datos

La base de Neon empieza vacía. Importa tus Excel desde la propia web (Productos → Importar Excel y Entradas y
salidas → Cargar historial), o pasa tu base local con `pg_dump`/`psql` si prefieres.

## Lista de comprobación

- [ ] `https://TU-API.onrender.com/docs` **no** abre (está oculto en producción).
- [ ] El login funciona y, al cerrar el navegador y volver, la sesión sigue si marcaste «Recordarme».
- [ ] Panel, Productos, Reposición y Movimientos cargan.
- [ ] «Analizar con IA» responde (la primera vez puede tardar si la API estaba dormida).
- [ ] La contraseña de administrador **no** es la de pruebas.

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| La primera carga tarda ~1 minuto o da 502 | La API gratuita estaba dormida: espera y recarga. |
| Todas las llamadas fallan con 404/500 | `API_INTERNAL_URL` mal escrita o sin volver a desplegar tras cambiarla. |
| No mantiene la sesión | `COOKIE_SECURE=true` solo funciona con HTTPS: entra por la dirección `https://`. |
| «Falta GEMINI_API_KEY» | No se cargó la variable en Render. |
| Error de conexión a la base | Cadena de Neon incompleta (falta `?sslmode=require`) o proyecto pausado. |

## Si es para uso real de la empresa

Considera un servidor propio pequeño (VPS) con el mismo `docker compose`, un dominio y HTTPS: no tiene sueño, ni
límites de plan, ni la restricción de uso comercial. Puedo preparar esa guía si lo necesitas.
