describe('template spec', () => {
  it('passes', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)
    })
  })
})