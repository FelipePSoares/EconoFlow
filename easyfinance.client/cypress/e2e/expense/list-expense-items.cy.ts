describe('EconoFlow - expense item list Tests', () => {
  interface ExpensePatchOperation {
    op: string;
    path: string;
    value?: boolean | number | string | string[] | null;
  }

  const buildDateVariants = (value: Date, locale: string): string[] => {
    const fullYear = value.toLocaleDateString(locale, { year: 'numeric', month: 'numeric', day: 'numeric' });
    const shortYear = value.toLocaleDateString(locale, { year: '2-digit', month: 'numeric', day: 'numeric' });
    return Array.from(new Set([fullYear, shortYear]));
  };

  beforeEach(() => {
    cy.intercept('GET', '**/expenses?*').as('getExpense')

    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')
      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        const project = projects.defaultProject;
        cy.fixture('categories').then((categories) => {
          cy.fixture('expenses').then((expenses) => {
            const defaultExpense = expenses.defaultExpense;
            const category = categories.defaultCategory;

            cy.visit('/projects/' + project.id + '/categories/' + category.id + '/expenses')

            cy.wait<ExpenseReq, ExpenseRes[]>('@getExpense').then(({ response }) => {
              console.log(response?.body);
              const index = response?.body.findIndex(element => element.name === defaultExpense.name);

              cy.get('.btn-link').eq(index).click()
            })
          })
        })
      })
    })
  })

  afterEach(function () {
    if (this.currentTest.title === 'should update date after success update') {
      if (new Date().getDate() == 1) {
        let formattedDate = ''
        cy.get('button[name=edit]').first().click()
        const today = new Date()

        cy.window().then((win) => {
          const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
          formattedDate = today.toLocaleDateString(locale)
          cy.get('input[formControlName=date]').clear().type(`${formattedDate}{enter}`)
        })
      }
    }
  })

  it('should update name after success update', () => {
    const value = `name_${Math.random()}`;

    cy.get('button[name=edit-sub]').last().click()
    cy.intercept('GET', '**/expenses*').as('getExpenses')
    cy.get('input[formControlName=name]').clear().type(`${value}{enter}`)

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ response }) => {
      expect(response?.statusCode).to.equal(200)

      cy.wait('@getExpenses')

      cy.get('.name-sub').contains(`${value}`)
    })
  })

  it('should update date after success update', () => {
    const firstDayCandidate = new Date();
    firstDayCandidate.setDate(1);
    const secondDayCandidate = new Date();
    secondDayCandidate.setDate(2);

    let expectedDates: string[] = []

    cy.get('button[name=edit-sub]').last().click()

    cy.intercept('GET', '**/expenses*').as('getExpenses')

    if (new Date().getDate() == 1)
      cy.get('input[formControlName=amount]').clear().type(`0`)

    cy.window().then((win) => {
      const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
      const firstDayVariants = buildDateVariants(firstDayCandidate, locale)

      cy.get('input[formControlName=date]').invoke('val').then((currentValue) => {
        const currentDateValue = String(currentValue ?? '').trim()
        const shouldUseSecondDay = firstDayVariants.includes(currentDateValue)
        const targetDate = shouldUseSecondDay ? secondDayCandidate : firstDayCandidate

        expectedDates = buildDateVariants(targetDate, locale)
        cy.get('input[formControlName=date]').clear().type(`${targetDate.toLocaleDateString(locale)}{enter}`)
      })
    })

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ response }) => {
      expect(response?.statusCode).to.equal(200)

      cy.wait('@getExpenses')

      cy.get('.date-sub').invoke('text').then((text) => {
        const hasExpectedDate = expectedDates.some(date => text.includes(date))
        expect(hasExpectedDate).to.equal(true)
      })
    })
  })

  it('should show error after failed update', () => {
    const today = new Date()
    today.setMonth(today.getMonth() + 1);
    let formattedDate = ''

    cy.get('button[name=edit-sub]').first().click()

    cy.window().then((win) => {
      const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
      formattedDate = today.toLocaleDateString(locale)
      cy.get('input[formControlName=date]').clear().type(`${formattedDate}{enter}`)
    })

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ response }) => {
      expect(response?.statusCode).to.equal(400)
      cy.get('mat-error').should('have.text', 'Can\u0027t add an expense item with different year or month from expense')
    })
  })

  it('should update amount after success update', () => {
    let value = 12345;
    const fallbackValue = 23456;

    cy.get('button[name=edit-sub]').first().click()

    cy.intercept('GET', '**/expenses*').as('getExpenses')

    cy.get('input[formControlName=amount]').invoke('val').then((currentValue) => {
      const currentNormalized = String(currentValue ?? '').replace(/\./g, '').replace(',', '.')
      const currentAsNumber = Number(currentNormalized.replace(/[^\d.-]/g, ''))
      const expectedAmount = value / 100;

      if (Number.isFinite(currentAsNumber) && currentAsNumber === expectedAmount) {
        value = fallbackValue;
      }

      cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)
    })

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      const operations = request.body as ExpensePatchOperation[];
      const amountOperation = operations.find(operation => /\/items\/\d+\/amount$/i.test(operation.path));
      const targetAmount = Number(amountOperation?.value);
      const itemIndexMatch = amountOperation?.path.match(/\/items\/(\d+)\/amount/i);
      const itemIndex = itemIndexMatch ? Number(itemIndexMatch[1]) : -1;
      const expenseId = request.url.match(/\/expenses\/([^/?]+)/)?.[1] ?? '';

      expect(Number.isFinite(targetAmount)).to.equal(true);
      expect(itemIndex).to.be.greaterThan(-1);
      expect(expenseId).to.not.equal('');

      cy.wait<ExpenseReq, ExpenseRes[]>('@getExpenses').then(({ response: getExpensesResponse }) => {
        const updatedExpense = getExpensesResponse?.body.find(expense => expense.id === expenseId);
        expect(updatedExpense).to.not.equal(undefined);
        expect(updatedExpense?.items[itemIndex]?.amount).to.equal(targetAmount);
      })

    })
  })
})
