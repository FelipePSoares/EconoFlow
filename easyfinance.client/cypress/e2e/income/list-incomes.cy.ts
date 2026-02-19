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

        cy.visitProtected('/projects/' + project.id + '/incomes')
      })
    })
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
    const today = new Date()
    today.setDate(Math.floor(Math.random() * today.getDate()) + 1)
    let formattedDate = ''
    let expectedDates: string[] = []

    cy.get('button[name=edit]').first().click()
    cy.window().then((win) => {
      const locale = win.localStorage.getItem('language-key') || win.navigator.language || 'en-US'
      formattedDate = today.toLocaleDateString(locale)
      expectedDates = buildDateVariants(today, locale)
      cy.get('input[formControlName=date]').clear().type(`${formattedDate}{enter}`)
    })

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
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
    cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)
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
    cy.get('input[formControlName=amount]').clear().type(`${value}{enter}`)

    cy.wait<IncomeReq, IncomeRes>('@patchIncomes').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200)

      cy.get('.amount').invoke('text').then((text) => {
        let isIncluded = text.includes(expectedAmount) || text.includes(expectedAmountWithComma);
        expect(isIncluded).to.equal(true);
      });
    })
  })
})
