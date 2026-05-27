# Demo Transacciones - Sesión Única

Aplicación demostrativa de transferencias entre usuarios con autenticación JWT, control de sesión única, WebSockets, auditoría por IP, dashboard financiero y despliegue contenerizado con Docker Compose.

---

## 1. Objetivo de la aplicación

Esta aplicación permite simular un sistema básico de transacciones entre usuarios, incluyendo:

- Registro de usuarios.
- Inicio de sesión con JWT.
- Bloqueo de doble sesión por usuario.
- Consulta de saldo.
- Envío de dinero entre usuarios.
- Confirmación de transferencias.
- Dashboard de transacciones.
- Actualización en tiempo real mediante WebSockets.
- Auditoría de operaciones con IP origen.

---

## 2. Arquitectura general

```text
Usuario / Navegador
        |
        | HTTPS
        v
Cloudflare
        |
        | HTTPS
        v
Nginx Reverse Proxy
        |
        +-----------------------------+
        |                             |
        v                             v
Frontend React/Vite              API Backend FastAPI
Puerto 5173                      Puerto 8000
        |                             |
        |                             v
        |                         Base de datos
        |                         PostgreSQL
        |
        v
WebSocket wss://api.htqasas.com/ws
