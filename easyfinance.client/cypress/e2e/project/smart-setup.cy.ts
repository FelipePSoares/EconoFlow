describe('EconoFlow - Smart Setup Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.window().then((win) => {
        win.sessionStorage.setItem("visited", "true");
      });

      cy.visit('/projects')

      cy.intercept('GET', '**/projects*').as('getProjects')
      cy.intercept('POST', '**/projects*').as('postProjects')

      cy.get('#add-item').click()

      cy.focused().should('have.attr', 'formControlName', 'name')

      const name = `name_${Math.random()}`;

      cy.get('input[formControlName=name]').type(name)
      const preferredCurrencyInput = cy.get('mat-select[formcontrolname=preferredCurrency]');
      preferredCurrencyInput.click().get('mat-option').contains('EUR').click()

      cy.get('button').contains('Create').click();

      cy.wait<ProjectReq, ProjectRes>('@postProjects').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201)

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created Successfully!');
      })
    })
  })

  it('should setup using smart setup and all expense should be created', () => {
    cy.get('#annualIncome').type('60000')
    cy.get('button').contains('Save').click()

    cy.get('.slider-container .card-small-text').should('not.contain.text', 'set a budget')
  })
})
