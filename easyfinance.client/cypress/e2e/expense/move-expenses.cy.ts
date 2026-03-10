describe('EconoFlow - move expense and item tests', () => {
  interface ExpensePatchOperation {
    op: string;
    path: string;
    value?: unknown;
  }

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
  let serverNow = new Date();

  const toDateOnly = (value: Date): string => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toMonthDiff = (targetDate: Date): number => {
    const clientNow = new Date();
    return (targetDate.getFullYear() - clientNow.getFullYear()) * 12
      + (targetDate.getMonth() - clientNow.getMonth());
  };

  const openExpensesPageForMonth = (categoryId: string, targetDate: Date): void => {
    cy.visit(`/projects/${projectId}/categories/${categoryId}/expenses`);
    cy.wait('@getExpenses');

    const monthDiff = toMonthDiff(targetDate);
    if (monthDiff === 0) {
      return;
    }

    const navigationSelector = monthDiff > 0 ? '#next' : '#previous';
    for (let i = 0; i < Math.abs(monthDiff); i++) {
      cy.get(navigationSelector).click();
      cy.wait('@getExpenses');
    }
  };

  const createCategory = (name: string): Cypress.Chainable<CategoryResponse> => {
    return cy.request('POST', `/api/projects/${projectId}/categories`, {
      name
    }).its('body');
  };

  const createExpense = (
    categoryId: string,
    name: string,
    date: string
  ): Cypress.Chainable<ExpenseResponse> => {
    return cy.request('POST', `/api/projects/${projectId}/categories/${categoryId}/expenses`, {
      name,
      date,
      amount: 100,
      budget: 200,
      isDeductible: false,
      temporaryAttachmentIds: [],
      items: []
    }).its('body');
  };

  const addExpenseItem = (
    categoryId: string,
    expenseId: string,
    itemName: string,
    itemDate: string
  ): Cypress.Chainable<ExpenseResponse> => {
    const patchBody: ExpensePatchOperation[] = [
      {
        op: 'add',
        path: '/items/0',
        value: {
          name: itemName,
          date: itemDate,
          amount: 25,
          isDeductible: false,
          temporaryAttachmentIds: [],
          items: []
        }
      }
    ];

    return cy.request('PATCH', `/api/projects/${projectId}/categories/${categoryId}/expenses/${expenseId}`, patchBody)
      .its('body');
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

    cy.then(() => {
      cy.request('GET', `/api/projects/${projectId}/categories`).then((response) => {
        const headerDate = response.headers['date'];
        const parsedServerDate = headerDate ? new Date(String(headerDate)) : new Date();
        serverNow = Number.isNaN(parsedServerDate.getTime()) ? new Date() : parsedServerDate;
      });
    });
  });

  it('moves an expense to another category', () => {
    const now = Date.now();
    const sourceExpenseName = `move-expense-${now}`;
    const targetCategoryName = `Move Category ${now}`;
    const safeDay = Math.min(serverNow.getDate(), 28);
    const sourceMonthDate = new Date(serverNow.getFullYear(), serverNow.getMonth(), safeDay);
    const expenseDate = toDateOnly(sourceMonthDate);

    cy.intercept('GET', '**/expenses?*').as('getExpenses');
    cy.intercept('POST', '**/categories/*/expenses/*/move').as('moveExpense');

    createCategory(targetCategoryName).then(targetCategory => {
      createExpense(sourceCategoryId, sourceExpenseName, expenseDate).then(() => {
        openExpensesPageForMonth(sourceCategoryId, sourceMonthDate);

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

        openExpensesPageForMonth(targetCategory.id, sourceMonthDate);
        cy.contains('.name', sourceExpenseName).should('exist');
      });
    });
  });

  it('moves an expense item to another expense in the same category', () => {
    const now = Date.now();
    const itemName = `move-item-${now}`;
    const sourceExpenseName = `move-item-source-${now}`;
    const targetExpenseName = `move-item-target-${now}`;
    const safeDay = Math.min(serverNow.getDate(), 28);
    const sourceMonthDate = new Date(serverNow.getFullYear(), serverNow.getMonth(), safeDay);
    const expenseDate = toDateOnly(sourceMonthDate);

    cy.intercept('GET', '**/expenses?*').as('getExpenses');
    cy.intercept('POST', '**/expenseItems/*/move').as('moveExpenseItem');

    createExpense(sourceCategoryId, sourceExpenseName, expenseDate).then(sourceExpense => {
      addExpenseItem(sourceCategoryId, sourceExpense.id, itemName, expenseDate).then(() => {
        createExpense(sourceCategoryId, targetExpenseName, expenseDate).then(() => {
          openExpensesPageForMonth(sourceCategoryId, sourceMonthDate);

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
  });

  it('moves an expense item to another category and expense', () => {
    const now = Date.now();
    const itemName = `move-cross-item-${now}`;
    const sourceExpenseName = `move-cross-source-${now}`;
    const targetExpenseName = `move-cross-target-${now}`;
    const targetCategoryName = `Move Cross Category ${now}`;
    const safeDay = Math.min(serverNow.getDate(), 28);
    const sourceMonthDate = new Date(serverNow.getFullYear(), serverNow.getMonth(), safeDay);
    const expenseDate = toDateOnly(sourceMonthDate);

    cy.intercept('GET', '**/expenses?*').as('getExpenses');
    cy.intercept('POST', '**/expenseItems/*/move').as('moveExpenseItem');

    createCategory(targetCategoryName).then(targetCategory => {
      createExpense(sourceCategoryId, sourceExpenseName, expenseDate).then(sourceExpense => {
        addExpenseItem(sourceCategoryId, sourceExpense.id, itemName, expenseDate).then(() => {
          createExpense(targetCategory.id, targetExpenseName, expenseDate).then(() => {
            openExpensesPageForMonth(sourceCategoryId, sourceMonthDate);

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

            openExpensesPageForMonth(targetCategory.id, sourceMonthDate);

            ensureExpenseExpanded(targetExpenseName);
            cy.contains('.name', targetExpenseName)
              .closest('.list-group-item')
              .find('.sublist')
              .should('contain.text', itemName);
          });
        });
      });
    });
  });

  it('shows backend validation error for invalid cross-month move', () => {
    const now = Date.now();
    const itemName = `move-invalid-item-${now}`;
    const sourceExpenseName = `move-invalid-source-${now}`;
    const validTargetExpenseName = `move-invalid-target-valid-${now}`;
    const invalidTargetExpenseName = `move-invalid-target-prev-month-${now}`;
    const safeDay = Math.min(serverNow.getDate(), 28);
    const currentMonthDate = new Date(serverNow.getFullYear(), serverNow.getMonth(), safeDay);
    const previousMonthDate = new Date(serverNow.getFullYear(), serverNow.getMonth() - 1, safeDay);

    const currentMonthDateOnly = toDateOnly(currentMonthDate);
    const previousMonthDateOnly = toDateOnly(previousMonthDate);
    let invalidTargetExpenseId = '';

    cy.intercept('GET', '**/expenses?*').as('getExpenses');

    createExpense(sourceCategoryId, sourceExpenseName, currentMonthDateOnly).then(sourceExpense => {
      addExpenseItem(sourceCategoryId, sourceExpense.id, itemName, currentMonthDateOnly).then(() => {
        createExpense(sourceCategoryId, validTargetExpenseName, currentMonthDateOnly).then(() => {
          createExpense(sourceCategoryId, invalidTargetExpenseName, previousMonthDateOnly).then(invalidTargetExpense => {
            invalidTargetExpenseId = invalidTargetExpense.id;

            openExpensesPageForMonth(sourceCategoryId, currentMonthDate);

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
});
