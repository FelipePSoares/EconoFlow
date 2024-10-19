describe('EconoFlow - Login Tests', () => {
  it('should login with user credentials', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)
    })
  })
})