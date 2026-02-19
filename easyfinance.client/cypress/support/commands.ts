Cypress.Commands.add('login', (username, password) => {
  Cypress.env('authCredentials', { username, password });

  cy.session([username, password], () => {
    cy.request('POST', '/api/AccessControl/login', {
      email: username,
      password
    })
  }, {
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
        cy.get('button').contains('Send').click();
        cy.wait('@getAccount')
      })
    },
    {
      validate: () => {
        cy.login(username, password)
        cy.getCookie('AuthToken').should('exist')
      }
    }
  )
});
