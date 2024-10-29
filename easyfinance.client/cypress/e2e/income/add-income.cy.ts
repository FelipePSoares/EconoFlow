describe('EconoFlow - income add Tests', () => {
  it('should add a new income', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.intercept('GET', '**/incomes*').as('getIncomes')
      cy.intercept('POST', '**/incomes*').as('postIncomes')

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;
        cy.fixture('incomes').then((incomes) => {
            var income = incomes.testWageIncome;

            cy.visit('/projects/' + project.id + '/add-income')
            
            cy.get('#name').type(income.name)
            cy.get('#amount').type(income.amount)
            
            cy.get('button').contains('Create').click();

            cy.wait<IncomeReq, IncomeRes>('@postIncomes').then(({ request, response }) => {
                expect(response?.statusCode).to.equal(201)

                const incomeCreated = response?.body
                cy.wait<IncomeReq, IncomeRes[]>('@getIncomes').then(({ request, response }) => {
                    const exists = response?.body.some(item => item.id == incomeCreated?.id)
                    expect(exists).to.be.true
                })
            })
        })
      })
    })
  })
})