class ConnectionManager:
    def __init__(self):
        self.active_connections = set()
    async def connect(self, websocket):
        await websocket.accept(); self.active_connections.add(websocket)
    def disconnect(self, websocket):
        self.active_connections.discard(websocket)
    async def broadcast(self, message: dict):
        dead = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(connection)
manager = ConnectionManager()
