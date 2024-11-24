describe('EconoFlow - income list Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.intercept('PATCH', '**/incomes/*').as('patchIncomes')
      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;

        cy.visit('/projects/' + project.id + '/incomes')
      })
    })
  })

  it('should update name after success update', () => {
    const value = `name_${Math.random()}`;

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=name]').clear().type(`${value}{enter}`)

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
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

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      cy.get('.date').first().contains(`${today.toLocaleDateString('pt-PT')}`)
    })
  })

  it('should update amount after success update', () => {
    let value = Math.floor(Math.random() * 1000);

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      cy.get('.amount').first().contains(`${value}`)
    })
  })

  it('should update amount with decimal after success update', () => {
    let value = (Math.random() * 1000).toFixed(2);

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)

      cy.get('.amount').invoke('text').then((text) => {
        let isIncluded = text.includes(`${value }`);
        expect(isIncluded).to.equal(true);
      });
    })
  })
})
