/// <reference types="cypress" />

import type { IsolatedProject, IsolatedProjectOptions, Month } from './isolated-project';

declare namespace Cypress {
  interface Chainable {
    login(username: string, password: string): Chainable<void>
    register(username: string, password: string): Chainable<void>
    waitForLoader(): Chainable<void>

    /**
     * Clicks the first element matching `selector`, retrying while the loading overlay
     * covers it. See `cypress/support/commands.ts`.
     */
    clickWhenLoaderGone(selector: string): Chainable<void>

    /**
     * Creates a project that belongs to this test alone, with its own category and one
     * expense per given month. See `cypress/support/isolated-project.ts`.
     */
    createIsolatedProject(months: Month[], options?: IsolatedProjectOptions): Chainable<IsolatedProject>
  }
}
