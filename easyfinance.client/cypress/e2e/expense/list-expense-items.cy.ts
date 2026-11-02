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

  /**
   * The expense's day and its two items' days.
   *
   * They used to be hard-coded to the 8th (expense), 9th and 10th (items). An expense item
   * may not be dated in the future either - the same `A future expense can't have a amount`
   * rule applies to `Items.Date` - so from the 1st to the 7th of every month the fixture
   * itself was rejected and the whole spec failed in its "before each" hook, before reaching
   * the behaviour under test.
   *
   * The days are laid out backwards from today instead: the two items take the two days
   * before today, and the expense takes the day before them. That keeps all three in the
   * current month, none of them in the future, every item on or before its expense (an item
   * may not be dated after the expense it belongs to), and the two items distinct. On the 1st
   * of the month the items share the only day available.
   */
  const expenseDay = (): number => Math.max(1, new Date().getDate() - 2);

  const itemDays = (): number[] => {
    const today = new Date().getDate();
    return today > 2 ? [today - 1, today] : [1, Math.min(2, today)];
  };

  /** The day the first item is moved to: the expense's day, the latest valid date for an item. */
  const movedToDay = (): number => expenseDay();

  beforeEach(() => {
    thisMonth = monthOf(new Date());

    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.intercept('PATCH', '**/expenses/*').as('patchExpenses')
      cy.login(user.username, user.password)

      // One expense in the current month, then its two items added the way the application
      // adds them: a PATCH whose `items` array is the full list. Creating an expense with
      // nested `items` is rejected (the items carry their creator as a required field),
      // so this follows the path the UI itself uses.
      cy.createIsolatedProject([], { days: [{ month: thisMonth, day: expenseDay() }] }).then((project: IsolatedProject) => {
        projectId = project.id;
        categoryId = project.category.id;
        expenseId = project.expenses[0].id;

        const itemDates = itemDays().map(day => dayOfMonth(thisMonth, day));

        cy.request('PATCH', `/api/Projects/${projectId}/Categories/${categoryId}/Expenses/${expenseId}`, [
          {
            op: 'add',
            path: '/items',
            value: [
              { name: 'First item', date: itemDates[0], amount: 100 },
              { name: 'Second item', date: itemDates[1], amount: 200 }
            ]
          }
        ]).then(({ status, body }) => {
          expect(status, 'adding the expense items').to.equal(200);

          itemIds = (body.items as { id: string }[]).map(item => item.id);
          expect(itemIds, 'the expense has its two items').to.have.length(2);

          cy.visit(`/projects/${projectId}/categories/${categoryId}/expenses`);

          // Re-open the expansion for every test: opening an editor COLLAPSES it, so the second
          // test onwards would otherwise find no rows to edit and type into nothing.
          //
          // This is also why every edit goes through `openEditorFor`, which asserts that the
          // inline editor that appeared belongs to the expense this spec seeded. Cy's built-in
          // existence check has a second and a half to see the sublist render; without it a test
          // can type into the PARENT expense's editor and wait forever for a PATCH about an item.
          cy.clickWhenLoaderGone('.btn-link')

          cy.get('button[name=edit-sub]').should('have.length', 2)
        })
      })
    })
  })

  /**
   * Opens the inline editor of one of this expense's items and checks it is the right one.
   *
   * `position` is which of the two items to edit. The editor must belong to an item of the
   * seeded expense: if the sublist has not rendered yet, `first()` resolves to the parent
   * expense's own edit button, and every following assertion in the test then waits on a PATCH
   * that can never arrive for an item. Asserting `itemIds` here fails fast and names the cause.
   */
  const openEditorFor = (position: 'first' | 'last'): Cypress.Chainable => {
    return cy
      .get('button[name=edit-sub]')[position]()
      .click()
      .then(() => cy.get('app-expense-item form').should('have.length', 1))
      .then(() => {
        cy.get('input[formControlName=name]')
          .invoke('val')
          .should('be.oneOf', ['First item', 'Second item']);
      });
  };

  /** The item the editor is open for, by the name the fixture gave it. */
  const editedItemName = (): Cypress.Chainable<string> =>
    cy.get('input[formControlName=name]').invoke('val').then(name => String(name));

  /**
   * Submits the inline item editor.
   *
   * The item form is inline inside the expense row: it saves on form submission, not on a key
   * press. `{enter}` inside an input only submits a form that is already valid, and a date typed
   * into a material datepicker control is not committed until the control loses focus or the
   * form is submitted. Every test in this spec typed `{enter}` and relied on that.
   */
  const submitItemEditor = (): Cypress.Chainable => cy.get('app-expense-item form').submit();

  it('should update name after success update', () => {
    const value = `name_${Math.random()}`;

    openEditorFor('last')
    cy.intercept('GET', '**/expenses*').as('getExpenses')
    cy.get('input[formControlName=name]').clear().type(value)
    submitItemEditor()

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      expect(request.url, 'the edited expense').to.include(`/expenses/${expenseId}`)

      cy.wait('@getExpenses')

      cy.get('.name-sub').should('contain', value)
    })
  })

  it('should update date after success update', () => {
    // The first item is moved to the day of the expense itself: inside the same month, in the
    // past, and never after the expense it belongs to. A date in another month is rejected by
    // the backend - that is the point of the next test, not of this one.
    //
    // Moving the FIRST item onto the LAST item's day is what the test used to do. The fixture
    // puts the items on consecutive days, so that is a move forwards - and an item may not be
    // dated after the expense it belongs to, so the backend answered 400 and the PATCH never
    // arrived. The expense's own day is the latest valid date for an item, and it is always in
    // the past, because the fixture clamps the expense to a day that has already happened.
    const targetDay = movedToDay();
    const targetIso = dayOfMonth(thisMonth, targetDay);

    openEditorFor('first').then(() => {
      editedItemName().then(itemName => {
        cy.intercept('GET', '**/expenses*').as('getExpenses')

        cy.get('input[formControlName=date]').clear().type(typedDate(thisMonth, targetDay))
        submitItemEditor()

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

            // The item that was edited, by name: the fixture's days may coincide at the start of
            // a month, so finding "the item dated targetIso" could match the wrong one.
            const editedItem = updatedExpense?.items.find(item => item.name === itemName);
            expect(editedItem, `the edited item is still in the expense`).to.not.equal(undefined);
            expect(toDateKey((editedItem as { date?: string | Date }).date), `the edited item is dated ${targetIso}`)
              .to.equal(toDateKey(targetIso));
          })
        })
      })
    })
  })

  it('should show error after failed update', () => {
    // An expense item cannot be moved to a different month than its parent expense.
    const nextMonth: Month = thisMonth.month === 12
      ? { year: thisMonth.year + 1, month: 1 }
      : { year: thisMonth.year, month: thisMonth.month + 1 };

    openEditorFor('first')

    cy.get('input[formControlName=date]').clear().type(typedDate(nextMonth, 1))
    submitItemEditor()

    cy.wait<ExpenseReq, ExpenseRes>('@patchExpenses').then(({ response }) => {
      expect(response?.statusCode).to.equal(400)
      cy.get('mat-error').should('have.text', 'Can\u0027t add an expense item with different year or month from expense')
    })
  })

  it('should update amount after success update', () => {
    let value = 12345;
    const fallbackValue = 23456;

    openEditorFor('first')

    cy.intercept('GET', '**/expenses*').as('getExpenses')

    cy.get('input[formControlName=amount]').invoke('val').then((currentValue) => {
      const currentNormalized = String(currentValue ?? '').replace(/\./g, '').replace(',', '.')
      const currentAsNumber = Number(currentNormalized.replace(/[^\d.-]/g, ''))
      const expectedAmount = value / 100;

      if (Number.isFinite(currentAsNumber) && currentAsNumber === expectedAmount) {
        value = fallbackValue;
      }

      cy.get('input[formControlName=amount]').clear().type(`${value}`)
      submitItemEditor()
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
