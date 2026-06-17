"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeWebSocketServer = exports.getConnectedClientCount = exports.broadcastToSite = exports.broadcastToClients = exports.initializeWebSocketServer = void 0;
const ws_1 = require("ws");
const config_1 = require("../config");
let wss = null;
const clients = new Set();
function initializeWebSocketServer() {
    const port = config_1.config.WS_PORT;
    wss = new ws_1.WebSocketServer({ port });
    wss.on('connection', (ws) => {
        console.log('WebSocket client connected');
        clients.add(ws);
        // Send initial connection confirmation
        ws.send(JSON.stringify({
            type: 'CONNECTED',
            payload: { message: 'Connected to Lilstock WebSocket' },
            timestamp: new Date(),
        }));
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                console.log('WebSocket message received:', data);
                // Handle ping/pong for keepalive
                if (data.type === 'PING') {
                    ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date() }));
                }
            }
            catch (error) {
                console.error('WebSocket message error:', error);
            }
        });
        ws.on('close', () => {
            console.log('WebSocket client disconnected');
            clients.delete(ws);
        });
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            clients.delete(ws);
        });
    });
    console.log(`WebSocket server running on port ${port}`);
    return wss;
}
exports.initializeWebSocketServer = initializeWebSocketServer;
function broadcastToClients(event) {
    if (clients.size === 0)
        return;
    const message = JSON.stringify(event);
    clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(message);
        }
    });
}
exports.broadcastToClients = broadcastToClients;
function broadcastToSite(siteId, event) {
    // In a real implementation, you'd track which clients are subscribed to which sites
    // For now, broadcast to all and let clients filter by siteId in the payload
    broadcastToClients({
        ...event,
        payload: { ...event.payload, siteId },
    });
}
exports.broadcastToSite = broadcastToSite;
function getConnectedClientCount() {
    return clients.size;
}
exports.getConnectedClientCount = getConnectedClientCount;
function closeWebSocketServer() {
    if (wss) {
        wss.close(() => {
            console.log('WebSocket server closed');
        });
        clients.clear();
        wss = null;
    }
}
exports.closeWebSocketServer = closeWebSocketServer;
//# sourceMappingURL=server.js.map