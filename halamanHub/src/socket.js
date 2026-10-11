// shared socket connection for the whole admin app.
// derives the socket url from the same api base you already use.
import { io } from 'socket.io-client';

const PAGE_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_HOST = /^(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[a-z0-9-]+\.local)$/i.test(PAGE_HOST) ? PAGE_HOST : 'localhost';
const API_BASE = process.env.REACT_APP_API_URL || `http://${API_HOST}:4000/api`;
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');

export const socket = io(SOCKET_URL, {
  autoConnect: true,
});
