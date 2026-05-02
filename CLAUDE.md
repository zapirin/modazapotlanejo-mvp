# Instrucciones para Claude Code — modazapo


Guías de comportamiento para reducir errores comunes de codificación con LLMs. Combinar con instrucciones específicas del proyecto según sea necesario.

**Compromiso:** Estas guías priorizan la precaución sobre la velocidad. Para tareas triviales, usa tu criterio.

## 1. Piensa Antes de Codificar

**No asumas. No ocultes tu confusión. Presenta las opciones.**

Antes de implementar:
- Declara tus suposiciones explícitamente. Si no estás seguro, pregunta.
- Si existen múltiples interpretaciones, preséntalas — no elijas en silencio.
- Si existe un enfoque más simple, dilo. Cuestiona cuando sea necesario.
- Si algo no está claro, detente. Nombra lo que te confunde. Pregunta.

## 2. Simplicidad Primero

**El mínimo código que resuelve el problema. Nada especulativo.**

- No agregues funcionalidades más allá de lo que se pidió.
- No crees abstracciones para código de un solo uso.
- No agregues "flexibilidad" o "configurabilidad" que no fue solicitada.
- No manejes errores para escenarios imposibles.
- Si escribes 200 líneas y podrían ser 50, reescríbelo.

Pregúntate: "¿Un ingeniero senior diría que esto está sobrecomplicado?" Si la respuesta es sí, simplifica.

## 3. Cambios Quirúrgicos

**Toca solo lo necesario. Limpia solo tu propio desorden.**

Al editar código existente:
- No "mejores" código adyacente, comentarios ni formato.
- No refactorices cosas que no están rotas.
- Sigue el estilo existente, aunque tú lo harías diferente.
- Si notas código muerto no relacionado, menciónalo — no lo borres.

Cuando tus cambios crean elementos huérfanos:
- Elimina imports/variables/funciones que TUS cambios dejaron sin uso.
- No elimines código muerto preexistente a menos que se te pida.

La prueba: Cada línea modificada debe rastrearse directamente a la solicitud del usuario.

## 4. Ejecución Orientada a Metas

**Define criterios de éxito. Itera hasta verificar.**

Transforma las tareas en objetivos verificables:
- "Agrega validación" → "Escribe pruebas para entradas inválidas, luego haz que pasen"
- "Corrige el bug" → "Escribe una prueba que lo reproduzca, luego haz que pase"
- "Refactoriza X" → "Asegura que las pruebas pasen antes y después"

Para tareas de múltiples pasos, presenta un plan breve:
```
1. [Paso] → verificar: [chequeo]
2. [Paso] → verificar: [chequeo]
3. [Paso] → verificar: [chequeo]
```

Criterios de éxito sólidos te permiten iterar de forma independiente. Criterios débiles ("haz que funcione") requieren aclaraciones constantes.

---

**Estas guías están funcionando si:** hay menos cambios innecesarios en los diffs, menos reescrituras por sobrecomplicación, y las preguntas de aclaración llegan antes de la implementación en lugar de después de los errores.



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
