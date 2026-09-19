export const TICK_COUNT_OPTIONS = [100, 250, 500, 1000, 2000, 5000];
export const DEFAULT_TICK_COUNT = 1000;
export const DEFAULT_SYMBOL = 'R_100';

const SYMBOL_NAMES: Record<string, string> = {
    R_10: 'Volatility 10 Index',
    R_25: 'Volatility 25 Index',
    R_50: 'Volatility 50 Index',
    R_75: 'Volatility 75 Index',
    R_100: 'Volatility 100 Index',
    '1HZ10V': 'Volatility 10 (1s) Index',
    '1HZ15V': 'Volatility 15 (1s) Index',
    '1HZ25V': 'Volatility 25 (1s) Index',
    '1HZ30V': 'Volatility 30 (1s) Index',
    '1HZ50V': 'Volatility 50 (1s) Index',
    '1HZ75V': 'Volatility 75 (1s) Index',
    '1HZ90V': 'Volatility 90 (1s) Index',
    '1HZ100V': 'Volatility 100 (1s) Index',
    '1HZ150V': 'Volatility 150 (1s) Index',
    '1HZ250V': 'Volatility 250 (1s) Index',
    BOOM300N: 'Boom 300 Index',
    BOOM500: 'Boom 500 Index',
    BOOM600: 'Boom 600 Index',
    BOOM900: 'Boom 900 Index',
    BOOM1000: 'Boom 1000 Index',
    CRASH300N: 'Crash 300 Index',
    CRASH500: 'Crash 500 Index',
    CRASH600: 'Crash 600 Index',
    CRASH900: 'Crash 900 Index',
    CRASH1000: 'Crash 1000 Index',
    JD10: 'Jump 10 Index',
    JD25: 'Jump 25 Index',
    JD50: 'Jump 50 Index',
    JD75: 'Jump 75 Index',
    JD100: 'Jump 100 Index',
    RDBEAR: 'Bear Market Index',
    RDBULL: 'Bull Market Index',
    stpRNG: 'Step Index',
};

export const getSymbolName = (symbol: string) => SYMBOL_NAMES[symbol] ?? symbol;

export const getLastDigit = (quote: number, pip_size: number) => Number(quote.toFixed(pip_size).slice(-1));

export type TBiasKey = 'even' | 'odd' | 'rise' | 'fall' | 'over' | 'under';

export type TDigitStats = {
    total: number;
    /** Percentage (0-100) for each digit 0-9 */
    digit_percentages: number[];
    /** Percentage (0-100) per pair side */
    pairs: Record<TBiasKey, number>;
    highest_digit: number;
    lowest_digit: number;
    /** The side of the strongest pair bias (largest distance from 50%) */
    strongest: TBiasKey;
};

const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);

export const calculateStats = (quotes: number[], pip_size: number): TDigitStats => {
    const counts = new Array(10).fill(0);
    quotes.forEach(quote => {
        counts[getLastDigit(quote, pip_size)] += 1;
    });

    const total = quotes.length;
    const digit_percentages = counts.map(count => pct(count, total));

    let rises = 0;
    let falls = 0;
    for (let i = 1; i < quotes.length; i++) {
        if (quotes[i] > quotes[i - 1]) rises += 1;
        else if (quotes[i] < quotes[i - 1]) falls += 1;
    }

    const even = digit_percentages.filter((_, digit) => digit % 2 === 0).reduce((sum, value) => sum + value, 0);
    const over = digit_percentages.slice(5).reduce((sum, value) => sum + value, 0);
    const pairs: Record<TBiasKey, number> = {
        even,
        odd: total ? 100 - even : 0,
        rise: pct(rises, rises + falls),
        fall: pct(falls, rises + falls),
        over,
        under: total ? 100 - over : 0,
    };

    let highest_digit = 0;
    let lowest_digit = 0;
    digit_percentages.forEach((value, digit) => {
        if (value > digit_percentages[highest_digit]) highest_digit = digit;
        if (value < digit_percentages[lowest_digit]) lowest_digit = digit;
    });

    const leaders: TBiasKey[] = [
        pairs.even >= pairs.odd ? 'even' : 'odd',
        pairs.rise >= pairs.fall ? 'rise' : 'fall',
        pairs.over >= pairs.under ? 'over' : 'under',
    ];
    const strongest = leaders.reduce((best, key) => (pairs[key] > pairs[best] ? key : best), leaders[0]);

    return { total, digit_percentages, pairs, highest_digit, lowest_digit, strongest };
};
