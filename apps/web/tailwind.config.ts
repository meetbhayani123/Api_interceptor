import type { Config } from 'tailwindcss'

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

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
      colors: {
        surface: token('surface'),
        'surface-raised': token('surface-raised'),
        subtle: token('subtle'),
        accent: token('accent'),
        profit: token('profit'),
        loss: token('loss'),
        back: token('back'),
        lay: token('lay'),
        danger: token('danger'),
      },
    },
  },
  plugins: [],
}
export default config
