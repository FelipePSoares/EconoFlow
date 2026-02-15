describe('EconoFlow - Login Tests', () => {
  it('should login with user credentials', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.intercept('POST', '/api/AccessControl/login').as('postAccount')
      cy.intercept('GET', '/api/AccessControl/').as('getAccount')
      cy.intercept('GET', '/projects').as('getProjects')

      cy.visit('/login')
      cy.get('input[formControlName=email]').type(user.username)
      cy.get('input[formControlName=password]').type(`${user.password}{enter}`, { force: true, log: false })
      cy.wait('@postAccount')
      cy.getCookie('AuthToken').should('exist')
      cy.visitProtected('/projects')

      cy.wait<ProjectReq, ProjectRes>('@getAccount').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
      })
    })
  })
})
