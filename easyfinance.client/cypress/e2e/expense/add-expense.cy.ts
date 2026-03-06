describe('EconoFlow - expense add Tests', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/projects/*/settings/tax-year', {
      taxYearType: 'CalendarYear',
      taxYearStartMonth: null,
      taxYearStartDay: null,
      taxYearLabeling: 'ByStartYear'
    }).as('getTaxYearSettings');

    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

        cy.fixture('projects').then((projects) => {
          const project = projects.defaultProject;
          cy.fixture('categories').then((categories) => {
            const category = categories.defaultCategory;

              cy.visit('/projects/' + project.id + '/categories/' + category.id + '/expenses')

              cy.get('.btn-add').click();
              cy.wait('@getTaxYearSettings');
            })
        })
      })
  })

  const enableDeductibleMode = () => {
    cy.get('[data-testid="is-deductible-toggle"]').click();
    cy.wait('@getTaxYearSettings');
    cy.get('app-configure-tax-year-rule-dialog').should('not.exist');
    cy.get('.cdk-overlay-backdrop-showing').should('not.exist');
  };

  it('should keep deductible off by default', () => {
    cy.get('[data-testid="is-deductible-toggle"] button').should('not.be.checked');
    cy.get('[data-testid="deductible-proof-section"]').should('not.exist');
  });

  it('should show and hide proof section when deductible is toggled', () => {
    enableDeductibleMode();
    cy.get('[data-testid="deductible-proof-section"]').should('exist');

    cy.get('[data-testid="is-deductible-toggle"]').click();
    cy.get('[data-testid="deductible-proof-section"]').should('not.exist');
  });

  it('should add a new expense with deductible off', () => {
    cy.intercept('POST', '**/categories/*/expenses').as('postExpenses');

    cy.fixture('expenses').then((expenses) => {
      const expense = expenses.testSomeExpense;

      cy.get('input[formControlName=name]').type(expense.name);
      cy.get('input[formControlName=budget]').type(expense.budget);
      cy.get('input[formControlName=amount]').type(expense.amount);

      cy.get('button[type=submit]').click();

      cy.wait<ExpenseReq, ExpenseRes>('@postExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201);
        expect(request.body.isDeductible).to.equal(false);
        expect(request.body.temporaryAttachmentIds).to.deep.equal([]);
      });
    });
  });

  it('should create deductible expense without proof file', () => {
    cy.intercept('POST', '**/categories/*/expenses').as('postExpenses');

    cy.fixture('expenses').then((expenses) => {
      const expense = expenses.testSomeExpense;
      enableDeductibleMode();

      cy.get('input[formControlName=name]').type(`${expense.name}-deductible`);
      cy.get('input[formControlName=budget]').type(expense.budget);
      cy.get('input[formControlName=amount]').type(expense.amount);

      cy.get('button[type=submit]').click();

      cy.wait<ExpenseReq, ExpenseRes>('@postExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201);
        expect(request.body.isDeductible).to.equal(true);
        expect(request.body.temporaryAttachmentIds).to.deep.equal([]);
      });
    });
  });

  it('should upload temporary deductible proof and create expense', () => {
    cy.intercept('POST', '**/expenses/temporary-attachments').as('postTemporaryAttachment');
    cy.intercept('POST', '**/categories/*/expenses').as('postExpenses');

    cy.fixture('expenses').then((expenses) => {
      const expense = expenses.testSomeExpense;
      const proofFileContent = Cypress.Buffer.from('%PDF-1.4 deductible proof');

      enableDeductibleMode();
      cy.get('[data-testid="deductible-proof-input"]').should('be.enabled');
      cy.get('[data-testid="deductible-proof-input"]').selectFile({
        contents: proofFileContent,
        fileName: 'deductible-proof.pdf',
        mimeType: 'application/pdf',
        lastModified: Date.now()
      });

      cy.wait('@postTemporaryAttachment').then(({ response }) => {
        expect(response?.statusCode).to.equal(201);
      });

      cy.get('input[formControlName=name]').type(`${expense.name}-with-proof`);
      cy.get('input[formControlName=budget]').type(expense.budget);
      cy.get('input[formControlName=amount]').type(expense.amount);
      cy.get('button[type=submit]').click();

      cy.wait<ExpenseReq, ExpenseRes>('@postExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201);
        expect(request.body.isDeductible).to.equal(true);
        expect(request.body.temporaryAttachmentIds).to.have.length(1);
      });
    });
  });
});
