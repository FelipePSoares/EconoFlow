describe('EconoFlow - project add Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.window().then((win) => {
        win.sessionStorage.setItem("visited", "true");
      });

      cy.visit('/projects')
    })
  })

  it('should add a new project', () => {
    cy.intercept('GET', '**/projects*').as('getProjects')
    cy.intercept('POST', '**/projects*').as('postProjects')

    cy.fixture('projects').then((projects) => {
      var project = projects.testPersonalProject;

      cy.get('#add-item').click()

      cy.focused().should('have.attr', 'formControlName', 'name')

      cy.get('input[formControlName=name]').type(project.name)
      const preferredCurrencyInput = cy.get('mat-select[formcontrolname=preferredCurrency]');
      preferredCurrencyInput.click().get('mat-option').contains('EUR').click()

      cy.get('button').contains('Create').click();

      cy.wait<ProjectReq, ProjectRes>('@postProjects').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201)

        const projectCreated = response?.body

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created Successfully!');
      })
    })
  })
})
