describe('EconoFlow - Register Tests', () => {
    it('Should register user', () => {
      cy.fixture('users').then((users) => {
        const user = users.testUser;
        const email = Math.floor(Math.random() * 1000).toString() + user.username;

        cy.intercept('PUT', '**/account*').as('putAccount')

        cy.register(email, user.password)
        
        cy.visit('/')

        cy.get('input[formControlName=firstName]').type('Test')
        cy.get('input[formControlName=lastName]').type(`Test{enter}`)

        cy.wait<UserReq, UserRes>('@putAccount').then(({ request, response }) => {
          expect(response?.statusCode).to.equal(200)
        })
      })
    })
  })