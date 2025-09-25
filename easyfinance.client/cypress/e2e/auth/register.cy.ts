describe('EconoFlow - Register Tests', () => {
    it('Should register user', () => {
      cy.fixture('users').then((users) => {
        const user = users.testUser;
        const email = Math.floor(Math.random() * 1000).toString() + user.username;

        cy.intercept('GET', '/api/AccessControl/').as('getAccount')
        cy.intercept('POST', '/api/AccessControl/register').as('postAccount')

        cy.visit('/register')
        cy.get('input[formControlName=email]').type(email)
        cy.get('input[formControlName=password]').type(user.password)
        cy.get('input[formControlName=confirmPassword]').type(`${user.password}{enter}`, { force: true, log: false })
        cy.wait('@postAccount')

        cy.url().should('include', 'first-signin')

        cy.get('input[formControlName=firstName]').type('test')
        cy.get('input[formControlName=lastName]').type('test')
        cy.get('button').contains('Send').click();
        cy.wait('@getAccount')
        cy.url().should('not.contain', 'login')
      })
    })
  })
