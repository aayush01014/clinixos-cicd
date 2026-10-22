type MessageCallback = (data: any) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  private listeners: Map<string, Set<MessageCallback>> = new Map();
  private reconnectInterval: number = 3000;
  private isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.isConnected = true;
        console.log('[ClinixOS WS Client] Live connection established with Port 5000/ws');
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const { type, payload } = parsed;

          if (type && this.listeners.has(type)) {
            this.listeners.get(type)?.forEach((cb) => cb(payload));
          }

          // Also trigger wildcard subscribers
          if (this.listeners.has('*')) {
            this.listeners.get('*')?.forEach((cb) => cb(parsed));
          }
        } catch (err) {
          console.error('[ClinixOS WS Client] Message parsing error:', err);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        setTimeout(() => this.connect(), this.reconnectInterval);
      };

      this.socket.onerror = (err) => {
        this.socket?.close();
      };
    } catch (err) {
      setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }

  public subscribe(type: string, callback: MessageCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(callback);

    // Return cleanup function
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}

export const wsClient = new WebSocketClient();
