declare const _default: {
    content: string[];
    theme: {
        extend: {
            fontFamily: {
                sans: [string, string, string, string];
                display: [string, string, string, string];
            };
            colors: {
                ink: string;
                mist: string;
                glow: string;
                ember: string;
                line: string;
            };
            boxShadow: {
                soft: string;
            };
            keyframes: {
                rise: {
                    '0%': {
                        opacity: string;
                        transform: string;
                    };
                    '100%': {
                        opacity: string;
                        transform: string;
                    };
                };
                drift: {
                    '0%, 100%': {
                        transform: string;
                    };
                    '50%': {
                        transform: string;
                    };
                };
            };
            animation: {
                rise: string;
                drift: string;
            };
        };
    };
    plugins: any[];
};
export default _default;
