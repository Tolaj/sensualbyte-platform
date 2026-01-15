/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            boxShadow: {
                soft: "0 1px 2px rgba(0,0,0,0.06), 0 10px 30px rgba(0,0,0,0.06)",
            },
        },
    },
    plugins: [],
};
