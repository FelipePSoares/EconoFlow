import { attempt } from "cypress/types/bluebird";

describe('EconoFlow - user detail Tests', () => {
  it('should be possible cancel modify password', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.visit('/user')
      cy.get('.btn').contains('Modify Password').click();
      cy.get('.btn').contains('Cancel').click();
      cy.get('.btn').contains('Modify Password').should('exist')
    })
  })
})
