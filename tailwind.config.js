/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: { 
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        }
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.700'),
            fontSize: '1.05rem',
            lineHeight: '1.75',
            a: {
              color: theme('colors.black'),
              textDecorationThickness: '1px',
              textUnderlineOffset: '4px',
              fontWeight: '500',
              transition: 'color 0.2s ease',
              '&:hover': {
                color: theme('colors.gray.500'),
              },
            },
            strong: {
              color: theme('colors.black'),
              fontWeight: '600',
            },
            p: {
              marginTop: '1.25em',
              marginBottom: '1.25em',
            },
            blockquote: {
              borderLeftColor: theme('colors.gray.200'),
              color: theme('colors.gray.500'),
              fontStyle: 'italic',
              fontWeight: '300',
            },
          },
        },
      }),
    } 
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
};
