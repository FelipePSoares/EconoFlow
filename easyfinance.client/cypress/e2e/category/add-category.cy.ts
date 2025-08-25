describe('EconoFlow - category add Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;

        cy.visit('/projects/' + project.id)
      })
    })
  })

  it('should add a new category', () => {
    cy.intercept('GET', '**/categories*').as('getCategories')
    cy.intercept('POST', '**/categories*').as('postCategories')
    cy.wait<CategoryReq, CategoryRes[]>('@getCategories');

    cy.fixture('categories').then((categories) => {
      cy.get('.btn-add').click();
      cy.wait<CategoryReq, CategoryRes[]>('@getCategories');
      cy.get('app-list-categories .btn-add').click();

      cy.focused().should('have.attr', 'formControlName', 'name')

      var category = categories.testGroceriesCategory;

      cy.get('input[formControlName=name]').type(category.name)

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

  it('should be possible view archived categories with expenses', () => {
    cy.intercept('GET', '**/categories*').as('getCategories')
    cy.intercept('POST', '**/categories*').as('postCategories')
    cy.intercept('PUT', '**/categories/**').as('putCategories')
    cy.intercept('GET', '**/expenses*').as('getExpenses')
    cy.intercept('POST', '**/expenses*').as('postExpenses')

    cy.get('#previous').click()

    cy.wait<CategoryReq, CategoryRes[]>('@getCategories')

    cy.fixture('projects').then((projects) => {
      cy.fixture('categories').then((categories) => {
        cy.fixture('expenses').then((expenses) => {
          cy.get('.btn-add').click();
          cy.wait<CategoryReq, CategoryRes[]>('@getCategories')
          cy.get('app-list-categories .btn-add').click();

          var category = categories.testArchivedCategory;

          cy.get('input[formControlName=name]').type(category.name)
          cy.get('button').contains('Create').click()

          cy.wait<CategoryReq, CategoryRes>('@postCategories').then(({ request, response }) => {
            expect(response?.statusCode).to.equal(201)

            const categoryCreated = response?.body
            cy.wait<CategoryReq, CategoryRes[]>('@getCategories')
            cy.wait<CategoryReq, CategoryRes[]>('@getCategories')
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
              cy.wait<CategoryReq, CategoryRes[]>('@getCategories')

              cy.get('#next').click()
              cy.wait<CategoryReq, CategoryRes[]>('@getCategories')

              cy.get('.btn-add').click()
              cy.wait<CategoryReq, CategoryRes[]>('@getCategories')
              cy.get('.btn-outline-danger').last().click()
              cy.get('button').contains('Archive').click()

              cy.wait<CategoryReq, CategoryRes[]>('@putCategories').then(({ request, response }) => {
                expect(response?.statusCode).to.equal(204)
                cy.wait<CategoryReq, CategoryRes[]>('@getCategories')

                cy.get('button').contains('close').click()
                cy.wait<CategoryReq, CategoryRes[]>('@getCategories')

                cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
                  const exists = response?.body.some(item => item.id == categoryCreated?.id)
                  expect(exists).to.be.false

                  cy.get('#previous').click()

                  cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
                    cy.log('categoryId: ' + categoryCreated?.id)
                    const exists2 = response?.body.some(item => item.id == categoryCreated?.id)
                    expect(exists2).to.be.true
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
