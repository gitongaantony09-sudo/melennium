import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import useDigitTicks from './use-digit-ticks';
import {
    calculateStats,
    DEFAULT_SYMBOL,
    DEFAULT_TICK_COUNT,
    getLastDigit,
    getSymbolName,
    TBiasKey,
    TICK_COUNT_OPTIONS,
} from './utils';
import './digit-analysis.scss';

const MIN_WIDTH = 560;
const MIN_HEIGHT = 420;
const DEFAULT_WIDTH = 750;
const DEFAULT_HEIGHT = 748;
const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
// A digit at 20% (twice the expected 10%) fills its whole ring
const RING_FULL_PERCENTAGE = 20;

const BIAS: Record<TBiasKey, { label: string; trade: string; description: string }> = {
    even: { label: 'EVEN', trade: 'Even', description: 'Even digits are dominating this market right now.' },
    odd: { label: 'ODD', trade: 'Odd', description: 'Odd digits are dominating this market right now.' },
    rise: { label: 'RISE', trade: 'Rise', description: 'Rising ticks are dominating this market right now.' },
    fall: { label: 'FALL', trade: 'Fall', description: 'Falling ticks are dominating this market right now.' },
    over: { label: 'OVER 4', trade: 'Over 4', description: 'Digits above 4 are dominating this market right now.' },
    under: { label: 'UNDER 5', trade: 'Under 5', description: 'Digits below 5 are dominating this market right now.' },
};

// Each row is a pair: the higher side is shown green, the lower side red
const TILE_ORDER: TBiasKey[] = ['even', 'odd', 'rise', 'fall', 'over', 'under'];
const TILE_OPPOSITE: Record<TBiasKey, TBiasKey> = {
    even: 'odd',
    odd: 'even',
    rise: 'fall',
    fall: 'rise',
    over: 'under',
    under: 'over',
};

const getWorkspaceSymbol = (): string | undefined => {
    try {
        const workspace = (window as any).Blockly?.derivWorkspace;
        const market_block = workspace?.getAllBlocks?.().find((block: any) => block.type === 'trade_definition_market');
        return market_block?.getFieldValue('SYMBOL_LIST') || undefined;
    } catch {
        return undefined;
    }
};

const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

