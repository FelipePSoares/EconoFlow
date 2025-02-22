describe('EconoFlow - project detail Tests', () => {

  beforeEach(() => {
    attempts = 0;
  });

  it('should copy budget from previous month', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.intercept('GET', '**/categories*').as('getCategories')

      cy.fixture('projects').then((projects) => {
        cy.visit('/projects/' + projects.defaultProject.id)

        findNextMonthWithoutBudget();

        cy.get('.btn-primary').contains('Copy Previous Budget').click();

        cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
          const exists = response?.body.some(category => category.expenses.some(expense => expense.budget > 0))
          expect(exists).to.be.true
        })
      })
    })
  })

  it('copy budget button should not appears when previous month is empty', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.intercept('GET', '**/categories*').as('getCategories')

      cy.fixture('projects').then((projects) => {
        cy.visit('/projects/' + projects.defaultProject.id)

        findNextMonthWithoutBudget();
        cy.get('#next').click()

        cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
          cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
            cy.get('.btn-primary').should('not.exist');
          });
        });
      })
    })
  })
})

let attempts = 0;
const maxAttempts = 5;

function findNextMonthWithoutBudget() {
  cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
    var hasValue = response?.body[0].expenses.length || 0 > 0;

    cy.log(hasValue.toString())
    if (hasValue && attempts < maxAttempts) {
      attempts++;
      cy.get('#next').click()
      findNextMonthWithoutBudget();
    } else if (hasValue)  {
      // If the maximum attempts are reached and the text still isn't found, fail the test
      throw new Error('Text not found after maximum attempts.');
    }
  });
}
