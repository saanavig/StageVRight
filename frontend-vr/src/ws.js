// src/ws.js
// WebSocket handler for VR frontend

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8001/ws`;

class VRWebSocket {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.onMessage = null;
    this.onOpen = null;
    this.onClose = null;
    this.onError = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = (e) => {
      if (this.onOpen) this.onOpen(e);
    };
    this.ws.onclose = (e) => {
      if (this.onClose) this.onClose(e);
    };
    this.ws.onerror = (e) => {
      if (this.onError) this.onError(e);
    };
    this.ws.onmessage = (e) => {
      if (this.onMessage) this.onMessage(e.data);
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

export default VRWebSocket;
