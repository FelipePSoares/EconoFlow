describe('EconoFlow - expense item add Tests', () => {
  it('should add a new expense item', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.intercept('GET', '**/expenses/*').as('getExpense')
      cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;
        cy.fixture('categories').then((categories) => {
          var category = categories.defaultCategory;
          cy.fixture('expenses').then((expenses) => {
            var defaultExpense = expenses.defaultExpense;

            cy.fixture('expenseItems').then((expenseItems) => {
              var expenseItem = expenseItems.testSomeExpenseItem;
              cy.visit('/projects/' + project.id + '/categories/' + category.id + '/expenses/' + defaultExpense.id + '/add-expense-item')

              cy.wait('@getExpense')

              cy.get('input[formControlName=name]').type(expenseItem.name)
              cy.get('input[formControlName=amount]').type(expenseItem.amount)

              cy.get('button').contains('Create').click();
              cy.url().should('include', '/expenses/');

              cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
                expect(response?.statusCode).to.equal(200)

                cy.get("mat-snack-bar-container").should("be.visible").contains('Created successfully!')

                cy.wait<ExpenseReq, ExpenseRes>('@getExpense').then(({ request, response }) => {
                  const exists = response?.body.items.some(item => item.name == expenseItem.name && item.amount == expenseItem.amount/100)
                  expect(exists).to.be.true
                })
              })
            })
          })
        })
      })
    })
  })
})
