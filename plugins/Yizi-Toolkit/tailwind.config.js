/** @type {import('tailwindcss').Config} */
export default {
    content: ["./*.js", "./components/**/*.js", "./core/**/*.js"],
    corePlugins: {
        preflight: false,
    },
    theme: {
        extend: {},
    },
    plugins: [],
}
