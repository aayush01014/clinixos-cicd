import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

let wss: WebSocketServer | null = null;
const connectedClients = new Set<WebSocket>();

export function initializeWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    connectedClients.add(ws);
    console.log(`[ClinixOS WS] New client connected to live telemetry. Total clients: ${connectedClients.size}`);

    // Send initial handshake
    ws.send(JSON.stringify({
      type: 'SYSTEM_CONNECTED',
      message: 'Connected to ClinixOS Real-Time Telemetry Gateway (Port 8080/ws)',
      timestamp: new Date().toISOString()
    }));

    ws.on('close', () => {
      connectedClients.delete(ws);
      console.log(`[ClinixOS WS] Client disconnected. Total clients: ${connectedClients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[ClinixOS WS] Socket error:', err.message);
      connectedClients.delete(ws);
    });
  });

  return wss;
}

export function broadcastMessage(type: string, payload: any): void {
  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString()
  });

  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('[ClinixOS WS] Failed to send message to client:', err);
      }
    }
  });
}
