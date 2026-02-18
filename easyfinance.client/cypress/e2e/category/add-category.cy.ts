describe('EconoFlow - category add Tests', () => {

  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;
      cy.login(user.username, user.password)

      cy.intercept('GET', '**/projects/*/year-summary/*').as('getProjects')
      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;

        cy.visitProtected('/projects/' + project.id)
        cy.wait<CategoryReq, CategoryRes[]>('@getProjects');
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

  it('should be possible view archived categories with expenses', () => {
    cy.intercept('GET', '**/projects/*/year-summary/*').as('getProjects')
    cy.intercept('GET', '**/categories*').as('getCategories')

    cy.fixture('projects').then((projects) => {
      cy.fixture('categories').then((categories) => {
        cy.fixture('expenses').then((expenses) => {
          cy.request('POST', 'api/Projects/' + projects.defaultProject.id + '/Categories', {
            name: categories.testArchivedCategory.name
          }).then((resp) => {
            expect(resp?.status).to.equal(201)

            const archivedCategory = resp.body as CategoryRes;
            cy.request('POST', 'api/Projects/' + projects.defaultProject.id + '/Categories/' + archivedCategory.id + '/Expenses', {
              date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split("T")[0],
              name: expenses.testSomeExpense.name,
              budget: expenses.testSomeExpense.budget,
              amount: expenses.testSomeExpense.amount
            }).then((resp) => {
              expect(resp?.status).to.equal(201)

              cy.request('PUT', 'api/Projects/' + projects.defaultProject.id + '/Categories/' + archivedCategory.id + '/Archive', {}).then((resp) => {
                expect(resp?.status).to.equal(204)
                  
                cy.visitProtected('/projects/' + projects.defaultProject.id)
                cy.wait('@getProjects')
                cy.wait('@getCategories')

                cy.wait<ProjectReq, ProjectRes>('@getProjects').then(({ request, response }) => {
                  cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
                    cy.log(JSON.stringify(response?.body))
                    cy.get('.card').should('not.have.class', 'archived');

                    cy.get('#previous').click()

                    cy.wait<CategoryReq, CategoryRes[]>('@getCategories').then(({ request, response }) => {
                      cy.log(JSON.stringify(response?.body))
                      const exists2 = response?.body.some(item => item.id == archivedCategory?.id)
                      expect(exists2).to.be.true
                      const category = response?.body.find(item => item.id == archivedCategory?.id);
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

  it('should show validation error when category name exceeds 100 characters', () => {
    cy.get('.btn-add').click();
    cy.get('app-list-categories .btn-add').click();

    // Type a name longer than 100 chars
    const longName = 'A'.repeat(120);
    cy.get('input[formControlName="name"]').type(longName);
    cy.get('input[formControlName="name"]').blur();
    cy.contains('exceeds the maximum allowed length').should('be.visible');
    cy.get('button[mat-raised-button]').contains('Create').parent('button').should('be.disabled');
  });
})
