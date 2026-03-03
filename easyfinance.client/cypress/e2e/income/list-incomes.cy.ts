describe('EconoFlow - income list Tests', () => {
  const buildDateVariants = (value: Date, locale: string): string[] => {
    const fullYear = value.toLocaleDateString(locale, { year: 'numeric', month: 'numeric', day: 'numeric' });
    const shortYear = value.toLocaleDateString(locale, { year: '2-digit', month: 'numeric', day: 'numeric' });
    return Array.from(new Set([fullYear, shortYear]));
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

  afterEach(() => {
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
    const firstDayCandidate = new Date();
    firstDayCandidate.setDate(1);
    const secondDayCandidate = new Date();
    secondDayCandidate.setDate(2);
    let targetDate = firstDayCandidate;

    cy.get('button[name=edit]').first().click()

    if (new Date().getDate() == 1)
      cy.get('input[formControlName=amount]').clear().type(`0`)

    cy.window().then((win) => {
      const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
      const firstDayVariants = buildDateVariants(firstDayCandidate, locale)

      cy.get('input[formControlName=date]').invoke('val').then((currentValue) => {
        const currentDateValue = String(currentValue ?? '').trim()
        targetDate = firstDayVariants.includes(currentDateValue) ? secondDayCandidate : firstDayCandidate
        cy.get('input[formControlName=date]').clear().type(`${targetDate.toLocaleDateString(locale)}{enter}`)
      })
    })

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      const updatedDate = response?.body?.date ? new Date(response.body.date) : null
      expect(updatedDate).to.not.equal(null)
      expect(updatedDate?.getFullYear()).to.equal(targetDate.getFullYear())
      expect(updatedDate?.getMonth()).to.equal(targetDate.getMonth())
      expect(updatedDate?.getDate()).to.equal(targetDate.getDate())
    })
  })

  it('should update amount after success update', () => {
    let value = 12345;
    const fallbackValue = 23456;
    const expectedAmount = (value / 100).toFixed(2);

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=amount]').invoke('val').then((currentValue) => {
      const currentNormalized = String(currentValue ?? '').replace(/\./g, '').replace(',', '.')
      const currentAsNumber = Number(currentNormalized.replace(/[^\d.-]/g, ''))

      if (Number.isFinite(currentAsNumber) && currentAsNumber === Number(expectedAmount)) {
        value = fallbackValue;
      }

      cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)
    })

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      const targetAmount = value / 100
      expect(response?.body?.amount).to.equal(targetAmount)
    })
  })

  it('should update amount with decimal after success update', () => {
    const value = '456.78';
    const targetAmount = Number(value);

    cy.get('button[name=edit]').first().click()
    cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
      expect(response?.body?.amount).to.equal(targetAmount)
    })
  })
})
