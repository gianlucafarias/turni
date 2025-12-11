// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

// https://astro.build/config
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  output: 'server',
  adapter: isProd ? node({ mode: 'standalone' }) : undefined,
  integrations: [tailwind(), react()]
});