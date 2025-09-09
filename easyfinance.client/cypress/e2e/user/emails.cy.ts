describe('EconoFlow - user emails Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.visit('/user/emails')
    })
  })

  it('Should edit user email', () => {
    cy.intercept('GET', '**/account*').as('getAccount')
    cy.intercept('PUT', '**/account*').as('putAccount')
    cy.intercept('POST', '/api/account/manage/info').as('postAccount')

    const emailInput = cy.get('input[formcontrolname=email]');
    const emailValue = 'email' + Math.floor(Math.random() * 1000).toString() + '@test.com';

    emailInput.type(emailValue, { force: true });
    cy.get('button').contains('Update').click();

    cy.wait<UserReq, UserRes>('@postAccount').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
    })
  })
})
