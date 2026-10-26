Cypress.Commands.add('login', (username, password) => {
  Cypress.env('authCredentials', { username, password });

  cy.session([username, password], () => {
    cy.request('POST', '/api/AccessControl/login', {
      email: username,
      password
    })
  }, {
    cacheAcrossSpecs: true,
    validate: () => {
      cy.request({
        method: 'GET',
        url: '/api/AccessControl/IsLogged',
        failOnStatusCode: false
      }).its('body').should('eq', true)
    }
  })
})

Cypress.Commands.add('register', (username, password) => {
  // The app auto-saves the first-signin profile; waiting for that PATCH before typing is
  // pointless - and intermittently fatal. The PATCH fires on its own debounce, so it can
  // complete before the first keystroke, and `cy.wait` on a route that already resolved is
  // a hard "No request ever occurred". The assertion below is on the persisted state
  // instead, which is what "the profile was saved" actually means.
  cy.session(
    username,
    () => {
      cy.intercept('PATCH', '/api/AccessControl/').as('patchAccount')
      cy.intercept('GET', '/api/AccessControl/').as('getAccount')

      cy.request('POST', '/api/AccessControl/register', {
        email: username,
        password
      }).then((resp) => {
        cy.log('Status: ' + resp.status)

        cy.visit('/projects')
        cy.url().should('include', 'first-signin')

        cy.get('input[formControlName=firstName]').type('test')
        cy.get('input[formControlName=lastName]').type('test')
        cy.get('button[type=submit]').click();

        // The redirect is what the app does once the profile is saved, so this waits for
        // the save. The profile itself is read back later, on the account page, rather than
        // by polling in the middle of the flow: a failing read here would abort the rest of
        // the flow and surface as the redirect assertion, hiding the real cause.
        cy.url({ timeout: 20000 }).should('include', '/projects')
      })
    },
    {
      cacheAcrossSpecs: true,
      validate: () => {
        cy.request({
          method: 'GET',
          url: '/api/AccessControl/IsLogged',
          failOnStatusCode: false
        }).its('body').should('eq', true)
      }
    }
  )
});

Cypress.Commands.add('waitForLoader', () => {
  cy.get('body', { timeout: 20000 }).should(($body) => {
    expect($body.find('.cssload-container:visible').length).to.equal(0);
  });
});

/**
 * Clicks an element once the loading overlay is not covering it.
 *
 * `waitForLoader` only proves the overlay is absent at the moment it is checked. The page
 * can render, then start a background refresh whose overlay covers the element again, so a
 * plain sequence of "wait for loader, wait for element, click" still intermittently fails
 * with "is being covered by another element".
 *
 * Cypress refuses to click a covered element, so retrying the click is what waits for the
 * overlay to actually be gone: the first attempt that runs while the list is idle succeeds.
 */
Cypress.Commands.add('clickWhenLoaderGone' as unknown as keyof Cypress.Chainable, ((selector: string) => {
  cy.get(selector, { timeout: 20000 }).should('have.length.at.least', 1);

  // Retry the click while the loading overlay covers the element. Cypress refuses to click
  // a covered element, so the first attempt that runs while the list is idle succeeds.
  const click = (attempt: number): void => {
    cy.get(selector).first().click({ timeout: 20000 }).then(
      () => undefined,
      (error: Error) => {
        if (attempt >= 5 || !/covered by another element/i.test(error.message)) {
          throw error;
        }

        cy.wait(500);
        click(attempt + 1);
      }
    );
  };

  click(0);
}) as unknown as () => void);
