import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // In development, Vite proxy handles the connection
    // In production, connect to same origin
    socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log('✅ Socket.io connected');
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket.io disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
