# Instrucciones para Claude Code — modazapo

## Reglas de deploy al servidor (MUY IMPORTANTE)

- **NUNCA transferir `.env`, `.env.local`, ni ningún archivo de configuración de entorno** al servidor. Estos archivos contienen credenciales reales en el servidor que son distintas a las del entorno local.
- Antes de cada transferencia al servidor, **listar explícitamente los archivos a subir y esperar confirmación del usuario** antes de proceder.
- Solo transferir los archivos de código fuente que fueron modificados en esa tarea específica.
- Después de transferir, verificar con `ls -la` que los archivos llegaron con el tamaño correcto.

## Reglas generales al editar código

- No modificar archivos que no son necesarios para la tarea en cuestión.
- No hacer "mejoras" o refactorizaciones de código que no fueron pedidas.
- Si una tarea requiere cambiar un archivo compartido (como `actions.ts`), revisar primero qué otras funciones usa ese archivo para no romperlas.

## Stack técnico

- Next.js 15 App Router — Server + Client Components
- Prisma ORM + PostgreSQL
- Multi-dominio: modazapotlanejo.com, zonadelvestir.com, kalexafashion.com
- PM2 para gestión del proceso en el servidor
- Resend para envío de correos
- Skydropx para cotización de envíos

## Credenciales y secretos

Todas las credenciales reales (SSH, DB, Resend, Skydropx, Stripe) están en **SECRETOS.md** en la raíz del proyecto. Consultarlo antes de asumir que una clave es placeholder.

## Servidor de producción

- IP: 187.124.158.239
- Proceso PM2: `modazapo`
- Ruta del proyecto: `/var/www/modazapo`
- Deploy: transferir archivos con `base64 | ssh | base64 -d` (SCP falla con rutas que tienen paréntesis como `(marketplace)`)
- Después de transferir: `npm run build && pm2 restart modazapo`
