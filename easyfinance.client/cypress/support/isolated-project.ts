/**
 * Isolated fixtures for the end-to-end specs.
 *
 * The specs used to run against `projects.defaultProject` — the project the development
 * seeder creates — and then reason about "the first expense", "the month that has no
 * expenses" and "how many requests this raises". That data is shared by every spec and
 * every run, and `cy.request` calls in the suite keep adding to it, so those assumptions
 * drift: a month that had no expenses in one run has some in the next, a renamed expense
 * moves to the top of the list, and two expenses share a name inside one month.
 *
 * Each spec that needs specific data now builds its own project through the API and works
 * only with the ids it created. Nothing else in the database can change the outcome.
 *
 * The created project is left behind: the suite runs against a throwaway database, and
 * deleting it would only add a failure mode to the teardown.
 */

/** Currency used for the generated projects; the UI tests pick their own. */
const ISOLATED_PROJECT_CURRENCY = 'EUR';

const uuid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** A month, as the application receives it: `yyyy-MM`. */
export interface Month {
  year: number;
  month: number; // 1-12
}

export const monthOf = (date: Date): Month => ({ year: date.getFullYear(), month: date.getMonth() + 1 });

/** `yyyy-MM`, the format the `month` query parameter uses. */
export const monthValue = (month: Month): string =>
  `${month.year}-${String(month.month).padStart(2, '0')}`;

/** The first day of a month as `yyyy-MM-dd`, built from local parts (never `toISOString`). */
export const monthStart = (month: Month): string => `${monthValue(month)}-01`;

/** A fixed day inside a month, as `yyyy-MM-dd`, from local parts. */
export const dayOfMonth = (month: Month, day: number): string =>
  `${monthValue(month)}-${String(day).padStart(2, '0')}`;

/** `month` shifted by `offset` months. */
export const shiftMonth = (month: Month, offset: number): Month => {
  const shifted = new Date(month.year, month.month - 1 + offset, 1);
  return monthOf(shifted);
};

/**
 * The day of the month that a date written "`day` of `month`" must use to be accepted.
 *
 * <p>
 * The backend refuses any expense or expense item dated in the future
 * (`A future expense can't have a amount`), with "future" measured by the SERVER's clock.
 * A spec that hard-codes a day of the current month is therefore only correct until the
 * month reaches it: writing the 8th works on the 8th of November, and on the 2nd it is
 * six days out and the POST/PATCH answers 400. That is what broke these specs on the 1st
 * of every month.
 * </p>
 *
 * <p>
 * Clamping to today (and never below the 1st) keeps the date inside the month the specs
 * reason about - and keeps it valid whichever clock is ahead, the browser's or the
 * server's. When `day` has already passed, the clamp silently chooses today instead;
 * that is what this returns, so callers compare against it rather than against `day`.
 * </p>
 */
export const safeDayOfMonth = (month: Month, day: number, today: Date = new Date()): number => {
  const isThisMonth = today.getFullYear() === month.year && today.getMonth() + 1 === month.month;
  const latestAllowed = isThisMonth ? today.getDate() : daysInMonth(month);
  return Math.max(1, Math.min(day, latestAllowed));
};

/**
 * A run of `count` consecutive days that have already happened, ending no later than today.
 *
 * <p>
 * For specs that need several days laid out in order, with a day left over after the last.
 * Clamping each day on its own is not enough: on the 2nd, "the 8th, 9th and 10th clamped"
 * are 2, 2 and 2, which is neither ordered nor something later assertions can tell apart.
 * The run is built backwards from today instead, so it is `count` distinct consecutive days
 * in the current month and none of them is in the future.
 * </p>
 *
 * <p>
 * The start of the month has fewer days behind it than the run needs. It then returns as
 * many distinct days as exist (`[1]`, or `[1, 2]`) rather than repeating one, so callers that
 * need exactly `count` days must check the length they got back.
 * </p>
 */
export const previousDays = (today: Date = new Date(), count: number): number[] => {
  const available = Math.max(0, today.getDate() - 1);
  const days = Math.min(count, available);
  return Array.from({ length: days }, (_, index) => today.getDate() - days + index);
};

