describe('EconoFlow - user detail Tests', () => {
  let currenciesAvailable: string[];

  beforeEach(() => {
    cy.fixture('users').then((users) => {
      currenciesAvailable = users.currencies;

      const user = users.testUser;

      cy.login(user.username, user.password)
    })
  })

  it('Should edit user infos', () => {
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

    const preferredCurrencyInput = cy.get('mat-select[formcontrolname=preferredCurrency]');
    const preferredCurrencyValue = currenciesAvailable[Math.floor(Math.random() * currenciesAvailable.length)];

    cy.get('.btn').contains('Edit').click();

    firstNameInput.clear().type(firstNameValue);
    lastNameInput.clear().type(lastNameValue);
    emailInput.clear().type(emailValue);
    preferredCurrencyInput.click().get('mat-option').contains(preferredCurrencyValue).click()

    cy.get('button').contains('Save').click();

    cy.wait<UserReq, UserRes>('@putAccount').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
    })
    cy.wait<UserReq, UserRes>('@postAccount').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
    })
    cy.wait<UserReq, UserRes>('@getAccount').then(({ request, response }) => {
      expect(response?.body.firstName).to.equal(firstNameValue);
      expect(response?.body.lastName).to.equal(lastNameValue);
      expect(response?.body.preferredCurrency).to.equal(preferredCurrencyValue);
    })
  })

  it('should be possible cancel modify password', () => {
    cy.visit('/user')
    cy.get('.btn').contains('Modify Password').click();
    cy.get('.btn').contains('Cancel').click();
    cy.get('.btn').contains('Modify Password').should('exist')
  })
})
