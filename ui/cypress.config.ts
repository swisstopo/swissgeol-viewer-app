import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(_on, _config) {},
    baseUrl: 'http://localhost:8000',
  },
});