const DigitAnalysisModal = observer(() => {
    const { dashboard } = useStore();
    const { is_digit_analysis_modal_visible, setDigitAnalysisModalVisibility, bot_builder_symbol } = dashboard;

    const [tick_count, setTickCount] = useState(DEFAULT_TICK_COUNT);
    const [workspace_symbol, setWorkspaceSymbol] = useState<string | undefined>();
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    const container_ref = useRef<HTMLDivElement>(null);

    // The analysed market follows the market picked in the bot's Trade parameters block
    const symbol = bot_builder_symbol || workspace_symbol || DEFAULT_SYMBOL;

    useEffect(() => {
        if (!is_digit_analysis_modal_visible) return;
        setWorkspaceSymbol(getWorkspaceSymbol());
        setPosition(null);
    }, [is_digit_analysis_modal_visible]);

    const { quotes, pip_size } = useDigitTicks(symbol, tick_count, is_digit_analysis_modal_visible);
    const stats = useMemo(() => (quotes.length ? calculateStats(quotes, pip_size) : null), [quotes, pip_size]);
    const last_quote = quotes.length ? quotes[quotes.length - 1] : null;
    const current_digit = last_quote === null ? null : getLastDigit(last_quote, pip_size);

    const startDrag = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if ((event.target as HTMLElement).closest('button, select')) return;
            const rect = container_ref.current?.getBoundingClientRect();
            if (!rect) return;
            const offset_x = event.clientX - rect.left;
            const offset_y = event.clientY - rect.top;

            const onMove = (move_event: PointerEvent) => {
                setPosition({
                    x: Math.min(Math.max(0, move_event.clientX - offset_x), window.innerWidth - 80),
                    y: Math.min(Math.max(0, move_event.clientY - offset_y), window.innerHeight - 60),
                });
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        },
        [setPosition]
    );

    const startResize = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            const start_x = event.clientX;
            const start_y = event.clientY;
            const { width, height } = size;

            const onMove = (move_event: PointerEvent) => {
                setSize({
                    width: Math.max(MIN_WIDTH, width + move_event.clientX - start_x),
                    height: Math.max(MIN_HEIGHT, height + move_event.clientY - start_y),
                });
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        },
        [size]
    );

    if (!is_digit_analysis_modal_visible) return null;

    const symbol_name = getSymbolName(symbol);
    const price_text = last_quote === null ? '' : last_quote.toFixed(pip_size);
    const strongest = stats ? BIAS[stats.strongest] : null;

    const style: React.CSSProperties = {
        width: `min(${size.width}px, calc(100vw - 16px))`,
        height: `min(${size.height}px, calc(100vh - 16px))`,
        ...(position ? { left: position.x, top: position.y } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }),
    };

    return createPortal(
        <div className='digit-analysis' ref={container_ref} style={style} data-testid='dt_digit_analysis'>
            <div className='digit-analysis__header' onPointerDown={startDrag}>
                <div className='digit-analysis__heading'>
                    <span className='digit-analysis__eyebrow'>{localize('LIVE ANALYSIS')}</span>
                    <h3 className='digit-analysis__title'>{localize('Digit Distribution')}</h3>
                </div>
                <label className='digit-analysis__ticks'>
                    <span>{localize('TICKS')}</span>
                    <select value={tick_count} onChange={event => setTickCount(Number(event.target.value))}>
                        {TICK_COUNT_OPTIONS.map(option => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    type='button'
                    className='digit-analysis__close'
                    aria-label={localize('Close')}
                    onClick={setDigitAnalysisModalVisibility}
                >
                    <svg width='14' height='14' viewBox='0 0 14 14' fill='none' aria-hidden='true'>
                        <path d='M2 2l10 10M12 2L2 12' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
                    </svg>
                </button>
            </div>

            <div className='digit-analysis__body'>
                <div className='digit-analysis__top'>
                    <div className='digit-analysis__card'>
                        <span className='digit-analysis__label'>{localize('SELECTED MARKET')}</span>
                        <strong className='digit-analysis__market'>{symbol_name}</strong>
                        <span className='digit-analysis__symbol'>{symbol}</span>
                    </div>
                    <div className='digit-analysis__card digit-analysis__card--price'>
                        <span className='digit-analysis__label'>{localize('CURRENT PRICE')}</span>
                        <div className='digit-analysis__price'>
                            {last_quote === null ? (
                                <span>--</span>
                            ) : (
                                <>
                                    <span>{price_text.slice(0, -1)}</span>
                                    <span className='digit-analysis__price-digit'>{price_text.slice(-1)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className='digit-analysis__digits'>
                    {Array.from({ length: 10 }, (_, digit) => {
                        const value = stats?.digit_percentages[digit] ?? 0;
                        const is_current = digit === current_digit;
                        const is_highest = !!stats && digit === stats.highest_digit;
                        const is_lowest = !!stats && digit === stats.lowest_digit;
                        let ring_class = '';
                        if (is_current) ring_class = 'current';
                        else if (is_highest) ring_class = 'highest';
                        else if (is_lowest) ring_class = 'lowest';
                        const filled = Math.min(1, value / RING_FULL_PERCENTAGE) * RING_LENGTH;

                        return (
                            <div
                                key={digit}
                                className={`digit-analysis__digit${is_current ? ' digit-analysis__digit--current' : ''}`}
                            >
                                <svg className='digit-analysis__ring' viewBox='0 0 68 68' aria-hidden='true'>
                                    <circle className='digit-analysis__ring-track' cx='34' cy='34' r={RING_RADIUS} />
                                    {ring_class && (
                                        <circle
                                            className={`digit-analysis__ring-value digit-analysis__ring-value--${ring_class}`}
                                            cx='34'
                                            cy='34'
                                            r={RING_RADIUS}
                                            strokeDasharray={`${filled} ${RING_LENGTH}`}
                                            transform='rotate(-90 34 34)'
                                        />
                                    )}
                                </svg>
                                <span className='digit-analysis__digit-number'>{digit}</span>
                                <span className='digit-analysis__digit-percentage'>{formatPercentage(value)}</span>
                                {is_current && <span className='digit-analysis__pointer' />}
                            </div>
                        );
                    })}
                </div>

                <div className='digit-analysis__tiles'>
                    {TILE_ORDER.map(key => {
                        const value = stats?.pairs[key] ?? 0;
                        const is_leading = !!stats && value >= stats.pairs[TILE_OPPOSITE[key]];
                        return (
                            <div
                                key={key}
                                className={`digit-analysis__tile digit-analysis__tile--${is_leading ? 'up' : 'down'}`}
                            >
                                <span>{BIAS[key].label}</span>
                                <strong>{formatPercentage(value)}</strong>
                            </div>
                        );
                    })}
                </div>

                <div className='digit-analysis__bottom'>
                    <div className='digit-analysis__card'>
                        <span className='digit-analysis__label'>{localize('SUMMARY')}</span>
                        <p className='digit-analysis__text'>
                            {strongest
                                ? `${localize('Last')} ${stats?.total} ${localize('ticks on')} ${symbol} ${localize(
                                      'show the strongest bias toward'
                                  )} ${strongest.trade}.`
                                : localize('Waiting for ticks...')}
                        </p>
                    </div>
                    <div className='digit-analysis__card digit-analysis__card--suggested'>
                        <span className='digit-analysis__label'>{localize('SUGGESTED TRADE')}</span>
                        <strong className='digit-analysis__suggested'>{strongest?.trade ?? '--'}</strong>
                        {strongest && (
                            <p className='digit-analysis__text'>
                                {strongest.description}
                                <br />
                                {localize('Market:')} {symbol_name}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className='digit-analysis__resize' onPointerDown={startResize} aria-hidden='true'>
                <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
                    <path d='M17 6L6 17M17 12l-5 5' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
                </svg>
            </div>
        </div>,
        document.body
    );
});

export default DigitAnalysisModal;
