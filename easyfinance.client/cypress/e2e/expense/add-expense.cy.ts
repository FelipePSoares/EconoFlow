describe('EconoFlow - expense add Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;
        cy.fixture('categories').then((categories) => {
          var category = categories.defaultCategory;

          cy.visitProtected('/projects/' + project.id + '/categories/' + category.id + '/expenses')

          cy.get('.btn-add').click();
        })
      })
    })
  })

  it('should add a new expense', () => {
    cy.intercept('POST', '**/expenses*').as('postExpenses')

    cy.fixture('expenses').then((expenses) => {
      var expense = expenses.testSomeExpense;

      cy.get('input[formControlName=name]').type(expense.name)
      cy.get('input[formControlName=budget]').type(expense.budget)
      cy.get('input[formControlName=amount]').type(expense.amount)

      cy.get('button[type=submit]').click();

      cy.wait<ExpenseReq, ExpenseRes>('@postExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201)

        const expenseCreated = response?.body

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created Successfully!')
      })
    })
  })
})
