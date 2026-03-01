describe('EconoFlow - expense add Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

        cy.fixture('projects').then((projects) => {
          const project = projects.defaultProject;
          cy.fixture('categories').then((categories) => {
            const category = categories.defaultCategory;

            cy.visit('/projects/' + project.id + '/categories/' + category.id + '/expenses')

            cy.get('.btn-add').click();
          })
        })
      })
  })

  it('should keep deductible off by default', () => {
    cy.get('[data-testid="is-deductible-toggle"] input').should('not.be.checked');
    cy.get('[data-testid="deductible-proof-section"]').should('not.exist');
  });

  it('should show and hide proof section when deductible is toggled', () => {
    cy.get('[data-testid="is-deductible-toggle"]').click();
    cy.get('[data-testid="deductible-proof-section"]').should('be.visible');

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
      cy.get('[data-testid="is-deductible-toggle"]').click();

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

      cy.get('[data-testid="is-deductible-toggle"]').click();
      cy.get('[data-testid="deductible-proof-input"]').selectFile({
        contents: proofFileContent,
        fileName: 'deductible-proof.pdf',
        mimeType: 'application/pdf',
        lastModified: Date.now()
      });

      cy.get('input[formControlName=name]').type(`${expense.name}-with-proof`);
      cy.get('input[formControlName=budget]').type(expense.budget);
      cy.get('input[formControlName=amount]').type(expense.amount);
      cy.get('button[type=submit]').click();

      cy.wait('@postTemporaryAttachment').then(({ response }) => {
        expect(response?.statusCode).to.equal(201);
      });

      cy.wait<ExpenseReq, ExpenseRes>('@postExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(201);
        expect(request.body.isDeductible).to.equal(true);
        expect(request.body.temporaryAttachmentIds).to.have.length(1);
      });
    });
  });
});
