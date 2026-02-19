describe('EconoFlow - project detail Tests', () => {

  beforeEach(() => {
    attempts = 0;

    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)
    })
  });

  it('should clone budget from previous month', () => {
    cy.intercept('GET', '**/categories*').as('getCategories')

    cy.fixture('projects').then((projects) => {
      cy.visit('/projects/' + projects.defaultProject.id)

      findNextMonthWithoutBudget();

      cy.get('.btn-primary').contains('Clone Previous Budget').click();

      cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
        const exists = response?.body.some(category => category.expenses.some(expense => expense.budget > 0))
        expect(exists).to.be.true
      })
    })
  })

  it('copy budget button should not appears when previous month is empty', () => {
    cy.intercept('GET', '**/categories*').as('getCategories')

    cy.fixture('projects').then((projects) => {
      cy.visit('/projects/' + projects.defaultProject.id)

      findNextMonthWithoutBudget();
      cy.get('#next').click()

      cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
        cy.get('.btn-primary').contains('Clone Previous Budget').should('not.exist');
      });
    })
  })
})

let attempts = 0;
const maxAttempts = 5;

function findNextMonthWithoutBudget() {
  return cy.wait('@getCategories').then(() => {

    cy.wait(300)

    return cy.get('body').then(($body) => {
      const cloneBtnExists =
        $body.find('.btn-primary:contains("Clone Previous Budget")').length > 0;

      if (!cloneBtnExists) {
        if (attempts >= maxAttempts) {
          return cy
            .wrap(null, { log: false })
            .should(() => {
              throw new Error('A month without budget was not found within maxAttempts.');
            });
        }
        attempts++;
        cy.get('#next').click();
        return findNextMonthWithoutBudget();
      }

      cy.log(`Found month without budget after ${attempts} attempts`);
      return;
    });
  });
}
