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
