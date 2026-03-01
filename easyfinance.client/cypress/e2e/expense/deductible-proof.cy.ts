describe('EconoFlow - deductible proof Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password);

      cy.fixture('projects').then((projects) => {
        const project = projects.defaultProject;
        cy.fixture('categories').then((categories) => {
          const category = categories.defaultCategory;
          cy.visit('/projects/' + project.id + '/categories/' + category.id + '/expenses');
        });
      });
    });
  });

  const attachDeductibleProofToFirstExpense = () => {
    const proofFileContent = Cypress.Buffer.from('%PDF-1.4 deductible proof');

    cy.get('button[name=edit]').first().click();
    cy.get('[data-testid="is-deductible-toggle"]').click();
    cy.get('[data-testid="deductible-proof-input"]').selectFile({
      contents: proofFileContent,
      fileName: 'deductible-proof.pdf',
      mimeType: 'application/pdf',
      lastModified: Date.now()
    });
    cy.get('button[type=submit]').click();
  };

  it('should upload deductible proof while editing expense and keep deductible checked', () => {
    cy.intercept('PATCH', '**/expenses/*').as('patchExpense');
    cy.intercept('POST', '**/expenses/*/attachments').as('uploadAttachment');

    attachDeductibleProofToFirstExpense();

    cy.wait('@patchExpense').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      const hasDeductiblePatch = (request.body as { path: string; value: boolean }[])
        .some(operation => operation.path?.toLowerCase() === '/isdeductible' && operation.value === true);
      expect(hasDeductiblePatch).to.equal(true);
    });

    cy.wait('@uploadAttachment').then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
    });

    cy.get('button[name=edit]').first().click();
    cy.get('[data-testid="is-deductible-toggle"] input').should('be.checked');
    cy.get('[data-testid="deductible-proof-existing"]').should('be.visible');
  });

  it('should delete deductible proof attachment', () => {
    cy.intercept('PATCH', '**/expenses/*').as('patchExpense');
    cy.intercept('POST', '**/expenses/*/attachments').as('uploadAttachment');
    cy.intercept('DELETE', '**/expenses/*/attachments/*').as('deleteAttachment');

    attachDeductibleProofToFirstExpense();
    cy.wait('@patchExpense');
    cy.wait('@uploadAttachment');

    cy.get('button[name=edit]').first().click();
    cy.get('[data-testid="deductible-proof-existing"]').should('be.visible');
    cy.get('[data-testid="deductible-proof-remove-button"]').click();

    cy.wait('@deleteAttachment').then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
    });

    cy.get('[data-testid="deductible-proof-existing"]').should('not.exist');
  });
});
