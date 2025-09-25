describe('EconoFlow - category add Tests', () => {

  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;
      cy.login(user.username, user.password)

      cy.intercept('GET', '**/categories*').as('getCategories')
      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;

        cy.visit('/projects/' + project.id)
        cy.wait<CategoryReq, CategoryRes[]>('@getCategories');
      })
    })
  })

  it('should add a new category', () => {
    cy.intercept('POST', '**/categories*').as('postCategories')
    
    cy.fixture('categories').then((categories) => {
      cy.get('.btn-add').click();
      cy.get('app-list-categories .btn-add').click();

      cy.focused().should('have.attr', 'formControlName', 'name')

      var category = categories.testGroceriesCategory;

      cy.get('input[formControlName=name]').type(category.name)

      cy.intercept('GET', '**/categories*').as('getCategories')
      cy.get('button').contains('Create').click();

      cy.wait<CategoryReq, CategoryRes>('@postCategories').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201)

        const categoryCreated = response?.body

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created Successfully!')

        cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
          const exists = response?.body.some(item => item.id == categoryCreated?.id)
          expect(exists).to.be.true
        })

      })
    })
  })

  it.only('should be possible view archived categories with expenses', () => {
    cy.intercept('GET', '**/projects/*/year-summary/*').as('getProjects')
    cy.intercept('POST', '**/categories*').as('postCategories')
    cy.intercept('PUT', '**/categories/**').as('putCategories')
    cy.intercept('GET', '**/expenses*').as('getExpenses')
    cy.intercept('POST', '**/expenses*').as('postExpenses')

    cy.get('#previous').click()

    cy.fixture('projects').then((projects) => {
      cy.fixture('categories').then((categories) => {
        cy.fixture('expenses').then((expenses) => {
          cy.wait<ProjectReq, ProjectRes>('@getProjects').then(({ request, response }) => {

            cy.get('.btn-add').click();
            cy.get('app-list-categories .btn-add').click();

            var category = categories.testArchivedCategory;

            cy.get('input[formControlName=name]').type(category.name)
            cy.get('button').contains('Create').click()

            cy.wait<CategoryReq, CategoryRes>('@postCategories').then(({ request, response }) => {
              expect(response?.statusCode).to.equal(201)

              const categoryCreated = response?.body
              cy.visit('/projects/' + projects.defaultProject.id + '/categories/' + categoryCreated?.id + '/expenses')

              cy.get('.btn-add').click();

              var expense = expenses.testSomeExpense;

              cy.get('input[formControlName=name]').type(expense.name)
              cy.get('input[formControlName=budget]').type(expense.budget)
              cy.get('input[formControlName=amount]').type(expense.amount)

              cy.get('button').contains('Create').click();

              cy.wait<ExpenseReq, ExpenseRes>('@postExpenses').then(({ request, response }) => {
                expect(response?.statusCode).to.equal(201)

                cy.visit('/projects/' + projects.defaultProject.id)

                cy.wait<ProjectReq, ProjectRes>('@getProjects')

                cy.get('#next').click()

                cy.get('.btn-add').click()
                cy.get('.btn-outline-danger').last().click()
                cy.get('button').contains('Archive').click()

                cy.wait<CategoryReq, CategoryRes[]>('@putCategories').then(({ request, response }) => {
                  expect(response?.statusCode).to.equal(204)

                  cy.get('button').contains('close').click()
                  cy.intercept('GET', '**/categories*').as('getCategories')
                  cy.wait<CategoryReq, CategoryRes[]>('@getCategories')
                  cy.wait<CategoryReq, CategoryRes[]>('@getCategories')

                  cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
                    const exists = response?.body.some(item => item.id == categoryCreated?.id)
                    expect(exists).to.be.false
                    cy.get('.card').should('not.have.class', 'archived');

                    cy.get('#previous').click()
                    cy.wait<CategoryReq, CategoryRes[]>('@getCategories')

                    cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
                      cy.log(JSON.stringify(response?.body))
                      const exists2 = response?.body.some(item => item.id == categoryCreated?.id)
                      expect(exists2).to.be.true
                      const category = response?.body.find(item => item.id == categoryCreated?.id);
                      expect(category?.isArchived).to.be.true
                      cy.get('.card').should('have.class', 'archived');
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
