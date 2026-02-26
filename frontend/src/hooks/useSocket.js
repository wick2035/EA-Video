import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = window.location.origin;

export default function useSocket(events = {}, room = 'dashboard') {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (room) socket.emit(`join:${room}`);
    });

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
