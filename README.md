# Demo Transacciones - Sesión Única

Incluye registro, login, saldo inicial, transferencias, WebSockets, dashboard, auditoría por IP y bloqueo de doble login.

## Despliegue

```bash
docker compose down -v
docker compose up --build -d
```

Frontend: http://194.163.185.53/
Swagger: http://194.163.185.53:8000/docs

Ajusta tu IP en `docker-compose.yml` en `VITE_API_URL` y `VITE_WS_URL`.
