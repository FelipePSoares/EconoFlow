describe('EconoFlow - annual overview deductible expenses', () => {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const getYearSummaryAlias = (year: number) => `getYearSummary_${year}`;
  const getAnnualExpensesByCategoryAlias = (year: number) => `getAnnualExpensesByCategory_${year}`;
  const getIncomesAlias = (year: number) => `getIncomes_${year}`;
  const getCategoriesAlias = (year: number) => `getCategories_${year}`;

  const parseYear = (rawYear: string | null | undefined, fallbackYear: number): number => {
    const parsedYear = Number(rawYear);
    return Number.isFinite(parsedYear) ? parsedYear : fallbackYear;
  };

  const createCategoriesResponse = (year: number): CategoryRes[] => {
    if (year !== currentYear) {
      return [];
    }

    return [
      {
        id: 'category-1',
        name: 'Taxes',
        isArchived: false,
        displayOrder: 0,
        expenses: [
          {
            id: 'expense-1',
            date: `${currentYear}-02-10`,
            name: 'Accountant fee',
            budget: 200,
            amount: 150,
            isDeductible: true,
            attachments: [
              {
                id: 'proof-1',
                name: 'invoice.pdf',
                attachmentType: 'DeductibleProof'
              }
            ],
            items: []
          },
          {
            id: 'expense-2',
            date: `${currentYear}-03-10`,
            name: 'Business lunch',
            budget: 120,
            amount: 80,
            isDeductible: true,
            attachments: [],
            items: [
              {
                id: 'expense-item-1',
                date: `${currentYear}-01-05`,
                name: 'Taxi receipt',
                amount: 30,
                isDeductible: true,
                attachments: []
              }
            ]
          }
        ]
      } as CategoryRes
    ];
  };

  const setupAnnualOverviewStubs = (projectId: string) => {
    cy.intercept('GET', `**/projects/${projectId}/year-summary/*`, (request) => {
      const year = parseYear(request.url.split('/').pop()?.split('?')[0], currentYear);
      request.alias = getYearSummaryAlias(year);

      request.reply({
        totalBudget: 1000,
        totalSpend: year === currentYear ? 230 : 0,
        totalOverspend: 0,
        totalRemaining: year === currentYear ? 770 : 0,
        totalEarned: year === currentYear ? 1200 : 0
      });
    });

    cy.intercept('GET', `**/projects/${projectId}/overview/annual/*/expenses-by-category`, (request) => {
      const year = parseYear(request.url.split('/').at(-2), currentYear);
      request.alias = getAnnualExpensesByCategoryAlias(year);

      request.reply(year === currentYear
        ? [{ name: 'Taxes', amount: 230 }]
        : []);
    });

    cy.intercept('GET', `**/projects/${projectId}/incomes?*`, (request) => {
      const requestUrl = new URL(request.url);
      const year = parseYear(requestUrl.searchParams.get('from')?.split('-')[0], currentYear);
      request.alias = getIncomesAlias(year);
      request.reply([]);
    });

    cy.intercept('GET', `**/projects/${projectId}/categories?*`, (request) => {
      const requestUrl = new URL(request.url);
      const year = parseYear(requestUrl.searchParams.get('from')?.split('-')[0], currentYear);
      request.alias = getCategoriesAlias(year);

      request.reply(createCategoriesResponse(year));
    });

    cy.intercept('GET', `**/projects/${projectId}/categories/category-1`, {
      id: 'category-1',
      name: 'Taxes',
      isArchived: false,
      expenses: []
    }).as('getCategoryById');

    cy.intercept('GET', `**/projects/${projectId}/categories/category-1/expenses?*`, createCategoriesResponse(currentYear)[0]?.expenses ?? []).as('getCategoryExpenses');
    cy.intercept('GET', `**/projects/${projectId}/categories/category-1/expenses/expense-1`, {
      id: 'expense-1',
      date: `${currentYear}-02-10`,
      name: 'Accountant fee',
      budget: 200,
      amount: 150,
      isDeductible: true,
      attachments: [
        {
          id: 'proof-1',
          name: 'invoice.pdf',
          attachmentType: 'DeductibleProof'
        }
      ],
      items: []
    }).as('getExpenseById');
    cy.intercept('GET', `**/projects/${projectId}/categories/category-1/expenses/expense-2`, {
      id: 'expense-2',
      date: `${currentYear}-03-10`,
      name: 'Business lunch',
      budget: 120,
      amount: 80,
      isDeductible: true,
      attachments: [],
      items: [
        {
          id: 'expense-item-1',
          date: `${currentYear}-01-05`,
          name: 'Taxi receipt',
          amount: 30,
          isDeductible: true,
          attachments: []
        }
      ]
    }).as('getExpenseWithItemById');
  };

  const waitForAnnualOverviewRequests = (year: number) => {
    cy.wait(`@${getYearSummaryAlias(year)}`);
    cy.wait(`@${getAnnualExpensesByCategoryAlias(year)}`);
    cy.wait(`@${getCategoriesAlias(year)}`);
    cy.wait(`@${getIncomesAlias(year)}`);
  };

  const visitAnnualOverview = (projectId: string, year: number) => {
    cy.visit(`/projects/${projectId}/overview/annual?year=${year}`);
    waitForAnnualOverviewRequests(year);
  };

  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;
      cy.login(user.username, user.password);
    });
  });

  it('should load deductible list for default selected year', () => {
    cy.fixture('projects').then((projects) => {
      const projectId = projects.defaultProject.id;
      setupAnnualOverviewStubs(projectId);

      visitAnnualOverview(projectId, currentYear);

      cy.get('[data-testid="deductible-overview-section"]').should('be.visible');
      cy.get('[data-testid="deductible-table"]').should('be.visible');
      cy.get('[data-testid="deductible-total-count"]').should('contain', '3');
    });
  });

  it('should refresh deductible data when changing year', () => {
    cy.fixture('projects').then((projects) => {
      const projectId = projects.defaultProject.id;
      setupAnnualOverviewStubs(projectId);

      visitAnnualOverview(projectId, currentYear);

      cy.get('app-current-date #previous').click();
      cy.wait(`@${getYearSummaryAlias(previousYear)}`).then(({ request }) => {
        expect(request.url).to.include(`/year-summary/${previousYear}`);
      });
      cy.wait(`@${getAnnualExpensesByCategoryAlias(previousYear)}`);
      cy.wait(`@${getCategoriesAlias(previousYear)}`);
      cy.wait(`@${getIncomesAlias(previousYear)}`);

      cy.get('[data-testid="deductible-empty"]').should('be.visible');
    });
  });

  it('should open expense edit modal from deductible actions', () => {
    cy.fixture('projects').then((projects) => {
      const projectId = projects.defaultProject.id;
      setupAnnualOverviewStubs(projectId);

      visitAnnualOverview(projectId, currentYear);

      cy.contains('tr', 'Accountant fee')
        .find('[data-testid="deductible-open-expense"]')
        .click();
      cy.wait('@getExpenseById');
      cy.get('.mat-mdc-dialog-container', { timeout: 10000 }).should('be.visible');
      cy.url().should('include', `(modal:projects/${projectId}/add-expense)`);
      cy.url().should('include', 'categoryId=category-1');
      cy.url().should('include', 'expenseId=expense-1');
      cy.get('input[formControlName="name"]').should('have.value', 'Accountant fee');
    });
  });

  it('should open expense item edit modal from deductible actions', () => {
    cy.fixture('projects').then((projects) => {
      const projectId = projects.defaultProject.id;
      setupAnnualOverviewStubs(projectId);

      visitAnnualOverview(projectId, currentYear);

      cy.contains('tr', 'Taxi receipt (Business lunch)')
        .find('[data-testid="deductible-open-expense"]')
        .click();
      cy.wait('@getExpenseWithItemById');
      cy.get('.mat-mdc-dialog-container', { timeout: 10000 }).should('be.visible');
      cy.url().should('include', `(modal:projects/${projectId}/add-expense-item)`);
      cy.url().should('include', 'categoryId=category-1');
      cy.url().should('include', 'expenseId=expense-2');
      cy.url().should('include', 'expenseItemId=expense-item-1');
      cy.get('input[formControlName="name"]').should('have.value', 'Taxi receipt');
    });
  });

  it('should display proof indicators for rows with and without attachment', () => {
    cy.fixture('projects').then((projects) => {
      const projectId = projects.defaultProject.id;
      setupAnnualOverviewStubs(projectId);

      visitAnnualOverview(projectId, currentYear);

      cy.get('[data-testid="deductible-proof-yes"]').should('have.length', 1);
      cy.get('[data-testid="deductible-proof-no"]').should('have.length', 2);
    });
  });
});
