import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        // Small phones (iPhone SE is 375px) get the stacked layouts below this.
        xs: '400px',
      },
    },
  },
  plugins: [],
}
export default config
