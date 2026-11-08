/** Design tokens from DESIGN.md (Linear). Values live in CSS variables so light/dark can swap. */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'), s1: v('surface-1'), s2: v('surface-2'), s3: v('surface-3'), s4: v('surface-4'),
        hair: v('hairline'), 'hair-strong': v('hairline-strong'),
        ink: v('ink'), 'ink-muted': v('ink-muted'), 'ink-subtle': v('ink-subtle'), 'ink-faint': v('ink-faint'),
        primary: v('primary'), 'primary-hover': v('primary-hover'),
        income: v('income'), expense: v('expense'), warn: v('warn'),
      },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px', xxl: '24px' },
      fontFamily: { sans: ['"Inter Variable"', 'SF Pro Display', '-apple-system', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      fontSize: {
        caption: ['12px', { lineHeight: '1.4' }],
        'body-sm': ['14px', { lineHeight: '1.5' }],
        body: ['16px', { lineHeight: '1.5', letterSpacing: '-0.05px' }],
        'card-title': ['22px', { lineHeight: '1.25', letterSpacing: '-0.4px', fontWeight: '500' }],
        headline: ['28px', { lineHeight: '1.2', letterSpacing: '-0.6px', fontWeight: '600' }],
        'display-md': ['40px', { lineHeight: '1.15', letterSpacing: '-1px', fontWeight: '600' }],
      },
      keyframes: {
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-8px)' }, '40%,80%': { transform: 'translateX(8px)' } },
        sheet: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: { shake: 'shake .4s ease', sheet: 'sheet .18s ease-out', fade: 'fade .15s ease-out' },
    },
  },
  plugins: [],
}
