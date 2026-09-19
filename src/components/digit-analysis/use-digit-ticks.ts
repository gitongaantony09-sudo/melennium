import { useEffect, useState } from 'react';
import { WS_SERVERS } from '@/components/shared/utils/config/config';

type TTickState = {
    quotes: number[];
    pip_size: number;
};

const countDecimals = (value: number) => (String(value).split('.')[1] ?? '').length;

/**
 * Streams the last `count` ticks of `symbol` from Deriv's public websocket:
 * one ticks_history request (with subscribe) that first returns the history and then live ticks.
 */
const useDigitTicks = (symbol: string, count: number, enabled: boolean) => {
    const [state, setState] = useState<TTickState>({ quotes: [], pip_size: 2 });
    const [is_connected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!enabled) return undefined;

        let is_active = true;
        let reconnect_timeout: ReturnType<typeof setTimeout> | undefined;
        let ws: WebSocket | undefined;

        setState({ quotes: [], pip_size: 2 });

        const connect = () => {
            ws = new WebSocket(WS_SERVERS.PRODUCTION);

            ws.onopen = () => {
                setIsConnected(true);
                ws?.send(
                    JSON.stringify({
                        ticks_history: symbol,
                        adjust_start_time: 1,
                        count,
                        end: 'latest',
                        style: 'ticks',
                        subscribe: 1,
                    })
                );
            };

            ws.onmessage = event => {
                if (!is_active) return;
                try {
                    const data = JSON.parse(event.data);
                    if (data.error) return;

                    if (data.msg_type === 'history' && Array.isArray(data.history?.prices)) {
                        const quotes = data.history.prices.map(Number).slice(-count);
                        const pip_size = Number(data.pip_size ?? Math.max(...quotes.map(countDecimals), 0));
                        setState({ quotes, pip_size });
                    } else if (data.msg_type === 'tick' && data.tick?.symbol === symbol) {
                        const quote = Number(data.tick.quote);
                        setState(prev => ({
                            quotes: [...prev.quotes, quote].slice(-count),
                            pip_size: Number(data.tick.pip_size ?? prev.pip_size),
                        }));
                    }
                } catch {
                    // ignore malformed messages
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                if (is_active) reconnect_timeout = setTimeout(connect, 2000);
            };

            ws.onerror = () => ws?.close();
        };

        connect();

        return () => {
            is_active = false;
            if (reconnect_timeout) clearTimeout(reconnect_timeout);
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
        };
    }, [symbol, count, enabled]);

    return { ...state, is_connected };
};

export default useDigitTicks;
