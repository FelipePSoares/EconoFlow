describe('EconoFlow - user detail Tests', () => {
  let currenciesAvailable: string[];

  it('Should edit user infos', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)
      cy.visit('/user')

      cy.intercept('GET', '**/account*').as('getAccount')
      cy.intercept('PUT', '**/account*').as('putAccount')
      cy.intercept('POST', '/api/account/manage/info').as('postAccount')

      const firstNameInput = cy.get('input[formcontrolname=firstName]');
      const firstNameValue = 'firstName' + Math.floor(Math.random() * 1000).toString();

      const lastNameInput = cy.get('input[formcontrolname=lastName]');
      const lastNameValue = 'lastName' + Math.floor(Math.random() * 1000).toString();

      const emailInput = cy.get('input[formcontrolname=email]');
      const emailValue = 'email' + Math.floor(Math.random() * 1000).toString() + '@test.com';

      firstNameInput.clear().type(firstNameValue);
      lastNameInput.clear().type(lastNameValue);
      emailInput.clear().type(emailValue);
      cy.get('button').contains('Save').click();

      cy.wait<UserReq, UserRes>('@putAccount').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
      })

      cy.wait<UserReq, UserRes>('@postAccount').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
      })

      cy.wait<UserReq, UserRes>('@getAccount').then(({ request, response }) => {
        try {
          expect(response?.body.firstName).to.equal(firstNameValue);
          expect(response?.body.lastName).to.equal(lastNameValue);
        } catch {
          cy.wait<UserReq, UserRes>('@getAccount').then(({ request, response }) => {
            expect(response?.body.firstName).to.equal(firstNameValue);
            expect(response?.body.lastName).to.equal(lastNameValue);
          })
        }
      })
    })
  })

  it('should be possible delete user', () => {
    cy.fixture('users').then((users) => {
      const user = users.userToDelete;

      cy.intercept('DELETE', '**/account*').as('deleteAccount')
      cy.visit('/logout')
      cy.register(user.username, user.password)
      cy.visit('/user')
      cy.get('.btn').contains('Delete Account').click();
      cy.wait('@deleteAccount').then((interception) => {
        expect(interception?.response?.statusCode).to.equal(202)
        cy.get('app-confirm-dialog button').contains('Delete').click();

        cy.wait('@deleteAccount').then((interception2) => {
          expect(interception2?.response?.statusCode).to.equal(200)
        })
      })
    })
  })

  it('can\'t delete user', () => {
    cy.fixture('users').then((users) => {
      const user = users.userToNotDelete;

      cy.intercept('DELETE', '**/account*').as('deleteAccount')

      cy.visit('/logout')
      cy.register(user.username, user.password)
      cy.visit('/user')
      cy.get('.btn').contains('Delete Account').click();
      cy.wait('@deleteAccount').then((interception) => {
        expect(interception?.response?.statusCode).to.equal(202)
        cy.get('app-confirm-dialog button').contains('Cancel').click();

        cy.visit('/')
        cy.url().should('not.contain', 'login')
      })
    })
  })
})
