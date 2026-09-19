type TDigitAnalysisIconProps = {
    className?: string;
    size?: number;
    /** Menu items pass Deriv's icon size token; 'xs' renders a compact icon */
    iconSize?: string;
};

const DigitAnalysisIcon = ({ className, size = 24, iconSize }: TDigitAnalysisIconProps) => {
    const dimension = iconSize === 'xs' ? 18 : size;

    return (
        <svg
            className={className}
            width={dimension}
            height={dimension}
            viewBox='0 0 24 24'
            fill='none'
            aria-hidden='true'
        >
            <circle cx='12' cy='12' r='9.5' stroke='#ff444f' strokeWidth='2.4' />
            <circle cx='12' cy='12' r='5.5' stroke='#ff444f' strokeWidth='2.4' />
            <circle cx='12' cy='12' r='1.8' fill='#ff444f' />
        </svg>
    );
};

export default DigitAnalysisIcon;
