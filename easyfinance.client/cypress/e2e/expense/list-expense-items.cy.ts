describe('EconoFlow - expense item list Tests', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/expenses?*').as('getExpense')

    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')
      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        const project = projects.defaultProject;
        cy.fixture('categories').then((categories) => {
          cy.fixture('expenses').then((expenses) => {
            const defaultExpense = expenses.defaultExpense;
            const category = categories.defaultCategory;

            cy.visitProtected('/projects/' + project.id + '/categories/' + category.id + '/expenses')

            cy.wait<ExpenseReq, ExpenseRes[]>('@getExpense').then(({ request, response }) => {
              console.log(response?.body);
              const index = response?.body.findIndex(element => element.name === defaultExpense.name);

              cy.get('.btn-link').eq(index).click()
            })
          })
        })
      })
    })
  })

  it('should update name after success update', () => {
    const value = `name_${Math.random()}`;

    cy.get('button[name=edit-sub]').last().click()
    cy.get('input[formControlName=name]').clear().type(`${value}{enter}`)

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      cy.get('.name-sub').contains(`${value}`)
    })
  })

  it('should update date after success update', () => {
    const today = new Date()
    today.setDate(Math.floor(Math.random() * today.getDate()) + 1)
    let formattedDate = ''

    cy.get('button[name=edit-sub]').last().click()
    cy.window().then((win) => {
      const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
      formattedDate = today.toLocaleDateString(locale)
      cy.get('input[formControlName=date]').clear().type(`${formattedDate}{enter}`)
    })

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      cy.get('.date-sub').contains(formattedDate)
    })
  })

  it('should show error after failed update', () => {
    const today = new Date()
    today.setMonth(today.getMonth() + 1);
    let formattedDate = ''

    cy.get('button[name=edit-sub]').first().click()
    cy.window().then((win) => {
      const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
      formattedDate = today.toLocaleDateString(locale)
      cy.get('input[formControlName=date]').clear().type(`${formattedDate}{enter}`)
    })

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(400)
      cy.get('mat-error').should('have.text', 'Can\u0027t add an expense item with different year or month from expense')
    })
  })

  it('should update amount after success update', () => {
    const value = Math.floor(Math.random() * 1000);
    const expectedAmount = (value / 100).toFixed(2);
    const expectedAmountWithComma = expectedAmount.replace('.', ',');

    cy.get('button[name=edit-sub]').first().click()
    cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      cy.get('.amount-sub').invoke('text').then((text) => {
        const hasExpectedAmount = text.includes(expectedAmount) || text.includes(expectedAmountWithComma);
        expect(hasExpectedAmount).to.equal(true);
      });
    })
  })
})
