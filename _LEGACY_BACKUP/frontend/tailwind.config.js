/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'med-green': '#10B981',
                'med-yellow': '#F59E0B',
                'med-red': '#EF4444',
                'med-blue': '#3B82F6',
                'med-bg': '#F3F4F6',
            }
        },
    },
    plugins: [],
}
