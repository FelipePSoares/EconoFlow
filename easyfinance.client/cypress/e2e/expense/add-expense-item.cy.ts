describe('EconoFlow - expense item add Tests', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/expenses?*').as('getExpense')

    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        const project = projects.defaultProject;
        cy.fixture('categories').then((categories) => {
          const category = categories.defaultCategory;

          cy.visit('/projects/' + project.id + '/categories/' + category.id + '/expenses')

          cy.wait('@getExpense')

          cy.get('.btn-link').last().click()

          cy.get('button').contains('Add Item').click();

          cy.focused().should('have.attr', 'formControlName', 'name')
        })
      })
    })
  })

  it('should add a new expense item', () => {
    cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')

    cy.fixture('expenseItems').then((expenseItems) => {
      const expenseItem = expenseItems.testSomeExpenseItem;


      cy.get('input[formControlName=name]').type(expenseItem.name)
      cy.get('input[formControlName=amount]').type(expenseItem.amount)

      cy.get('button').contains('Create').click();

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created Successfully!')

        cy.wait<ExpenseReq, ExpenseRes[]>('@getExpense').then(({ request, response }) => {
          console.log('result:' + JSON.stringify(response))
          const exists = response?.body[response?.body.length -1].items.some(item => item.name == expenseItem.name && item.amount == expenseItem.amount / 100)
          expect(exists).to.be.true
        })
      })
    })
  })
})
