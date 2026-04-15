describe('EconoFlow - Smart Setup Tests', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;

      cy.login(user.username, user.password)

      cy.window().then((win) => {
        win.sessionStorage.setItem("visited", "true");
      });

      cy.visit('/projects')
      cy.waitForLoader();

      cy.intercept('GET', '**/projects*').as('getProjects')
      cy.intercept('POST', '**/projects*').as('postProjects')

      cy.get('#add-item').click()

      cy.focused().should('have.attr', 'formControlName', 'name')

      const name = `name_${Math.random()}`;

      cy.get('input[formControlName=name]').type(name)
      const preferredCurrencyInput = cy.get('mat-select[formcontrolname=preferredCurrency]');
      preferredCurrencyInput.click().get('mat-option').contains('EUR').click()

      cy.get('button').contains('Create').click();

      cy.wait<ProjectReq, ProjectRes>('@postProjects').then(({ response }) => {
        expect(response?.statusCode).to.equal(201)
        expect(response?.body?.project?.id).to.not.equal(undefined);
        cy.wrap(response?.body?.project?.id).as('projectId');

        cy.get("mat-snack-bar-container").should("be.visible").contains('Created Successfully!');
      })
    })
  })

  it('should setup using smart setup and all expense should be created', () => {
    cy.intercept('POST', '**/smart-setup/**').as('postSmartSetup');
    cy.intercept('GET', '**/categories?*').as('getCategories');

    cy.waitForLoader();
    cy.get('.categories mat-slider').its('length').should('be.greaterThan', 0).as('smartSetupCategoryCount');
    cy.get('#annualIncome').type('60000')

    // Verify Emergency Reserve target input appears and has a suggested value
    cy.get('#emergencyReserveTarget').should('be.visible');

    cy.get('button').contains('Save').click()

    cy.wait('@postSmartSetup').then(({ response }) => {
      expect([200, 201, 204]).to.include(response?.statusCode ?? 0);

      // Verify the request included emergencyReserveTarget
      expect(response?.body).to.not.be.undefined;
    });

    cy.get('@projectId').then((projectId) => {
      cy.visit('/projects/' + projectId + '/expense-overview');
    });

    cy.waitForLoader();
    cy.wait('@getCategories');

    cy.get('@smartSetupCategoryCount').then((count) => {
      cy.get('.slider-container .slide .card')
        .not('.btn-add')
        .should('have.length', Number(count));
    });

    cy.get('.slider-container .slide .card')
      .not('.btn-add')
      .find('.card-small-text')
      .should(($labels) => {
        const text = $labels.text().toLowerCase();
        expect(text).not.to.contain('set a budget');
      });
  })

  it('should create emergency reserve plan after smart setup', () => {
    cy.intercept('POST', '**/smart-setup/**').as('postSmartSetup');
    cy.intercept('GET', '**/Plans*').as('getPlans');

    cy.waitForLoader();
    cy.get('#annualIncome').type('60000')
    cy.get('button').contains('Save').click()

    cy.wait('@postSmartSetup').then(({ response }) => {
      expect([200, 201, 204]).to.include(response?.statusCode ?? 0);
    });

    cy.get('@projectId').then((projectId) => {
      cy.visit('/projects/' + projectId + '/plans');
    });

    cy.waitForLoader();
    cy.wait('@getPlans').then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body).to.be.an('array').that.has.length.greaterThan(0);

      const emergencyPlan = response?.body.find((p: any) => p.type === 1);
      expect(emergencyPlan).to.not.be.undefined;
      expect(emergencyPlan.currentBalance).to.equal(0);
      expect(emergencyPlan.targetAmount).to.be.greaterThan(0);
    });
  })
})
