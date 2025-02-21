describe('EconoFlow - project add Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.visit('/projects')

      cy.get('#add-item').click()

      cy.focused().should('have.attr', 'formControlName', 'name')
    })
  })

  it('should add a new project', () => {
    cy.intercept('GET', '**/projects*').as('getProjects')
    cy.intercept('POST', '**/projects*').as('postProjects')

    cy.fixture('projects').then((projects) => {
      var project = projects.testPersonalProject;

      cy.get('input[formControlName=name]').type(project.name)
      cy.get('[name="type"]').click()
      cy.get('mat-option').contains(project.type).then(option => {
        cy.wrap(option).contains(project.type);
        option[0].click();
      })

      cy.get('[name="type"]').contains(project.type)

      cy.get('button').contains('Create').click();

      cy.wait<ProjectReq, ProjectRes>('@postProjects').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201)

        const projectCreated = response?.body

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created successfully!');

        cy.wait<ProjectReq, ProjectRes[]>('@getProjects').then(response => {
          const exists = response.response?.body.some(item => item.id == projectCreated?.id)
          expect(exists).to.be.true
        })
      })
    })
  })
})
