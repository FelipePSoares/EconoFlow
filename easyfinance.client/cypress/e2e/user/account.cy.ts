describe('EconoFlow - user account Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.visit('/user')
    })
  })

  it('Should edit basic user infos', () => {
    cy.intercept('GET', '**/account*').as('getAccount')
    cy.intercept('PATCH', '**/account*').as('patchAccount')

    cy.wait<UserReq, UserRes>('@getAccount')

    const firstNameInput = cy.get('input[formcontrolname=firstName]');
    const lastNameInput = cy.get('input[formcontrolname=lastName]');

    const firstNameValue = 'firstName' + Math.floor(Math.random() * 1000).toString();
    firstNameInput.clear().type(firstNameValue);
    const lastNameValue = 'lastName' + Math.floor(Math.random() * 1000).toString();
    lastNameInput.clear().type(lastNameValue);

    cy.wait(810);

    cy.wait<UserReq, UserRes>('@patchAccount').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)

      expect(response?.body.firstName).to.equal(firstNameValue);
      expect(response?.body.lastName).to.equal(lastNameValue);
    })
  })

  it('Should edit user email notification preference', () => {
    cy.intercept('GET', '**/account*').as('getAccount')
    cy.intercept('PATCH', '**/account*').as('patchAccount')

    cy.wait<UserReq, UserRes>('@getAccount').then(({ request, response }) => {
      cy.log(response?.body.notificationChannels)

      var currentEmailToggleValue = response?.body.notificationChannels.some(n => n == "Email");

      cy.get('#emailNotificationToggle button').click();

      cy.wait<UserReq, UserRes>('@patchAccount').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        cy.log(response?.body.notificationChannels)

        var newEmailToggleValue = response?.body.notificationChannels.some(n => n == "Email");

        expect(newEmailToggleValue).to.equal(!currentEmailToggleValue);
      })
    })
  })

  it('Should edit user push notification preference', () => {
    cy.intercept('GET', '**/account*').as('getAccount')
    cy.intercept('PATCH', '**/account*').as('patchAccount')

    cy.wait<UserReq, UserRes>('@getAccount').then(({ request, response }) => {
      cy.log(response?.body.notificationChannels)

      var currentEmailToggleValue = response?.body.notificationChannels.some(n => n == "Push");

      cy.get('#pushNotificationToggle button').click();

      cy.wait<UserReq, UserRes>('@patchAccount').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        cy.log(response?.body.notificationChannels)

        var newEmailToggleValue = response?.body.notificationChannels.some(n => n == "Push");
        expect(newEmailToggleValue).to.equal(!currentEmailToggleValue);
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
