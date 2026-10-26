import { dayOfMonth, IsolatedExpense, IsolatedProject, Month, monthOf } from '../../support/isolated-project';

describe('EconoFlow - expense list Tests', () => {
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

    /**
     * The project this spec works on.
     *
     * It used to be the seeded "Family" project, shared by every spec and every run: each
     * test renamed and re-dated "the first expense", so the order and the dates the later
     * tests saw depended on what the earlier ones had just done. Here the spec owns the
     * project, the category, and exactly three expenses in the current month.
     */
    let projectId = '';
    let categoryId = '';
    let expenseIds: string[] = [];
    let thisMonth: Month;

    beforeEach(() => {
      thisMonth = monthOf(new Date());

      cy.fixture('users').then((users) => {
        const user = users.testUser;

        cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')
        cy.login(user.username, user.password)

        cy.createIsolatedProject([], {
          days: [8, 9, 10].map(day => ({ month: thisMonth, day }))
        }).then((project: IsolatedProject) => {
          projectId = project.id;
          categoryId = project.category.id;
          expenseIds = project.expenses.map((expense: IsolatedExpense) => expense.id);

          cy.visit(`/projects/${projectId}/categories/${categoryId}/expenses`);
        })
      })
    })

    /**
     * A date as the material datepicker input accepts it for the current locale.
     *
     * The input renders `M/D/YYYY` for `en` (it showed `10/8/2026`), and typing any other
     * order leaves the control invalid - the typed value is rejected, no PATCH is sent, and
     * the test fails on a missing request rather than on the behaviour it is checking.
     */
    const typedDate = (month: Month, day: number): string =>
      new Date(month.year, month.month - 1, day)
        .toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });

    /** The expense the list shows first, which is the one every test edits. */
    const firstExpenseId = (): string => expenseIds[0];

    it('should update name after success update', () => {
      const value = `name_${Math.random()}`;

      cy.get('button[name=edit]').first().click()
      cy.intercept('GET', '**/expenses*').as('getExpenses')
      cy.get('input[formControlName=name]').clear().type(`${value}{enter}`)

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        expect(request.url, 'the edited expense').to.include(`/expenses/${firstExpenseId()}`)

        cy.wait('@getExpenses')

        cy.get('.name').first().should('contain', value)
      })
    })

    it('should update date after success update', () => {
      // The three expenses are on the 8th, 9th and 10th, so moving the first one to the
      // 11th keeps every test's "first row" the same and stays inside the month the list
      // shows - a date outside the month would filter the expense out of the list instead
      // of reordering it.
      const targetDay = 11;
      const targetIso = dayOfMonth(thisMonth, targetDay);

      cy.get('button[name=edit]').first().click()
      cy.intercept('GET', '**/expenses*').as('getExpenses')

      cy.get('input[formControlName=date]')
        .clear()
        .type(`${typedDate(thisMonth, targetDay)}{enter}`)

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)

        const operations = request.body as unknown as ExpensePatchOperation[]
        const dateOperation = operations.find(operation => operation.path?.toLowerCase() === '/date')

        expect(dateOperation, 'the PATCH carries the date').to.not.equal(undefined)
        expect(String(dateOperation?.value).slice(0, 10), 'the PATCH persists the chosen day')
          .to.equal(targetIso)

        cy.wait('@getExpenses')
      })

      // The expense is still in the month, so it is still listed: its row now shows the new
      // day. The rendered format is locale-dependent, so the day is read back through the
      // element's own date text rather than compared as a literal string.
      cy.window().then((win) => {
        const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
        const formatted = new Date(thisMonth.year, thisMonth.month - 1, targetDay)

        return cy.get('.date').should(($dates) => {
          const texts = $dates.toArray().map(el => el.textContent?.trim() ?? '')
          const expectedShapes = buildDateVariants(formatted, locale)

          expect(
            texts.some(text => expectedShapes.some(shape => text.includes(shape))),
            `one row shows ${expectedShapes.join(' / ')}; rows: ${texts.join(' | ')}`
          ).to.equal(true)
        })
      })
    })

    it('should show error after failed update', () => {
      // The backend refuses an amount on an expense dated in the future.
      const nextMonth: Month = thisMonth.month === 12
        ? { year: thisMonth.year + 1, month: 1 }
        : { year: thisMonth.year, month: thisMonth.month + 1 };

      cy.get('button[name=edit]').first().click()

      cy.get('input[formControlName=amount]').clear().type(`2`)

      cy.get('input[formControlName=date]')
        .clear()
        .type(`${typedDate(nextMonth, 1)}{enter}`)

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ response }) => {
        expect(response?.statusCode).to.equal(400)
        cy.get('mat-error').should('have.text', 'A future expense can\u0027t have a amount')
      })
    })

    it('should update budget after success update', () => {
      const value = Math.floor(Math.random() * 1000);

      cy.get('button[name=edit]').first().click()
      cy.get('input[formControlName=budget]').clear().type(`${value}{enter}`)

      cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        expect(request.url, 'the edited expense').to.include(`/expenses/${firstExpenseId()}`)
        cy.get('.budget').first().should('contain', `${value}`)
      })
    })

    it('should update amount after success update', () => {
      let value = 12345;
      const fallbackValue = 23456;

      cy.get('button[name=edit]').first().click()
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
        const operations = request.body as unknown as ExpensePatchOperation[];
        const amountOperation = operations.find(operation => operation.path?.toLowerCase() === '/amount');
        const targetAmount = Number(amountOperation?.value);
        const expenseId = request.url.match(/\/expenses\/([^/?]+)/)?.[1] ?? '';

        expect(Number.isFinite(targetAmount)).to.equal(true);
        expect(expenseId).to.equal(firstExpenseId());

        cy.wait<ExpenseReq, ExpenseRes[]>('@getExpenses').then(({ response: getExpensesResponse }) => {
          const updatedExpense = getExpensesResponse?.body.find(expense => expense.id === expenseId);
          expect(updatedExpense).to.not.equal(undefined);
          expect(updatedExpense?.amount).to.equal(targetAmount);
        })

      })
    })
})
