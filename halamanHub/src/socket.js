// shared socket connection for the whole admin app.
// derives the socket url from the same api base you already use.
import { io } from 'socket.io-client';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');

export const socket = io(SOCKET_URL, {
  autoConnect: true,
});