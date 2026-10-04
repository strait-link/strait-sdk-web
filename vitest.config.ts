import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // banner.test.ts opts into jsdom; give it a real origin so localStorage exists.
    environmentOptions: { jsdom: { url: 'https://shop.example/p/42' } },
  },
});
