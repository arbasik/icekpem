/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                void: 'rgb(var(--color-void) / <alpha-value>)',
                glass: '#1A1A1A',
                primary: 'rgb(var(--color-primary) / <alpha-value>)',
                action: '#f97316',
                success: '#10b981',
                secondary: '#9CA3AF'
            },
            backdropBlur: {
                'glass': '12px'
            }
        },
    },
    plugins: [],
}
