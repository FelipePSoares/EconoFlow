describe('EconoFlow - category add Tests', () => {
  it('should add a new category', () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.intercept('GET', '**/categories*').as('getCategories')
      cy.intercept('POST', '**/categories*').as('postCategories')

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;
        cy.fixture('categories').then((categories) => {
          var category = categories.testGroceriesCategory;

          cy.visit('/projects/' + project.id + '/add-category')

          cy.get('#name').type(category.name)

          cy.get('button').contains('Create').click();

          cy.wait<CategoryReq, CategoryRes>('@postCategories').then(({ request, response }) => {
            expect(response?.statusCode).to.equal(201)

            const incomeCreated = response?.body

            cy.get("mat-snack-bar-container").should("be.visible").contains('Created successfully!')

            cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
              const exists = response?.body.some(item => item.id == incomeCreated?.id)
              expect(exists).to.be.true
            })
          })
        })
      })
    })
  })
})
