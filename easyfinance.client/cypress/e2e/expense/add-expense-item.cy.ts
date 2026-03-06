describe('EconoFlow - expense item add Tests', () => {
  interface ExpenseItemPayload {
    isDeductible?: boolean;
    temporaryAttachmentIds?: string[];
    name?: string;
    amount?: number;
  }

  interface ExpensePatchOperation {
    op: string;
    path: string;
    value?: ExpenseItemPayload | boolean | number | string | string[] | null;
  }

  beforeEach(() => {
    cy.intercept('GET', '**/expenses?*').as('getExpense')
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

          cy.wait('@getExpense')

          cy.get('.btn-link').last().click()

          cy.get('button').contains('Add Item').click();
          cy.wait('@getTaxYearSettings');
        })
      })
    })
  })

  const selectDeductibleProofForExpenseItem = () => {
    const proofFileContent = Cypress.Buffer.from('%PDF-1.4 deductible proof item');

    cy.get('[data-testid="is-deductible-item-toggle"]').click();
    cy.wait('@getTaxYearSettings');
    cy.get('app-configure-tax-year-rule-dialog').should('not.exist');
    cy.get('.cdk-overlay-backdrop-showing').should('not.exist');
    cy.get('[data-testid="deductible-proof-item-input"]').should('be.enabled');
    cy.get('[data-testid="deductible-proof-item-input"]').selectFile({
      contents: proofFileContent,
      fileName: 'deductible-proof-item.pdf',
      mimeType: 'application/pdf',
      lastModified: Date.now()
    });
  };

  it('should add a new expense item', () => {
    cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')

    cy.fixture('expenseItems').then((expenseItems) => {
      const expenseItem = expenseItems.testSomeExpenseItem;

      cy.get('input[formControlName=name]').type(expenseItem.name)
      cy.get('input[formControlName=amount]').type(expenseItem.amount)

      cy.get('button[type=submit]').click();

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ response }) => {
        expect(response?.statusCode).to.equal(200)

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created Successfully!')

        cy.wait<ExpenseReq, ExpenseRes[]>('@getExpense').then(({ response }) => {
          console.log('result:' + JSON.stringify(response))
          const exists = response?.body[response?.body.length -1].items.some(item => item.name == expenseItem.name && item.amount == expenseItem.amount / 100)
          expect(exists).to.equal(true)
        })
      })
    })
  })

  it('should upload temporary deductible proof and create expense item with proof flag', () => {
    cy.intercept('PATCH', '**/expenses/*').as('patchExpenses');
    cy.intercept('POST', '**/expenseItems/temporary-attachments').as('postTemporaryExpenseItemAttachment');

    const expenseItemName = `expense-item-${Date.now()}`;
    const expenseItemAmount = '500';

    cy.get('input[formControlName=name]').type(expenseItemName);
    cy.get('input[formControlName=amount]').clear().type(expenseItemAmount);
    selectDeductibleProofForExpenseItem();

    cy.wait('@postTemporaryExpenseItemAttachment').then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
    });

    cy.get('button[type=submit]').should('not.be.disabled').click();

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);

      const operations = request.body as ExpensePatchOperation[];
      const addItemOperation = operations.find(operation => operation.op === 'add' && operation.path.startsWith('/items/'));
      const addItemPayload = addItemOperation?.value as ExpenseItemPayload | undefined;

      expect(addItemPayload?.isDeductible).to.equal(true);
      expect(addItemPayload?.temporaryAttachmentIds ?? []).to.have.length(1);
    });

    cy.wait('@getExpense');

    cy.contains('.name-sub', expenseItemName).closest('.d-flex').within(() => {
      cy.get('[data-testid="expense-item-deductible-flag"]').should('be.visible');
      cy.get('[data-testid="expense-item-proof-flag"]').should('be.visible');
    });
  });

  it('should disable submit while expense item proof upload is in progress', () => {
    cy.intercept('POST', '**/expenseItems/temporary-attachments', (request) => {
      request.reply({
        delay: 1200,
        statusCode: 201,
        body: {
          id: 'temp-proof-expense-item',
          name: 'deductible-proof-item.pdf',
          contentType: 'application/pdf',
          size: 24,
          attachmentType: 'DeductibleProof',
          isTemporary: true
        }
      });
    }).as('postTemporaryExpenseItemAttachment');

    selectDeductibleProofForExpenseItem();

    cy.get('[data-testid="deductible-proof-item-progress"]').should('be.visible');
    cy.get('button[type=submit]').should('be.disabled');

    cy.wait('@postTemporaryExpenseItemAttachment').then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
    });

    cy.get('button[type=submit]').should('not.be.disabled');
  });
})