const daysInMonth = (month: Month): number => new Date(month.year, month.month, 0).getDate();

/** `dayOfMonth` clamped with {@link safeDayOfMonth}, as `yyyy-MM-dd`. */
export const safeDateOfMonth = (month: Month, day: number, today: Date = new Date()): string =>
  dayOfMonth(month, safeDayOfMonth(month, day, today));

export interface IsolatedExpense {
  id: string;
  name: string;
  date: string;
}

export interface IsolatedCategory {
  id: string;
  name: string;
}

export interface IsolatedProject {
  id: string;
  name: string;
  category: IsolatedCategory;
  /** The expenses created for this project, in creation order. */
  expenses: IsolatedExpense[];
}

export interface IsolatedProjectOptions {
  /** Days of the month to give an expense to; defaults to one expense per month. */
  days?: { month: Month; day: number }[];
  /** How many categories to create; the first is the one used by the default tests. */
  categories?: number;
}

/**
 * Creates a project with its own category and expenses, and hands back the ids.
 *
 * @example
 * cy.createIsolatedProject([thisMonth, lastMonth]).then(({ id, category, expenses }) => {
 *   cy.visit(`/projects/${id}/overview/monthly?month=${monthValue(thisMonth)}`);
 * });
 */
export function createIsolatedProject(
  months: Month[],
  options: IsolatedProjectOptions = {}
): Cypress.Chainable<IsolatedProject> {
  const suffix = uuid();
  const projectName = `Isolated ${suffix}`;
  const categoryCount = Math.max(1, options.categories ?? 1);
  const days = options.days ?? months.map(month => ({ month, day: 10 }));
  const categories: IsolatedCategory[] = [];
  const expenses: IsolatedExpense[] = [];

  let projectId = '';

  const createExpenses = (): Cypress.Chainable<IsolatedProject> => {
    if (days.length === 0) {
      return cy.wrap({
        id: projectId,
        name: projectName,
        category: categories[0],
        expenses
      });
    }

    const next = days[0];
    // Clamped: the backend refuses a future date, so a hard-coded day of the current month
    // silently breaks this factory from that day of the month onwards.
    const date = safeDateOfMonth(next.month, next.day);

    return cy
      .request('POST', `/api/Projects/${projectId}/Categories/${categories[0].id}/Expenses`, {
        name: `Expense ${date}`,
        date,
        amount: 100,
        budget: 150
      })
      .then(({ status, body }) => {
        expect(status, 'creating an isolated expense').to.equal(201);
        expenses.push({ id: body.id, name: body.name, date: body.date });
        days.splice(0, 1);
        return createExpenses();
      });
  };

  const createCategories = (): Cypress.Chainable<IsolatedProject> => {
    if (categories.length >= categoryCount) {
      return createExpenses();
    }

    const index = categories.length;

    return cy
      .request('POST', `/api/Projects/${projectId}/Categories`, {
        name: index === 0 ? `Category ${suffix}` : `Category ${suffix} ${index + 1}`,
        displayOrder: index
      })
      .then(({ status, body }) => {
        expect(status, 'creating an isolated category').to.equal(201);
        categories.push({ id: body.id, name: body.name });
        return createCategories();
      });
  };

  return cy
    .request('POST', '/api/Projects', {
      name: projectName,
      preferredCurrency: ISOLATED_PROJECT_CURRENCY
    })
    .then(({ status, body }) => {
      expect(status, 'creating an isolated project').to.equal(201);
      projectId = body.project?.id ?? body.id;
      expect(projectId, 'the created project has an id').to.be.a('string').and.not.be.empty;

      return createCategories();
    });
}

/**
 * Registers the factory as `cy.createIsolatedProject`, typed by `commands.d.ts`.
 *
 * The cast matches how `commands.ts` registers its own commands: this tsconfig compiles
 * the support files on their own, so the `Cypress.Chainable` augmentation in `commands.d.ts`
 * is not visible here and the name is not a known `keyof Chainable`.
 */
Cypress.Commands.add(
  'createIsolatedProject' as unknown as keyof Cypress.Chainable,
  createIsolatedProject as unknown as () => void
);
