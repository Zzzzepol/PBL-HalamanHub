import { useEffect, useRef } from 'react';
import { socket } from '../socket';

/**
 * useLiveRefetch
 *
 * Subscribes to one or more Socket.io events and invokes a callback,
 * throttled so a burst of events (e.g. right after a reconnect) can't
 * fire overlapping API refetches that resolve out of order.
 *
 * @param {string|string[]} events      - event name, or array of event names
 * @param {Function}        callback    - the refetch/action to run
 * @param {number}          [throttleMs=3000] - min ms between invocations.
 *                                              Pass 0 to bypass throttling
 *                                              (fires on every event).
 */
export function useLiveRefetch(events, callback, throttleMs = 3000) {
  // Keep the latest callback in a ref so the socket listener never goes
  // stale without forcing a resubscribe on every render.
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const lastCallRef = useRef(0);

  useEffect(() => {
    const eventList = Array.isArray(events) ? events : [events];

    const handler = (...args) => {
      if (throttleMs <= 0) {
        callbackRef.current(...args);
        return;
      }
      const now = Date.now();
      if (now - lastCallRef.current < throttleMs) return;
      lastCallRef.current = now;
      callbackRef.current(...args);
    };

    eventList.forEach((event) => socket.on(event, handler));

    return () => {
      eventList.forEach((event) => socket.off(event, handler));
    };
    // Resubscribe only if the event name(s) or throttle window change —
    // not on every callback identity change (handled via callbackRef).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(events) ? events.join(',') : events, throttleMs]);
}

export default useLiveRefetch;