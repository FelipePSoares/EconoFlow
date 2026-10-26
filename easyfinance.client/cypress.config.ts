import { defineConfig } from "cypress";

// The suite runs against an SPA that shares its origin with the API (the client calls bare
// /api URLs). Two things provide that origin:
//
//   * `ng serve` - the SPA proxy used in CI and normal local development - on :4200;
//   * docker-compose.dev.yml, which serves the same origin from the container.
//
// Both listen on :4200, so the default covers both. CYPRESS_BASE_URL overrides it for a
// stack published on another port.
//
// It is read from process.env here rather than through Cypress' own CYPRESS_ prefix: Cypress
// maps that onto `env`, not onto `e2e.baseUrl`, so the suite would still visit the default.
const baseUrl = process.env.CYPRESS_BASE_URL || 'http://localhost:4200';

export default defineConfig({
  e2e: {
    baseUrl
  },
});
