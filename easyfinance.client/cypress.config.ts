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
    baseUrl,

    // Cypress 16 changed this default from 10ms to 0ms. The specs submit a form by typing
    // `<value>{enter}` in one `.type()` call, and with no delay between the last keystroke and
    // the Enter key the application's implicit form submission is skipped: no `submit` event
    // fires, so no request is ever made and `cy.wait('@postLogin')` times out with "No request
    // ever occurred". Keeping the Cypress 15 value restores the behaviour the suite was written
    // against, rather than spreading a `{ delay: 10 }` option over every call site.
    keystrokeDelay: 10
  },
});
