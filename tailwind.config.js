/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: { 
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: '#1c1c1c',
            fontSize: '1.25rem',
            lineHeight: '1.8',
            fontWeight: '500',
            a: {
              color: '#1c1c1c',
              textDecorationThickness: '2px',
              textUnderlineOffset: '6px',
              fontWeight: '700',
              transition: 'all 0.2s ease',
              '&:hover': {
                color: theme('colors.gray.500'),
                textDecorationColor: theme('colors.gray.300'),
              },
            },
            strong: {
              color: '#1c1c1c',
              fontWeight: '800',
            },
            p: {
              marginTop: '1.5em',
              marginBottom: '1.5em',
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
