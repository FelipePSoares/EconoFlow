describe('EconoFlow - Register Tests', () => {
    it('Should register user', () => {
      cy.fixture('users').then((users) => {
        const user = users.testUser;
        const email = Math.floor(Math.random() * 1000).toString() + user.username;

        cy.register(email, user.password)
      })
    })
  })
