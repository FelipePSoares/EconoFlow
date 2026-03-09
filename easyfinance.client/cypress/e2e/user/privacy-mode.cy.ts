describe('EconoFlow - privacy mode Tests', () => {
  const privacyContainerSelector = '[data-testid="authenticated-content"]';

  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;
      cy.login(user.username, user.password);
    });
  });

  it('should keep privacy mode enabled across authenticated project pages and reload', () => {
    cy.fixture('projects').then((projects) => {
      const projectId = projects.defaultProject.id;

      cy.visit('/user/account', {
        onBeforeLoad: (win) => {
          win.localStorage.removeItem('privacy-mode-enabled');
        }
      });

      cy.get('#privacyModeToggle button').should('have.attr', 'aria-checked', 'false');
      cy.get('#privacyModeToggle button').click();
      cy.get('#privacyModeToggle button').should('have.attr', 'aria-checked', 'true');
      cy.get(privacyContainerSelector).should('have.class', 'privacy-mode');

      cy.window().then((win) => {
        expect(win.localStorage.getItem('privacy-mode-enabled')).to.equal('true');
      });

      cy.visit('/privacy-policy');
      cy.get(privacyContainerSelector).should('not.have.class', 'privacy-mode');

      const authenticatedRoutes = [
        `/projects/${projectId}`,
        `/projects/${projectId}/overview/monthly`,
        `/projects/${projectId}/overview/annual`,
        `/projects/${projectId}/incomes`,
        `/projects/${projectId}/deductions`
      ];

      authenticatedRoutes.forEach((route) => {
        cy.visit(route);
        cy.get(privacyContainerSelector).should('have.class', 'privacy-mode');
      });

      cy.request('GET', `/api/projects/${projectId}/categories`).then((response) => {
        const firstCategory = response.body?.[0];
        expect(firstCategory?.id).to.be.a('string');

        cy.visit(`/projects/${projectId}/categories/${firstCategory.id}/expenses`);
        cy.get(privacyContainerSelector).should('have.class', 'privacy-mode');

        cy.reload();
        cy.get(privacyContainerSelector).should('have.class', 'privacy-mode');

        cy.visit('/user/account');
        cy.get('#privacyModeToggle button').should('have.attr', 'aria-checked', 'true');
        cy.get('#privacyModeToggle button').click();
        cy.get('#privacyModeToggle button').should('have.attr', 'aria-checked', 'false');
        cy.get(privacyContainerSelector).should('not.have.class', 'privacy-mode');

        cy.window().then((win) => {
          expect(win.localStorage.getItem('privacy-mode-enabled')).to.equal('false');
        });
      });
    });
  });
});
