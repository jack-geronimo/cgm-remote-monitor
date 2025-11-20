import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let isAuthorized = false;

/**
 * Hash API secret using SHA1 (same as in api.ts)
 */
async function hashApiSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Authorize the socket connection with Nightscout server
 * This is required to join the 'DataReceivers' room and receive live updates
 */
async function authorizeSocket(socket: Socket): Promise<void> {
  if (isAuthorized) {
    console.log('Socket already authorized, skipping');
    return;
  }

  const subjectToken = import.meta.env.VITE_SUBJECT_TOKEN;
  const apiSecret = import.meta.env.VITE_API_SECRET;

  if (!subjectToken && !apiSecret) {
    console.warn('⚠️ No authentication configured for Socket.io');
    return;
  }

  // Build authorization message
  const authMessage: any = {
    client: 'web',
    history: 48, // Request 48 hours of history
    status: true, // Request status information
  };

  // Use Subject Token (preferred) or API_SECRET (fallback)
  // IMPORTANT: Subject Tokens go in 'secret' field (NOT 'token' - that's for JWTs)
  // Server checks: storage.doesAccessTokenExist(api_secret)
  if (subjectToken) {
    authMessage.secret = subjectToken; // Subject Token as-is (no hashing!)
    console.log('🔐 Authorizing socket with Subject Token...');
  } else if (apiSecret) {
    authMessage.secret = await hashApiSecret(apiSecret); // API_SECRET needs SHA1 hash
    console.log('🔐 Authorizing socket with API_SECRET (hashed)...');
  }

  // Send authorization and wait for response
  socket.emit('authorize', authMessage, (authorization: any) => {
    if (authorization && authorization.read) {
      isAuthorized = true;
      console.log('✅ Socket authorized successfully - will receive live updates');
      console.log('   Permissions:', authorization);
    } else {
      console.error('❌ Socket authorization failed:', authorization);
    }
  });
}

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
      isAuthorized = false; // Reset on reconnect
      authorizeSocket(socket!).catch(err => {
        console.error('Failed to authorize socket:', err);
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket.io disconnected');
      isAuthorized = false;
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
    });

    socket.on('connected', () => {
      console.log('📡 Server confirmed connection');
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
