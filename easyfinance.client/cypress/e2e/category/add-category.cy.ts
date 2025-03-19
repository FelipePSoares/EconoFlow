describe('EconoFlow - category add Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;

        cy.visit('/projects/' + project.id)

        cy.get('.btn-add').click();

        cy.focused().should('have.attr', 'formControlName', 'name')
      })
    })
  })

  it('should add a new category', () => {
    cy.intercept('GET', '**/categories*').as('getCategories')
    cy.intercept('POST', '**/categories*').as('postCategories')

    cy.fixture('categories').then((categories) => {
      var category = categories.testGroceriesCategory;

      cy.get('input[formControlName=name]').type(category.name)

      cy.get('button').contains('Create').click();

      cy.wait<CategoryReq, CategoryRes>('@postCategories').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201)

        const incomeCreated = response?.body

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created successfully!')

        cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(response => {
          const exists = response.response?.body.some(item => item.id == incomeCreated?.id)
          expect(exists).to.be.true
        })

      })
    })
  })
})
