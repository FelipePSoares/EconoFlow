describe('EconoFlow - deductible proof Tests', () => {
  interface ExpensePatchOperation {
    op: string;
    path: string;
    value?: boolean | number | string | string[] | null;
  }

  const ensureFirstExpenseScenario = () => {
    let wasDeductible = false;

    cy.intercept('PATCH', '**/expenses/*').as('setupPatchExpense');
    cy.intercept('DELETE', '**/expenses/*/attachments/*').as('setupDeleteAttachment');

    cy.get('button[name=edit]').first().click();
    cy.get('[data-testid="is-deductible-toggle"] button').should('exist').then(($toggleButton) => {
      wasDeductible = $toggleButton.attr('aria-checked') === 'true';

      if (wasDeductible) {
        cy.get('[data-testid="is-deductible-toggle"]').click();
        cy.get('button[type=submit]').should('not.be.disabled').click();
      }
    });

    cy.then(() => {
      if (!wasDeductible)
        return;

      cy.wait('@setupPatchExpense').then(({ response }) => {
        expect(response?.statusCode).to.equal(200);
      });
    });

    cy.reload();
    cy.wait<ExpenseReq, ExpenseRes[]>('@getExpenses').then(({ response }) => {
      const firstExpense = response?.body?.[0];
      expect(firstExpense).to.not.equal(undefined);
      expect(firstExpense?.isDeductible ?? false).to.equal(false);
    });

    cy.get('button[name=edit]').first().click();
    cy.get('[data-testid="is-deductible-toggle"] button').should('have.attr', 'aria-checked', 'false');
    cy.get('[data-testid="deductible-proof-existing"]').should('not.exist');
    cy.get('button[type=submit]').should('not.be.disabled').click();
  };

  beforeEach(() => {
    cy.intercept('GET', '**/expenses?*').as('getExpenses');
    cy.intercept('GET', '**/projects/*/settings/tax-year', {
      taxYearType: 'CalendarYear',
      taxYearStartMonth: null,
      taxYearStartDay: null,
      taxYearLabeling: 'ByStartYear'
    }).as('getTaxYearSettings');

    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password);

      cy.fixture('projects').then((projects) => {
        const project = projects.defaultProject;
        cy.fixture('categories').then((categories) => {
          const category = categories.defaultCategory;
          cy.visit('/projects/' + project.id + '/categories/' + category.id + '/expenses');
          cy.wait('@getExpenses');
          ensureFirstExpenseScenario();
        });
      });
    });
  });

  const attachDeductibleProofToFirstExpense = () => {
    const proofFileContent = Cypress.Buffer.from('%PDF-1.4 deductible proof');

    cy.get('button[name=edit]').first().click();
    cy.get('[data-testid="is-deductible-toggle"] button').should('have.attr', 'aria-checked', 'false');
    cy.get('[data-testid="is-deductible-toggle"]').click();
    cy.wait('@getTaxYearSettings');
    cy.get('[data-testid="is-deductible-toggle"] button').should('have.attr', 'aria-checked', 'true');
    cy.get('.cdk-overlay-backdrop-showing').should('not.exist');
    cy.get('[data-testid="deductible-proof-input"]').selectFile({
      contents: proofFileContent,
      fileName: 'deductible-proof.pdf',
      mimeType: 'application/pdf',
      lastModified: Date.now()
    });
  };

  it('should upload temporary deductible proof while editing expense and show proof in list', () => {
    cy.intercept('PATCH', '**/expenses/*').as('patchExpense');
    cy.intercept('POST', '**/expenses/temporary-attachments').as('postTemporaryAttachment');

    attachDeductibleProofToFirstExpense();

    cy.wait('@postTemporaryAttachment').then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
    });

    cy.get('button[type=submit]').should('not.be.disabled').click();

    cy.wait('@patchExpense').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      const operations = request.body as ExpensePatchOperation[];
      const hasDeductiblePatch = operations
        .some(operation => operation.path?.toLowerCase() === '/isdeductible' && operation.value === true);
      expect(hasDeductiblePatch).to.equal(true);

      const temporaryAttachmentValues = operations
        .filter(operation => operation.path?.startsWith('/temporaryAttachmentIds'))
        .flatMap(operation => Array.isArray(operation.value) ? operation.value : [operation.value])
        .filter((value): value is string => typeof value === 'string');
      expect(temporaryAttachmentValues).to.have.length(1);
    });

    cy.wait('@getExpenses');
    cy.get('.list-group-item').first().within(() => {
      cy.get('[data-testid="expense-deductible-flag"]').should('be.visible');
      cy.get('[data-testid="expense-proof-flag"]').should('be.visible');
    });

    cy.get('button[name=edit]').first().click();
    cy.get('[data-testid="is-deductible-toggle"] button').should('have.attr', 'aria-checked', 'true');
  });

  it('should disable submit while temporary proof upload is in progress', () => {
    cy.intercept('POST', '**/expenses/temporary-attachments', (request) => {
      request.reply({
        delay: 1200,
        statusCode: 201,
        body: {
          id: 'temp-proof-expense',
          name: 'deductible-proof.pdf',
          contentType: 'application/pdf',
          size: 24,
          attachmentType: 'DeductibleProof',
          isTemporary: true
        }
      });
    }).as('postTemporaryAttachment');

    attachDeductibleProofToFirstExpense();

    cy.get('[data-testid="deductible-proof-progress"]').should('be.visible');
    cy.get('button[type=submit]').should('be.disabled');

    cy.wait('@postTemporaryAttachment').then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
    });

    cy.get('button[type=submit]').should('not.be.disabled');
  });

  it('should delete deductible proof attachment', () => {
    cy.intercept('PATCH', '**/expenses/*').as('patchExpense');
    cy.intercept('POST', '**/expenses/temporary-attachments').as('postTemporaryAttachment');
    cy.intercept('DELETE', '**/expenses/*/attachments/*').as('deleteAttachment');

    attachDeductibleProofToFirstExpense();
    cy.wait('@postTemporaryAttachment');
    cy.get('button[type=submit]').click();
    cy.wait('@patchExpense');

    cy.get('button[name=edit]').first().click();
    cy.get('[data-testid="deductible-proof-existing"]').should('be.visible');
    cy.get('[data-testid="deductible-proof-remove-button"]').click();

    cy.wait('@deleteAttachment').then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
    });

    cy.get('[data-testid="deductible-proof-existing"]').should('not.exist');
  });
});
