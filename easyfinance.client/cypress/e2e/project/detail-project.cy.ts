import { attempt } from "cypress/types/bluebird";

describe('EconoFlow - project detail Tests', () => {
  it('should copy budget from previous month', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.intercept('GET', '**/categories*').as('getCategories')
      
      cy.visit('/')
      checkAndClick();
      cy.get('.btn-primary').contains('Copy Previous Budget').click();
      cy.get('.budget').should('include.text', '1.150,00')
    })
  })
})

let attempts = 0;
const maxAttempts = 5;

function checkAndClick() {
  cy.wait('@getCategories').then(interception => {
    cy.get(".budget").then($el => {
      cy.log($el.text())
      var hasValue = $el.text().includes('1.150,00');

      cy.log(hasValue.toString())
      if (hasValue && attempts < maxAttempts) {
        attempts++;
        cy.get('#next').click()
        checkAndClick();
      } else if (hasValue)  {
        // If the maximum attempts are reached and the text still isn't found, fail the test
        throw new Error('Text not found after maximum attempts.');
      }
    })
  });
}
