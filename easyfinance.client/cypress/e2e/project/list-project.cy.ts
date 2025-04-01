describe('EconoFlow - List Projects Tests', () => {
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

  it('should edit the name of the project', () => {
    cy.intercept('GET', 'api/projects/').as('getProjects')

    cy.wait('@getProjects').then(({ request, response }) => {
      cy.get('.more').first().click()
      cy.get('.edit').first().click()
      cy.get('input[formControlName=name]').clear().type('Test Project II')
      cy.get('button').contains('Update').click()
      cy.get('h1').first().contains('Test Project II')
    });
  })
})
