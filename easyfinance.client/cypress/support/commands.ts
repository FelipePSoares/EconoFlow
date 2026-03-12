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
  cy.session(
    username,
    () => {
      cy.intercept('PATCH', '/api/AccessControl/').as('patchAccount')

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

        cy.wait('@patchAccount').then((interception) => {
          expect(interception?.response?.statusCode).to.equal(200)
        })

        cy.url().should('include', '/projects')
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
