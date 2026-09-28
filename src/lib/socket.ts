import { io, Socket } from 'socket.io-client';

// The verified secure websocket key for Ummis Lane Enterprise Communications
export const WEBSOCKET_KEY = 'fb60458aea288dbb2f7aec4db7004b32377159ef2f44b95af95a18b06d4f86cd';

let socket: Socket | null = null;

export function getSocket(token?: string | null): Socket {
  if (!socket) {
    const authToken = token || localStorage.getItem('token') || '';
    
    // Connect to same host & port (port 3000 in dev/prod)
    socket = io(window.location.origin, {
      path: '/socket.io',
      auth: {
        token: authToken,
        wsKey: WEBSOCKET_KEY
      },
      query: {
        wsKey: WEBSOCKET_KEY
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socket.on('connect', () => {
      console.log('✅ Real-time Socket.IO connected with key:', WEBSOCKET_KEY);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection notice:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
  }

  return socket;
}

export function reconnectSocket(newToken?: string): Socket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  return getSocket(newToken);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
