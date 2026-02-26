import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = window.location.origin;

/**
 * @param {object} events - { eventName: handler }
 * @param {string|Array} room - 'dashboard' or ['dashboard', { type: 'meeting', id: uuid }]
 */
export default function useSocket(events = {}, room = 'dashboard') {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const joinRooms = () => {
      const rooms = Array.isArray(room) ? room : (room ? [room] : []);
      rooms.forEach((r) => {
        if (typeof r === 'object' && r.type && r.id) {
          socket.emit(`join:${r.type}`, r.id);
        } else if (typeof r === 'string') {
          socket.emit(`join:${r}`);
        }
      });
    };

    socket.on('connect', joinRooms);

    Object.entries(events).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(events).forEach((event) => socket.off(event));
      socket.disconnect();
    };
  }, []);

  return socketRef;
}
