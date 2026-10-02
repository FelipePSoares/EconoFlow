describe('EconoFlow - income attachment Tests', () => {
  interface IncomeRequest {
    name: string;
    amount: number;
    temporaryAttachmentIds?: string[];
  }

  const visitIncomes = () => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password);

      cy.fixture('projects').then((projects) => {
        const project = projects.defaultProject;

        cy.intercept('GET', '**/incomes?*').as('getIncomes');
        cy.visit('/projects/' + project.id + '/incomes');
        cy.wait('@getIncomes');
      });
    });
  };

  const startIncomeWithAttachment = () => {
    const fileContent = Cypress.Buffer.from('%PDF-1.4 payslip');

    cy.get('.btn-add').click();
    cy.get('input[formControlName=name]').type('Salary with payslip');
    cy.get('input[formControlName=amount]').type('2500');
    cy.get('[data-testid="income-attachments-input"]').selectFile({
      contents: fileContent,
      fileName: 'payslip-january.pdf',
      mimeType: 'application/pdf',
      lastModified: Date.now()
    });
  };

  beforeEach(() => {
    visitIncomes();
  });

  it('should upload a temporary attachment and link it while creating an income', () => {
    cy.intercept('POST', '**/incomes/temporary-attachments').as('postTemporaryAttachment');
    cy.intercept('POST', '**/incomes/').as('postIncome');

    startIncomeWithAttachment();

    cy.wait('@postTemporaryAttachment').then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
      expect(response?.body?.attachmentType).to.equal('General');
      expect(response?.body?.isTemporary).to.equal(true);
    });

    cy.get('[data-testid="income-attachment-pending"]').should('be.visible').contains('payslip-january.pdf');

    cy.get('button[type=submit]').should('not.be.disabled').click();

    cy.wait('@postIncome').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(201);

      const body = request.body as IncomeRequest;
      expect(body.temporaryAttachmentIds ?? []).to.have.length(1);
    });

    cy.wait('@getIncomes');
    cy.get('[data-testid="income-attachment-flag"]').should('exist');
  });

  it('should disable submit while the temporary attachment upload is in progress', () => {
    cy.intercept('POST', '**/incomes/temporary-attachments', (request) => {
      request.reply({
        delay: 1200,
        statusCode: 201,
        body: {
          id: 'temp-income-attachment',
          name: 'payslip-january.pdf',
          contentType: 'application/pdf',
          size: 20,
          attachmentType: 'General',
          isTemporary: true
        }
      });
    }).as('postTemporaryAttachment');

    startIncomeWithAttachment();

    cy.get('[data-testid="income-attachments-progress"]').should('be.visible');
    cy.get('button[type=submit]').should('be.disabled');

    cy.wait('@postTemporaryAttachment').then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
    });

    cy.get('button[type=submit]').should('not.be.disabled');
  });

  it('should reject an unsupported file type without uploading', () => {
    cy.intercept('POST', '**/incomes/temporary-attachments').as('postTemporaryAttachment');

    const fileContent = Cypress.Buffer.from('plain text notes');

    cy.get('.btn-add').click();
    cy.get('[data-testid="income-attachments-input"]').selectFile({
      contents: fileContent,
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      lastModified: Date.now()
    });

    cy.get('[data-testid="income-attachment-pending"]').should('not.exist');
    cy.get('mat-snack-bar-container').should('be.visible');
    cy.get('@postTemporaryAttachment').should('not.exist');
  });
});
