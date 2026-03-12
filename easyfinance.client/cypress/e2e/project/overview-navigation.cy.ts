describe('EconoFlow - project overview navigation', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;
      cy.login(user.username, user.password);
    });
  });

  it('should open expense overview from total expense card', () => {
    cy.fixture('projects').then((projects) => {
      cy.visit('/projects/' + projects.defaultProject.id);

      cy.get('[data-testid=overview-expense-card]').click();
      cy.url().should('include', '/projects/' + projects.defaultProject.id + '/expense-overview');
    });
  });

  it('should navigate back to project overview from expense overview', () => {
    cy.fixture('projects').then((projects) => {
      cy.visit('/projects/' + projects.defaultProject.id + '/expense-overview');

      cy.get('#previous').first().click();
      cy.url().should('include', '/projects/' + projects.defaultProject.id);
      cy.url().should('not.include', '/expense-overview');
    });
  });

  it('should open incomes from total income card', () => {
    cy.fixture('projects').then((projects) => {
      cy.visit('/projects/' + projects.defaultProject.id);

      cy.get('[data-testid=overview-income-card]').click();
      cy.url().should('include', '/projects/' + projects.defaultProject.id + '/incomes');
      cy.url().should('not.include', 'income-plans');
      cy.get('[data-testid=income-default-mode]').should('exist');
    });
  });

  it('should open income plans from saved/invested card', () => {
    cy.fixture('projects').then((projects) => {
      cy.visit('/projects/' + projects.defaultProject.id);

      cy.get('[data-testid=overview-saved-invested-card]').click();
      cy.url().should('include', '/projects/' + projects.defaultProject.id + '/income-plans');
      cy.get('[data-testid=income-plan-mode]').should('exist');
    });
  });
});
