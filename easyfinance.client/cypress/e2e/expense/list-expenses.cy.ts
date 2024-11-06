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
          
              cy.visit('/projects/' + project.id + '/categories/' + category.id + '/expenses')
            })
        })
      })
    })
  
    it('should update name after success update', () => {
      const value = `name_${Math.random()}`;

      cy.get('button[name=edit]').first().click()
      cy.get('#name').clear().type(`${value}{enter}`)

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        cy.get('.name').first().contains(`${value}`)
      })
    })
  
    it('should update date after success update', () => {
      const today = new Date()
      today.setDate(Math.floor(Math.random() * today.getDate()) + 1)
      const todayFormated = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

      cy.get('button[name=edit]').first().click()
      cy.get('#date').clear().type(`${todayFormated}{enter}`)

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        cy.get('.date').first().contains(`${today.toLocaleDateString('pt-PT')}`)
      })
    })
  
    it('should update amount after success update', () => {
      let value = Math.floor(Math.random() * 1000);

      cy.get('button[name=edit]').first().click()
      cy.get('#amount').clear().type(`${value}{enter}`)
      
      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        cy.get('.progress-bar').first().contains(`${value}`)
      })
    })
  
    it('should update budget after success update', () => {
      let value = Math.floor(Math.random() * 1000);

      cy.get('button[name=edit]').first().click()
      cy.get('#budget').clear().type(`${value}{enter}`)
      
      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        cy.get('.budget').first().contains(`${value}`)
      })
    })
})
  