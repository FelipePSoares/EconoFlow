describe('EconoFlow - expense list Tests', () => {
    beforeEach(() => {
      cy.fixture('users').then((users) => {
        const user = users.testUser;
  
        cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')
        cy.login(user.username, user.password)

        cy.fixture('projects').then((projects) => {
            var project = projects.defaultProject;
            cy.fixture('categories').then((categories) => {
              var category = categories.defaultCategory;
          
              cy.visitProtected('/projects/' + project.id + '/categories/' + category.id + '/expenses')
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
      let formattedDate = ''

      cy.get('button[name=edit]').first().click()
      cy.window().then((win) => {
        const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
        formattedDate = today.toLocaleDateString(locale)
        cy.get('input[formControlName=date]').clear().type(`${formattedDate}{enter}`)
      })

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        cy.get('.date').first().contains(formattedDate)
      })
    })
  
    it('should show error after failed update', () => {
      const today = new Date()
      today.setMonth(today.getMonth() + 1);
      let formattedDate = ''

      cy.get('button[name=edit]').first().click()
      cy.window().then((win) => {
        const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
        formattedDate = today.toLocaleDateString(locale)
        cy.get('input[formControlName=date]').clear().type(`${formattedDate}{enter}`)
      })

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(400)
        cy.get('mat-error').should('have.text', 'A future expense can\u0027t have a amount')
      })
    })
  
    it('should update budget after success update', () => {
      let value = Math.floor(Math.random() * 1000);

      cy.get('button[name=edit]').first().click()
      cy.get('input[formControlName=budget]').clear().type(`${value}{enter}`)
      
      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        cy.get('.budget').first().contains(`${value}`)
      })
    })
  
    it('should update amount after success update', () => {
      let value = Math.floor(Math.random() * 1000);
      const expectedAmount = (value / 100).toFixed(2);
      const expectedAmountWithComma = expectedAmount.replace('.', ',');

      cy.get('button[name=edit]').first().click()
      cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)
      
      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        cy.get('.progress-bar').first().invoke('text').then((text) => {
          const hasExpectedAmount = text.includes(expectedAmount) || text.includes(expectedAmountWithComma);
          expect(hasExpectedAmount).to.equal(true);
        });
      })
    })
})
