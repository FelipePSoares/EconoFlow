describe('EconoFlow - move expense and item tests', () => {
  interface CategoryResponse {
    id: string;
    name: string;
  }

  interface ExpenseItemResponse {
    id: string;
    name: string;
    amount: number;
  }

  interface ExpenseResponse {
    id: string;
    name: string;
    items: ExpenseItemResponse[];
  }

  let projectId = '';
  let sourceCategoryId = '';

  const toDateOnly = (value: Date): string => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const createCategory = (name: string): Cypress.Chainable<CategoryResponse> => {
    return cy.request('POST', `/api/projects/${projectId}/categories`, {
      name
    }).its('body');
  };

  const createExpense = (
    categoryId: string,
    name: string,
    date: string,
    itemName?: string
  ): Cypress.Chainable<ExpenseResponse> => {
    const requestBody: ExpenseReq = {
      name,
      date: date as unknown as Date,
      amount: 100,
      budget: 200,
      isDeductible: false,
      temporaryAttachmentIds: []
    };

    return cy.request('POST', `/api/projects/${projectId}/categories/${categoryId}/expenses`, {
      ...requestBody,
      items: itemName
        ? [
          {
            name: itemName,
            date,
            amount: 25,
            isDeductible: false,
            temporaryAttachmentIds: [],
            items: []
          }
        ]
        : []
    }).its('body');
  };

  const ensureExpenseExpanded = (expenseName: string): void => {
    cy.contains('.name', expenseName)
      .closest('.expense-item')
      .find('button.btn-link')
      .first()
      .then($button => {
        if ($button.attr('aria-expanded') === 'false') {
          cy.wrap($button).click();
        }
      });
  };

  const selectMatOption = (formControlName: string, value: string): void => {
    cy.get(`mat-select[formControlName="${formControlName}"]`).click();
    cy.get('mat-option').contains(value).click();
  };

  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;
      cy.login(user.username, user.password);
    });

    cy.fixture('projects').then((projects) => {
      projectId = projects.defaultProject.id;
    });

    cy.fixture('categories').then((categories) => {
      sourceCategoryId = categories.defaultCategory.id;
    });
  });

  it('moves an expense to another category', () => {
    const now = Date.now();
    const sourceExpenseName = `move-expense-${now}`;
    const targetCategoryName = `Move Category ${now}`;
    const expenseDate = toDateOnly(new Date());

    cy.intercept('GET', '**/expenses?*').as('getExpenses');
    cy.intercept('POST', '**/categories/*/expenses/*/move').as('moveExpense');

    createCategory(targetCategoryName).then(targetCategory => {
      createExpense(sourceCategoryId, sourceExpenseName, expenseDate).then(() => {
        cy.visit(`/projects/${projectId}/categories/${sourceCategoryId}/expenses`);
        cy.wait('@getExpenses');

        cy.contains('.name', sourceExpenseName)
          .closest('.list-group-item')
          .within(() => {
            cy.get('button[name=move]').click();
          });

        selectMatOption('categoryId', targetCategoryName);
        cy.get('app-expense form button[type=submit]').click();

        cy.wait('@moveExpense').its('response.statusCode').should('eq', 200);
        cy.wait('@getExpenses');
        cy.get('mat-snack-bar-container').should('contain.text', 'Moved successfully!');
        cy.contains('.name', sourceExpenseName).should('not.exist');

        cy.visit(`/projects/${projectId}/categories/${targetCategory.id}/expenses`);
        cy.wait('@getExpenses');
        cy.contains('.name', sourceExpenseName).should('exist');
      });
    });
  });

  it('moves an expense item to another expense in the same category', () => {
    const now = Date.now();
    const itemName = `move-item-${now}`;
    const sourceExpenseName = `move-item-source-${now}`;
    const targetExpenseName = `move-item-target-${now}`;
    const expenseDate = toDateOnly(new Date());

    cy.intercept('GET', '**/expenses?*').as('getExpenses');
    cy.intercept('POST', '**/expenseItems/*/move').as('moveExpenseItem');

    createExpense(sourceCategoryId, sourceExpenseName, expenseDate, itemName).then(() => {
      createExpense(sourceCategoryId, targetExpenseName, expenseDate).then(() => {
        cy.visit(`/projects/${projectId}/categories/${sourceCategoryId}/expenses`);
        cy.wait('@getExpenses');

        ensureExpenseExpanded(sourceExpenseName);

        cy.contains('.name-sub', itemName)
          .closest('.d-flex')
          .within(() => {
            cy.get('button[name=move-sub]').click();
          });

        selectMatOption('expenseId', targetExpenseName);
        cy.get('app-expense-item form button[type=submit]').click();

        cy.wait('@moveExpenseItem').its('response.statusCode').should('eq', 200);
        cy.wait('@getExpenses');
        cy.get('mat-snack-bar-container').should('contain.text', 'Moved successfully!');

        ensureExpenseExpanded(sourceExpenseName);
        cy.contains('.name', sourceExpenseName)
          .closest('.list-group-item')
          .find('.sublist')
          .should('not.contain.text', itemName);

        ensureExpenseExpanded(targetExpenseName);
        cy.contains('.name', targetExpenseName)
          .closest('.list-group-item')
          .find('.sublist')
          .should('contain.text', itemName);
      });
    });
  });

  it('moves an expense item to another category and expense', () => {
    const now = Date.now();
    const itemName = `move-cross-item-${now}`;
    const sourceExpenseName = `move-cross-source-${now}`;
    const targetExpenseName = `move-cross-target-${now}`;
    const targetCategoryName = `Move Cross Category ${now}`;
    const expenseDate = toDateOnly(new Date());

    cy.intercept('GET', '**/expenses?*').as('getExpenses');
    cy.intercept('POST', '**/expenseItems/*/move').as('moveExpenseItem');

    createCategory(targetCategoryName).then(targetCategory => {
      createExpense(sourceCategoryId, sourceExpenseName, expenseDate, itemName).then(() => {
        createExpense(targetCategory.id, targetExpenseName, expenseDate).then(() => {
          cy.visit(`/projects/${projectId}/categories/${sourceCategoryId}/expenses`);
          cy.wait('@getExpenses');

          ensureExpenseExpanded(sourceExpenseName);

          cy.contains('.name-sub', itemName)
            .closest('.d-flex')
            .within(() => {
              cy.get('button[name=move-sub]').click();
            });

          selectMatOption('categoryId', targetCategoryName);
          cy.wait('@getExpenses');
          selectMatOption('expenseId', targetExpenseName);
          cy.get('app-expense-item form button[type=submit]').click();

          cy.wait('@moveExpenseItem').its('response.statusCode').should('eq', 200);
          cy.wait('@getExpenses');
          cy.get('mat-snack-bar-container').should('contain.text', 'Moved successfully!');

          ensureExpenseExpanded(sourceExpenseName);
          cy.contains('.name', sourceExpenseName)
            .closest('.list-group-item')
            .find('.sublist')
            .should('not.contain.text', itemName);

          cy.visit(`/projects/${projectId}/categories/${targetCategory.id}/expenses`);
          cy.wait('@getExpenses');

          ensureExpenseExpanded(targetExpenseName);
          cy.contains('.name', targetExpenseName)
            .closest('.list-group-item')
            .find('.sublist')
            .should('contain.text', itemName);
        });
      });
    });
  });

  it('shows backend validation error for invalid cross-month move', () => {
    const now = Date.now();
    const itemName = `move-invalid-item-${now}`;
    const sourceExpenseName = `move-invalid-source-${now}`;
    const validTargetExpenseName = `move-invalid-target-valid-${now}`;
    const invalidTargetExpenseName = `move-invalid-target-next-month-${now}`;
    const currentMonthDate = new Date();
    const nextMonthDate = new Date();
    nextMonthDate.setDate(10);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

    const currentMonthDateOnly = toDateOnly(currentMonthDate);
    const nextMonthDateOnly = toDateOnly(nextMonthDate);
    let invalidTargetExpenseId = '';

    cy.intercept('GET', '**/expenses?*').as('getExpenses');

    createExpense(sourceCategoryId, sourceExpenseName, currentMonthDateOnly, itemName).then(() => {
      createExpense(sourceCategoryId, validTargetExpenseName, currentMonthDateOnly).then(() => {
        createExpense(sourceCategoryId, invalidTargetExpenseName, nextMonthDateOnly).then(invalidTargetExpense => {
          invalidTargetExpenseId = invalidTargetExpense.id;

          cy.visit(`/projects/${projectId}/categories/${sourceCategoryId}/expenses`);
          cy.wait('@getExpenses');

          ensureExpenseExpanded(sourceExpenseName);

          cy.contains('.name-sub', itemName)
            .closest('.d-flex')
            .within(() => {
              cy.get('button[name=move-sub]').click();
            });

          selectMatOption('expenseId', validTargetExpenseName);

          cy.intercept('POST', '**/expenseItems/*/move', (request) => {
            request.body.targetExpenseId = invalidTargetExpenseId;
          }).as('moveExpenseItemInvalid');

          cy.get('app-expense-item form button[type=submit]').click();

          cy.wait('@moveExpenseItemInvalid').its('response.statusCode').should('eq', 400);
          cy.get('app-expense-item form').should('contain.text', 'Can\'t add an expense item with different year or month from expense');
        });
      });
    });
  });
});
