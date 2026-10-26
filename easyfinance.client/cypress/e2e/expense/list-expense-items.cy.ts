import { dayOfMonth, IsolatedProject, Month, monthOf } from '../../support/isolated-project';

describe('EconoFlow - expense item list Tests', () => {
  interface ExpensePatchOperation {
    op: string;
    path: string;
    value?: boolean | number | string | string[] | null;
  }

  const toDateKey = (value: unknown): string | null => {
    if (!value) {
      return null;
    }

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`;
  };

  /**
   * A date as the material datepicker input accepts it.
   *
   * The input renders `M/D/YYYY` for en (it shows `10/8/2026`); typing any other order
   * leaves the control invalid, no PATCH is sent, and the test then fails on a missing
   * request instead of on the behaviour it checks.
   */
  const typedDate = (month: Month, day: number): string =>
    new Date(month.year, month.month - 1, day)
      .toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });

  /**
   * The project, category and expense this spec works on.
   *
   * It used to open the seeded "Family" project and look for an expense called
   * "Groceries", editing "the last item" of it. Every test then depended on how many
   * items that shared expense happened to have and on their order - and the earlier
   * tests in this file were themselves adding, re-dating and renaming items.
   */
  let projectId = '';
  let categoryId = '';
  let expenseId = '';
  let itemIds: string[] = [];
  let thisMonth: Month;

  beforeEach(() => {
    thisMonth = monthOf(new Date());

    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')
      cy.login(user.username, user.password)

      // One expense dated the 8th, then its two items added the way the application adds
      // them: a PATCH whose `items` array is the full list. Creating an expense with
      // nested `items` is rejected (the items carry their creator as a required field),
      // so this follows the path the UI itself uses.
      cy.createIsolatedProject([], { days: [{ month: thisMonth, day: 8 }] }).then((project: IsolatedProject) => {
        projectId = project.id;
        categoryId = project.category.id;
        expenseId = project.expenses[0].id;

        cy.request('PATCH', `/api/Projects/${projectId}/Categories/${categoryId}/Expenses/${expenseId}`, [
          {
            op: 'add',
            path: '/items',
            value: [
              { name: 'First item', date: dayOfMonth(thisMonth, 9), amount: 100 },
              { name: 'Second item', date: dayOfMonth(thisMonth, 10), amount: 200 }
            ]
          }
        ]).then(({ status, body }) => {
          expect(status, 'adding the expense items').to.equal(200);

          itemIds = (body.items as { id: string }[]).map(item => item.id);
          expect(itemIds, 'the expense has its two items').to.have.length(2);

          cy.visit(`/projects/${projectId}/categories/${categoryId}/expenses`);

          // Expand the expense once the list has settled.
          //
          // The loading overlay can appear *after* the rows do - the page renders, then a
          // background refresh starts, and the overlay covers the row again. Waiting for the
          // spinner to be absent and for the row to exist does not cover that order, and the
          // click lands under the overlay ("is being covered by another element").
          cy.clickWhenLoaderGone('.btn-link')


        })
      })
    })
  })

  it('should update name after success update', () => {
    const value = `name_${Math.random()}`;

    cy.get('button[name=edit-sub]').last().click()
    cy.intercept('GET', '**/expenses*').as('getExpenses')
    cy.get('input[formControlName=name]').clear().type(`${value}{enter}`)

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      expect(request.url, 'the edited expense').to.include(`/expenses/${expenseId}`)

      cy.wait('@getExpenses')

      cy.get('.name-sub').should('contain', value)
    })
  })

  it('should update date after success update', () => {
    // The parent expense is on the 8th, so the item can move to the 7th and stay inside the
    // same month. A date in another month is rejected by the backend - that is the point of
    // the next test, not of this one.
    const targetDay = 7;
    const targetIso = dayOfMonth(thisMonth, targetDay);

    cy.get('button[name=edit-sub]').first().click()

    cy.intercept('GET', '**/expenses*').as('getExpenses')

    cy.get('input[formControlName=date]').clear().type(`${typedDate(thisMonth, targetDay)}{enter}`)

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      const operations = request.body as unknown as ExpensePatchOperation[];
      const dateOperation = operations.find(operation => /\/items\/\d+\/date$/i.test(operation.path));

      expect(toDateKey(dateOperation?.value), 'the PATCH carries the date').to.not.equal(null);
      expect(String(dateOperation?.value).slice(0, 10), 'the PATCH persists the chosen day')
        .to.equal(targetIso);

      cy.wait<ExpenseReq, ExpenseRes[]>('@getExpenses').then(({ response: getExpensesResponse }) => {
        const updatedExpense = getExpensesResponse?.body.find(expense => expense.id === expenseId);
        expect(updatedExpense, 'the edited expense').to.not.equal(undefined);

        const updatedItem = updatedExpense?.items.find(item => toDateKey((item as { date?: string | Date }).date) === toDateKey(targetIso));
        expect(updatedItem, `an item is now dated ${targetIso}`).to.not.equal(undefined);
      })
    })
  })

  it('should show error after failed update', () => {
    // An expense item cannot be moved to a different month than its parent expense.
    const nextMonth: Month = thisMonth.month === 12
      ? { year: thisMonth.year + 1, month: 1 }
      : { year: thisMonth.year, month: thisMonth.month + 1 };

    cy.get('button[name=edit-sub]').first().click()

    cy.get('input[formControlName=date]').clear().type(`${typedDate(nextMonth, 1)}{enter}`)

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
      const operations = request.body as unknown as ExpensePatchOperation[];
      const amountOperation = operations.find(operation => /\/items\/\d+\/amount$/i.test(operation.path));
      const targetAmount = Number(amountOperation?.value);
      const itemIndexMatch = amountOperation?.path.match(/\/items\/(\d+)\/amount/i);
      const itemIndex = itemIndexMatch ? Number(itemIndexMatch[1]) : -1;
      const editedExpenseId = request.url.match(/\/expenses\/([^/?]+)/)?.[1] ?? '';

      expect(Number.isFinite(targetAmount)).to.equal(true);
      expect(itemIndex).to.be.greaterThan(-1);
      expect(editedExpenseId, 'the edited expense').to.equal(expenseId);

      cy.wait<ExpenseReq, ExpenseRes[]>('@getExpenses').then(({ response: getExpensesResponse }) => {
        const updatedExpense = getExpensesResponse?.body.find(expense => expense.id === editedExpenseId);
        expect(updatedExpense).to.not.equal(undefined);
        expect(updatedExpense?.items[itemIndex]?.amount).to.equal(targetAmount);
      })

    })
  })
})
