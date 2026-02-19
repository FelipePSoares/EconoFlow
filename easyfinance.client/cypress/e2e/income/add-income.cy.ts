describe('EconoFlow - income add Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;
        
        cy.visitProtected('/projects/' + project.id + '/incomes')

        cy.get('.btn-add').click();
      })
    })
  })

  it('should appear name validation error', () => {
    cy.get('input[formControlName=name]').blur()
    cy.get('mat-error').should('have.text', ' This field is required. ')
  })

  it('should add a new income', () => {
    cy.intercept('POST', '**/incomes*').as('postIncomes')

    cy.fixture('incomes').then((incomes) => {
      var income = incomes.testWageIncome;

      cy.get('input[formControlName=name]').type(income.name)
      cy.get('input[formControlName=amount]').type(income.amount)

      cy.get('button[type=submit]').click();

      cy.wait<IncomeReq, IncomeRes>('@postIncomes').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201)

        const incomeCreated = response?.body

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created Successfully!');
      })
    })
  })
})
