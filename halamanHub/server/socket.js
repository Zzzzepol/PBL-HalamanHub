let io = null;

function initSocket(server, allowedOrigins) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: allowedOrigins },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized yet — call initSocket() first.');
  return io;
}

module.exports = { initSocket, getIO };