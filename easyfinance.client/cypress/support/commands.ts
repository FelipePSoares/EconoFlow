Cypress.Commands.add('login', (username, password) => {
  cy.session(
    username,
    () => {
      cy.intercept('POST', '/api/account/login').as('postAccount')
      cy.visit('/login')
      cy.get('input[formControlName=email]').type(username)
      cy.get('input[formControlName=password]').type(`${password}{enter}`, { log: false })
      cy.wait('@postAccount')
      cy.visit('/')
    },
    {
      validate: () => {
        expect(localStorage.getItem("token_data")).to.be.a("string");
      }
    }
  )
});

Cypress.Commands.add('register', (username, password) => {
  cy.session(
    username,
    () => {
      cy.intercept('GET', '/api/account/').as('getAccount')
      cy.intercept('POST', '/api/account/register').as('postAccount')

      cy.visit('/register')
      cy.get('input[formControlName=email]').type(username)
      cy.get('input[formControlName=password]').type(password)
      cy.get('input[formControlName=confirmPassword]').type(`${password}{enter}`, { force: true, log: false })
      cy.wait('@postAccount')

      cy.url().should('include', 'first-signin')

      cy.get('input[formControlName=firstName]').type('test')
      cy.get('input[formControlName=lastName]').type('test')
      cy.get('button').contains('Send').click();
      cy.wait('@getAccount')
      cy.visit('/')
    },
    {
      validate: () => {
        cy.login(username, password)
        cy.visit('/')
        cy.url().should('not.contain', 'login')
      }
    }
  )
});
