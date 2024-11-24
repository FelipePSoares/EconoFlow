describe('EconoFlow - expense item list Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')
      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;
        cy.fixture('categories').then((categories) => {
          var category = categories.defaultCategory;
          cy.fixture('expenses').then((expenses) => {
            var defaultExpense = expenses.defaultExpense;

            cy.visit('/projects/' + project.id + '/categories/' + category.id + '/expenses/' + defaultExpense.id)
          })
        })
      })
    })
  })

  it('should update name after success update', () => {
    const value = `name_${Math.random()}`;

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=name]').clear().type(`${value}{enter}`)

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      cy.get('.name').first().contains(`${value}`)
    })
  })

  it('should update date after success update', () => {
    const today = new Date()
    today.setDate(Math.floor(Math.random() * today.getDate()) + 1)
    const todayFormated = String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth() + 1).padStart(2, '0') + '/' + today.getFullYear();

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=date]').clear().type(`${todayFormated}{enter}`)

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      cy.get('.info').first().contains(`${today.toLocaleDateString('pt-PT')}`)
    })
  })

  it('should show error after failed update', () => {
    const today = new Date()
    today.setMonth(today.getMonth() + 1);
    const todayFormated = String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth() + 1).padStart(2, '0') + '/' + today.getFullYear();

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=date]').clear().type(`${todayFormated}{enter}`)

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(400)
      //cy.get('mat-error').should('have.text', 'You can\u0027t add future expense/income') activate when change the form to material
    })
  })

  it('should update amount after success update', () => {
    let value = Math.floor(Math.random() * 1000);

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      cy.get('.info').first().contains(`${value}`)
    })
  })
})
