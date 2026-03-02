describe('EconoFlow - income list Tests', () => {
  const buildDateVariants = (value: Date, locale: string): string[] => {
    const fullYear = value.toLocaleDateString(locale, { year: 'numeric', month: 'numeric', day: 'numeric' });
    const shortYear = value.toLocaleDateString(locale, { year: '2-digit', month: 'numeric', day: 'numeric' });
    return Array.from(new Set([fullYear, shortYear]));
  };

  const parseDayFromLocalizedDate = (value: string, locale: string): number | null => {
    const parts = value.match(/\d+/g);
    if (!parts || parts.length < 2) {
      return null;
    }

    if (locale.toLowerCase().startsWith('pt')) {
      return Number(parts[0]);
    }

    return Number(parts[1]);
  };

  const resolveDateForUpdate = (currentInputValue: string, locale: string): { updatedDate: Date; requiresZeroAmount: boolean } => {
    const today = new Date();
    const todayDay = today.getDate();
    const currentDay = parseDayFromLocalizedDate(currentInputValue, locale);

    let targetDay = 1;
    if (todayDay === 1) {
      targetDay = currentDay === 2 ? 1 : 2;
    } else {
      targetDay = currentDay === 1 ? 2 : 1;
    }

    const updatedDate = new Date(today);
    updatedDate.setDate(targetDay);

    return {
      updatedDate,
      requiresZeroAmount: targetDay > todayDay
    };
  };

  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.intercept('PATCH', '**/incomes/*').as('patchIncomes')
      cy.login(user.username, user.password)

      cy.fixture('projects').then((projects) => {
        var project = projects.defaultProject;

        cy.visit('/projects/' + project.id + '/incomes')
      })
    })
  })

  afterEach(function () {
    if (this.currentTest.title === 'should update date after success update' && new Date().getDate() == 1) {
      let formattedDate = ''
      cy.get('button[name=edit]').first().click()
      const today = new Date()

      cy.window().then((win) => {
        const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
        formattedDate = today.toLocaleDateString(locale)
        cy.get('input[formControlName=date]').clear().type(`${formattedDate}{enter}`)
      })
    }
  })

  it('should update name after success update', () => {
    const value = `name_${Math.random()}`;

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=name]').clear().type(`${value}{enter}`)

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      cy.get('.name').first().contains(`${value}`)
    })
  })

  it('should update date after success update', () => {
    let formattedDate = ''
    let expectedDates: string[] = []

    cy.get('button[name=edit]').first().click()
    cy.intercept('GET', '**/incomes*').as('getIncomes')
    cy.window().then((win) => {
      const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
      cy.get('input[formControlName=date]').invoke('val').then((currentValue) => {
        const { updatedDate, requiresZeroAmount } = resolveDateForUpdate(String(currentValue ?? ''), locale);

        formattedDate = updatedDate.toLocaleDateString(locale)
        expectedDates = buildDateVariants(updatedDate, locale)

        if (requiresZeroAmount) {
          cy.get('input[formControlName=amount]').clear().type('0')
        }

        cy.get('input[formControlName=date]').clear().type(`${formattedDate}{enter}`)
      })
    })

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)

      cy.wait('@getIncomes')

      cy.get('.date').first().invoke('text').then((text) => {
        const hasExpectedDate = expectedDates.some(date => text.includes(date))
        expect(hasExpectedDate).to.equal(true)
      })
    })
  })

  it('should update amount after success update', () => {
    let value = Math.floor(Math.random() * 1000);
    const expectedAmount = (value / 100).toFixed(2);
    const expectedAmountWithComma = expectedAmount.replace('.', ',');

    cy.get('button[name=edit]').first().click()
    cy.intercept('GET', '**/incomes*').as('getIncomes')
    cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)

      cy.wait('@getIncomes')

      cy.get('.amount').first().invoke('text').then((text) => {
        let isIncluded = text.includes(expectedAmount) || text.includes(expectedAmountWithComma);
        expect(isIncluded).to.equal(true);
      });
    })
  })

  it('should update amount with decimal after success update', () => {
    let value = (Math.random() * 1000).toFixed(2);
    const expectedAmount = Number(value).toFixed(2);
    const expectedAmountWithComma = expectedAmount.replace('.', ',');


    cy.get('button[name=edit]').first().click()
    cy.intercept('GET', '**/incomes*').as('getIncomes')
    cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)

      cy.wait('@getIncomes')

      cy.get('.amount').invoke('text').then((text) => {
        let isIncluded = text.includes(expectedAmount) || text.includes(expectedAmountWithComma);
        expect(isIncluded).to.equal(true);
      });
    })
  })
})
