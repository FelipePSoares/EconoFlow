describe('EconoFlow - global add modal tests', () => {
  const categoriesEndpointRegex = /\/api\/projects\/[^/]+\/categories$/;

  const openGlobalAddModal = (action: 'income' | 'expense' | 'expense item') => {
    cy.get('.global-add-button').should('be.visible');

    cy.get('.btn-floating-add').should('be.visible').click({ force: true });

    cy.get('body').then(($body) => {
      const menuIsOpen = $body.find('.global-add-button .dropdown-menu.show').length > 0;

      if (!menuIsOpen) {
        cy.get('.global-add-button .dropdown-menu').invoke('addClass', 'show');
      }
    });

    cy.get('.global-add-button .dropdown-menu.show').should('be.visible');

    cy.get('.global-add-button .dropdown-menu.show .dropdown-item').then(($items) => {
      const target = Array.from($items).find(item =>
        item.textContent?.trim().toLowerCase() === action
      );

      expect(target, `visible dropdown item for action "${action}"`).to.not.equal(undefined);
      cy.wrap(target as HTMLElement).click({ force: true });
    });

    cy.get('.mat-mdc-dialog-container', { timeout: 10000 }).should('be.visible');
    cy.get('.dialog-header h2').should('be.visible');
  };

  const selectMaterialOption = (controlName: string, optionText?: string) => {
    const selectLocator = `mat-select[formControlName="${controlName}"]`;
    const dialogSelector = '.mat-mdc-dialog-container';
    const openPanelSelector = '.cdk-overlay-container .mat-mdc-select-panel:visible';

    cy.get(dialogSelector).should('be.visible');

    cy.get(dialogSelector).find(selectLocator, { timeout: 10000 })
      .should('be.visible')
      .and('not.have.attr', 'aria-disabled', 'true');

    const tryOpen = (attempt: number) => {
      if (attempt === 0) {
        cy.get(dialogSelector).find(selectLocator).click({ force: true });
      } else if (attempt === 1) {
        cy.get(dialogSelector).find(selectLocator).find('.mat-mdc-select-trigger').click({ force: true });
      } else if (attempt === 2) {
        cy.get(dialogSelector).find(selectLocator).find('.mat-mdc-select-trigger').trigger('mousedown', { button: 0, force: true });
      } else if (attempt === 3) {
        cy.get(dialogSelector).find(selectLocator).focus().type('{enter}', { force: true });
      } else {
        cy.get(dialogSelector).find(selectLocator).focus().type('{downarrow}', { force: true });
      }

      cy.get('body').then(($body) => {
        const isOpen = $body.find(openPanelSelector).length > 0;
        if (isOpen) {
          return;
        }

        if (attempt >= 4) {
          throw new Error(`Unable to open mat-select panel for ${controlName}`);
        }

        cy.wait(120);
        tryOpen(attempt + 1);
      });
    };

    tryOpen(0);

    cy.get(openPanelSelector, { timeout: 10000 }).should('be.visible');

    cy.get(`${openPanelSelector} mat-option`)
      .should('have.length.greaterThan', 0);

    if (optionText) {
      cy.contains(`${openPanelSelector} mat-option`, optionText).click({ force: true });
      cy.get(dialogSelector).find(selectLocator).should('contain', optionText);
      return;
    }

    cy.get(`${openPanelSelector} mat-option`).first().click({ force: true });
    cy.get(dialogSelector).find(selectLocator).find('.mat-mdc-select-value-text').invoke('text').then(text => {
      expect(text.trim()).to.not.equal('');
    });
  };

  const toMonthValue = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const toMonthValueFromApiDate = (dateValue: string | Date): string => {
    if (typeof dateValue === 'string') {
      const normalized = dateValue.trim();
      const monthFromIso = normalized.match(/^(\d{4})-(\d{2})/);
      if (monthFromIso) {
        return `${monthFromIso[1]}-${monthFromIso[2]}`;
      }
    }

    const parsedDate = new Date(dateValue);
    return `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const toMonthBounds = (date: Date): { from: string; to: string } => {
    const fromDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const toDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    const format = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

    return {
      from: format(fromDate),
      to: format(toDate)
    };
  };

  const findMonthWithoutExpenses = (expenses: ExpenseRes[]): string => {
    const usedMonths = new Set(expenses.map(expense => toMonthValueFromApiDate(expense.date)));
    const today = new Date();

    for (let offset = 0; offset <= 120; offset++) {
      const month = toMonthValue(new Date(today.getFullYear(), today.getMonth() + offset, 1));
      if (!usedMonths.has(month)) {
        return month;
      }
    }

    for (let offset = 1; offset <= 120; offset++) {
      const month = toMonthValue(new Date(today.getFullYear(), today.getMonth() - offset, 1));
      if (!usedMonths.has(month)) {
        return month;
      }
    }

    const fallback = new Date(today.getFullYear() + 20, 0, 1);
    return toMonthValue(fallback);
  };

  const toDateFromMonth = (monthValue: string): Date => {
    const [year, month] = monthValue.split('-').map(Number);
    return new Date(year, month - 1, 1);
  };

  const updateFormDate = (date: Date) => {
    cy.window().then((win) => {
      const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US';
      const formattedDate = date.toLocaleDateString(locale);
      cy.get('input[formControlName="date"]').clear().type(formattedDate).blur();
    });
  };

  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;
      cy.login(user.username, user.password);
    });

    cy.fixture('projects').then((projects) => {
      cy.visit(`/projects/${projects.defaultProject.id}`);
    });
  });

  it('should create an income from the floating add modal', () => {
    cy.intercept('POST', '**/incomes*').as('postIncomes');

    openGlobalAddModal('income');

    cy.fixture('incomes').then((incomes) => {
      const income = incomes.testWageIncome;

      cy.get('input[formControlName=name]').type(income.name);
      cy.get('input[formControlName=amount]').type(income.amount);
      cy.get('button[type=submit]').click();
    });

    cy.wait('@postIncomes').then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
    });
  });

  it('should create an expense from the floating add modal', () => {
    cy.intercept({ method: 'GET', url: categoriesEndpointRegex }).as('getModalCategories');
    cy.intercept('POST', '**/expenses*').as('postExpenses');

    openGlobalAddModal('expense');
    cy.wait('@getModalCategories');

    selectMaterialOption('categoryId');

    cy.fixture('expenses').then((expenses) => {
      const expense = expenses.testSomeExpense;

      cy.get('input[formControlName=name]').type(expense.name);
      cy.get('input[formControlName=budget]').type(expense.budget);
      cy.get('input[formControlName=amount]').type(expense.amount);
      cy.get('button[type=submit]').click();
    });

    cy.wait('@postExpenses').then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
    });
  });

  it('should load month-scoped parent expenses and create an expense item from the floating add modal', () => {
    cy.fixture('projects').then((projects) => {
      const project = projects.defaultProject;

      cy.fixture('categories').then((categories) => {
        const category = categories.defaultCategory;

        cy.request(`/api/projects/${project.id}/categories/${category.id}`).then((categoryResponse) => {
          const categoryExpenses = categoryResponse.body.expenses as ExpenseRes[];
          expect(categoryExpenses.length).to.be.greaterThan(0);

          const monthValue = toMonthValueFromApiDate(categoryExpenses[1].date);
          const monthBounds = toMonthBounds(toDateFromMonth(monthValue));

          cy.intercept({ method: 'GET', url: categoriesEndpointRegex }).as('getModalCategories');
          cy.intercept('GET', `**/projects/${project.id}/categories/${category.id}/expenses?*`).as('getMonthlyExpenses');
          cy.intercept('PATCH', `**/projects/${project.id}/categories/${category.id}/expenses/*`).as('patchExpense');

          cy.visit(`/projects/${project.id}/overview/monthly?month=${monthValue}`);

          openGlobalAddModal('expense item');
          cy.wait('@getModalCategories');

          selectMaterialOption('categoryId', category.name);

          cy.wait('@getMonthlyExpenses').then(({ request, response }) => {
            const params = new URL(request.url).searchParams;
            expect(params.get('from')).to.equal(monthBounds.from);
            expect(params.get('to')).to.equal(monthBounds.to);

            const expenseFromSelectedMonth = response?.body.find(expense => expense.id === categoryExpenses[1].id);
            expect(expenseFromSelectedMonth).to.not.equal(undefined);
          });

          selectMaterialOption('expenseId', categoryExpenses[1].name);

          cy.fixture('expenseItems').then((expenseItems) => {
            const expenseItem = expenseItems.testSomeExpenseItem;

            cy.get('input[formControlName=name]').type(expenseItem.name);
            cy.get('input[formControlName=amount]').type(expenseItem.amount);
            cy.get('button[type=submit]').click();
          });

          cy.wait('@patchExpense').then(({ request, response }) => {
            expect(response?.statusCode).to.equal(200);
            expect(request.url).to.include(`/expenses/${categoryExpenses[1].id}`);
          });
        });
      });
    });
  });

  it('should show empty-state message when selected month has no parent expense', () => {
    cy.fixture('projects').then((projects) => {
      const project = projects.defaultProject;

      cy.fixture('categories').then((categories) => {
        const category = categories.defaultCategory;

        cy.request(`/api/projects/${project.id}/categories/${category.id}`).then((categoryResponse) => {
          const categoryExpenses = categoryResponse.body.expenses as ExpenseRes[];
          const monthWithoutExpenses = findMonthWithoutExpenses(categoryExpenses);
          const monthWithoutBounds = toMonthBounds(toDateFromMonth(monthWithoutExpenses));

          cy.intercept({ method: 'GET', url: categoriesEndpointRegex }).as('getModalCategories');
          cy.intercept('GET', `**/projects/${project.id}/categories/${category.id}/expenses?*`).as('getMonthlyExpenses');
          cy.intercept('GET', `**/projects/${project.id}/categories/${category.id}/expenses?from=${monthWithoutBounds.from}&to=${monthWithoutBounds.to}`).as('getMonthlyExpensesWithout');

          cy.visit(`/projects/${project.id}/overview/monthly?month=${monthWithoutExpenses}`);

          openGlobalAddModal('expense item');
          cy.wait('@getModalCategories');

          selectMaterialOption('categoryId', category.name);
          updateFormDate(toDateFromMonth(monthWithoutExpenses));

          cy.wait('@getMonthlyExpensesWithout').then(({ response }) => {
            expect(response?.statusCode).to.equal(200);
            expect(response?.body).to.have.length(0);
          });

          cy.get('[data-testid="no-parent-expense-message"]')
            .should('be.visible')
            .and(($el) => {
              const text = $el.text().trim();
              const validTexts = ['No data for the selected month.', 'Sem dados para o mês selecionado.'];
              expect(validTexts).to.include(text);
            });

          cy.get('mat-select[formControlName="expenseId"]')
            .should('have.attr', 'aria-disabled', 'true');
        });
      });
    });
  });

  it('should show empty-state message after date change without touching parent expense', () => {
    cy.fixture('projects').then((projects) => {
      const project = projects.defaultProject;

      cy.fixture('categories').then((categories) => {
        const category = categories.defaultCategory;

        cy.request(`/api/projects/${project.id}/categories/${category.id}`).then((categoryResponse) => {
          const categoryExpenses = categoryResponse.body.expenses as ExpenseRes[];
          expect(categoryExpenses.length).to.be.greaterThan(0);

          const monthWithExpenses = toMonthValueFromApiDate(categoryExpenses[1].date);
          const monthWithoutExpenses = findMonthWithoutExpenses(categoryExpenses);

          cy.intercept({ method: 'GET', url: categoriesEndpointRegex }).as('getModalCategories');
          cy.intercept('GET', `**/projects/${project.id}/categories/${category.id}/expenses?*`).as('getMonthlyExpenses');

          cy.visit(`/projects/${project.id}/overview/monthly?month=${monthWithExpenses}`);

          openGlobalAddModal('expense item');
          cy.wait('@getModalCategories');

          selectMaterialOption('categoryId', category.name);

          cy.wait('@getMonthlyExpenses').then(({ response }) => {
            expect(response?.statusCode).to.equal(200);
            expect((response?.body ?? []).length).to.be.greaterThan(0);
          });

          updateFormDate(toDateFromMonth(monthWithoutExpenses));

          cy.wait('@getMonthlyExpenses').then(({ response }) => {
            expect(response?.statusCode).to.equal(200);
            expect(response?.body).to.have.length(0);
          });

          cy.get('[data-testid="no-parent-expense-message"]').should('be.visible');
          cy.get('mat-select[formControlName="expenseId"]').should('have.attr', 'aria-disabled', 'true');
        });
      });
    });
  });

  it('should request parent expenses only once after a valid typed date', () => {
    cy.fixture('projects').then((projects) => {
      const project = projects.defaultProject;

      cy.fixture('categories').then((categories) => {
        const category = categories.defaultCategory;

        cy.request(`/api/projects/${project.id}/categories/${category.id}`).then((categoryResponse) => {
          const categoryExpenses = categoryResponse.body.expenses as ExpenseRes[];
          expect(categoryExpenses.length).to.be.greaterThan(0);

          const monthWithExpenses = toMonthValueFromApiDate(categoryExpenses[1].date);
          const monthWithoutExpenses = findMonthWithoutExpenses(categoryExpenses);
          const monthWithoutBounds = toMonthBounds(toDateFromMonth(monthWithoutExpenses));
          let monthlyExpensesRequestCount = 0;

          cy.intercept({ method: 'GET', url: categoriesEndpointRegex }).as('getModalCategories');
          cy.intercept('GET', `**/projects/${project.id}/categories/${category.id}/expenses?*`, (req) => {
            monthlyExpensesRequestCount++;
            req.continue();
          }).as('getMonthlyExpenses');

          cy.visit(`/projects/${project.id}/overview/monthly?month=${monthWithExpenses}`);

          openGlobalAddModal('expense item');
          cy.wait('@getModalCategories');

          selectMaterialOption('categoryId', category.name);

          cy.wait('@getMonthlyExpenses').then(({ response }) => {
            expect(response?.statusCode).to.equal(200);
            expect((response?.body ?? []).length).to.be.greaterThan(0);
          });

          cy.then(() => {
            monthlyExpensesRequestCount = 0;
          });

          updateFormDate(toDateFromMonth(monthWithoutExpenses));

          cy.wait('@getMonthlyExpenses').then(({ request, response }) => {
            const params = new URL(request.url).searchParams;
            expect(params.get('from')).to.equal(monthWithoutBounds.from);
            expect(params.get('to')).to.equal(monthWithoutBounds.to);
            expect(response?.statusCode).to.equal(200);
            expect(response?.body).to.have.length(0);
          });

          cy.wait(400);
          cy.then(() => {
            expect(monthlyExpensesRequestCount).to.equal(1);
          });
        });
      });
    });
  });

  it('should re-enable parent expense field after changing date back to month with parent expense', () => {
    cy.fixture('projects').then((projects) => {
      const project = projects.defaultProject;

      cy.fixture('categories').then((categories) => {
        const category = categories.defaultCategory;

        cy.request(`/api/projects/${project.id}/categories/${category.id}`).then((categoryResponse) => {
          const categoryExpenses = categoryResponse.body.expenses as ExpenseRes[];
          expect(categoryExpenses.length).to.be.greaterThan(0);

          const monthWithExpenses = toMonthValueFromApiDate(categoryExpenses[1].date);
          const monthWithoutExpenses = findMonthWithoutExpenses(categoryExpenses);
          const monthWithBounds = toMonthBounds(toDateFromMonth(monthWithExpenses));
          const monthWithoutBounds = toMonthBounds(toDateFromMonth(monthWithoutExpenses));

          cy.intercept({ method: 'GET', url: categoriesEndpointRegex }).as('getModalCategories');
          cy.intercept('GET', `**/projects/${project.id}/categories/${category.id}/expenses?*`).as('getMonthlyExpenses');
          cy.intercept('GET', `**/projects/${project.id}/categories/${category.id}/expenses?from=${monthWithoutBounds.from}&to=${monthWithoutBounds.to}`).as('getMonthlyExpensesWithout');
          cy.intercept('GET', `**/projects/${project.id}/categories/${category.id}/expenses?from=${monthWithBounds.from}&to=${monthWithBounds.to}`).as('getMonthlyExpensesWith');

          cy.visit(`/projects/${project.id}/overview/monthly?month=${monthWithoutExpenses}`);

          openGlobalAddModal('expense item');
          cy.wait('@getModalCategories');

          selectMaterialOption('categoryId', category.name);
          updateFormDate(toDateFromMonth(monthWithoutExpenses));

          cy.wait('@getMonthlyExpensesWithout').then(({ response }) => {
            expect(response?.statusCode).to.equal(200);
            expect(response?.body).to.have.length(0);
          });

          cy.get('mat-select[formControlName="expenseId"]').should('have.attr', 'aria-disabled', 'true');
          cy.get('[data-testid="no-parent-expense-message"]').should('be.visible');

          updateFormDate(toDateFromMonth(monthWithExpenses));

          cy.wait('@getMonthlyExpensesWith').then(({ response }) => {
            expect(response?.statusCode).to.equal(200);
            expect((response?.body ?? []).length).to.be.greaterThan(0);
          });

          cy.get('mat-select[formControlName="expenseId"]').should('have.attr', 'aria-disabled', 'false');
          cy.get('[data-testid="no-parent-expense-message"]').should('not.exist');
        });
      });
    });
  });

  it('should keep latest parent-expense result after fast date changes', () => {
    cy.fixture('projects').then((projects) => {
      const project = projects.defaultProject;

      cy.fixture('categories').then((categories) => {
        const category = categories.defaultCategory;

        cy.request(`/api/projects/${project.id}/categories/${category.id}`).then((categoryResponse) => {
          const categoryExpenses = categoryResponse.body.expenses as ExpenseRes[];
          expect(categoryExpenses.length).to.be.greaterThan(0);

          const monthWithExpenses = toMonthValueFromApiDate(categoryExpenses[1].date);
          const monthWithoutExpenses = findMonthWithoutExpenses(categoryExpenses);
          const monthWithBounds = toMonthBounds(toDateFromMonth(monthWithExpenses));
          const monthWithoutBounds = toMonthBounds(toDateFromMonth(monthWithoutExpenses));

          cy.intercept({ method: 'GET', url: categoriesEndpointRegex }).as('getModalCategories');
          cy.intercept('GET', `**/projects/${project.id}/categories/${category.id}/expenses?*`, (req) => {
            const params = new URL(req.url).searchParams;
            const from = params.get('from');

            if (from === monthWithBounds.from) {
              req.continue((res) => {
                res.setDelay(1200);
              });
              return;
            }

            req.continue();
          }).as('getMonthlyExpenses');

          cy.visit(`/projects/${project.id}/overview/monthly?month=${monthWithExpenses}`);

          openGlobalAddModal('expense item');
          cy.wait('@getModalCategories');

          selectMaterialOption('categoryId', category.name);
          updateFormDate(toDateFromMonth(monthWithoutExpenses));

          cy.wait('@getMonthlyExpenses').then(({ request, response }) => {
            const params = new URL(request.url).searchParams;
            expect(params.get('from')).to.equal(monthWithoutBounds.from);
            expect(params.get('to')).to.equal(monthWithoutBounds.to);
            expect(response?.statusCode).to.equal(200);
            expect(response?.body).to.have.length(0);
          });

          cy.get('[data-testid="no-parent-expense-message"]').should('be.visible');
          cy.get('mat-select[formControlName="expenseId"]').should('have.attr', 'aria-disabled', 'true');

          cy.wait('@getMonthlyExpenses').then(({ request, response }) => {
            const params = new URL(request.url).searchParams;
            expect(params.get('from')).to.equal(monthWithBounds.from);
            expect(params.get('to')).to.equal(monthWithBounds.to);
            expect(response?.statusCode).to.equal(200);
            expect((response?.body ?? []).length).to.be.greaterThan(0);
          });

          cy.get('[data-testid="no-parent-expense-message"]').should('be.visible');
          cy.get('mat-select[formControlName="expenseId"]').should('have.attr', 'aria-disabled', 'true');
        });
      });
    });
  });
});
