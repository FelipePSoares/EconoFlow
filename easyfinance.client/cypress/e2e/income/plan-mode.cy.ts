describe('EconoFlow - income plan mode', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;
      cy.login(user.username, user.password);
    });
  });

  it('should create a plan and support add/remove money ledger actions', () => {
    let planSequence = 1;
    let entrySequence = 1;
    const plans: {
      id: string;
      projectId: string;
      type: number;
      name: string;
      targetAmount: number;
      currentBalance: number;
      remaining: number;
      progress: number;
      isArchived: boolean;
    }[] = [];
    const entriesByPlan: Record<string, {
      id: string;
      planId: string;
      date: string;
      amountSigned: number;
      note: string;
    }[]> = {};

    cy.intercept('GET', '**/api/projects/*/plans', req => {
      req.reply(200, plans.filter(plan => !plan.isArchived));
    }).as('getPlans');

    cy.intercept('POST', '**/api/projects/*/plans', req => {
      const projectId = req.url.split('/api/projects/')[1].split('/')[0];
      const body = req.body as { type: number; name: string; targetAmount: number };
      const targetAmount = Number(body.targetAmount || 0);
      const newPlan = {
        id: `plan-${planSequence++}`,
        projectId,
        type: Number(body.type || 1),
        name: String(body.name || ''),
        targetAmount,
        currentBalance: 0,
        remaining: targetAmount,
        progress: 0,
        isArchived: false
      };

      plans.push(newPlan);
      entriesByPlan[newPlan.id] = [];
      req.reply(201, newPlan);
    }).as('postPlan');

    cy.intercept('GET', '**/api/projects/*/plans/*/entries', req => {
      const planId = req.url.split('/plans/')[1].split('/entries')[0];
      req.reply(200, entriesByPlan[planId] ?? []);
    }).as('getEntries');

    cy.intercept('POST', '**/api/projects/*/plans/*/entries', req => {
      const planId = req.url.split('/plans/')[1].split('/entries')[0];
      const body = req.body as { date: string; amountSigned: number; note: string };
      const amountSigned = Number(body.amountSigned || 0);

      const entry = {
        id: `entry-${entrySequence++}`,
        planId,
        date: body.date,
        amountSigned,
        note: String(body.note || '')
      };

      const existingEntries = entriesByPlan[planId] ?? [];
      entriesByPlan[planId] = [entry, ...existingEntries];

      const plan = plans.find(item => item.id === planId);
      if (plan) {
        plan.currentBalance += amountSigned;
        plan.remaining = plan.targetAmount - plan.currentBalance;
        plan.progress = plan.targetAmount <= 0 ? 0 : plan.currentBalance / plan.targetAmount;
      }

      req.reply(201, entry);
    }).as('postPlanEntry');

    cy.fixture('projects').then((projects) => {
      cy.visit('/projects/' + projects.defaultProject.id + '/income-plans');
    });

    cy.get('[data-testid=income-plan-mode]').should('exist');
    cy.get('[data-testid=create-plan-button]').click();
    cy.get('input[formControlName=name]').clear().type('Emergency Plan');
    cy.get('input[formControlName=targetAmount]').clear().type('500000');
    cy.get('[data-testid=save-plan-button]').click();

    cy.wait('@postPlan').its('response.statusCode').should('eq', 201);
    cy.get('[data-testid=plan-card-plan-1]').should('exist');

    cy.get('input[formControlName=amount]').clear().type('150000');
    cy.get('input[formControlName=note]').clear().type('Initial deposit');
    cy.get('[data-testid=save-plan-entry-button]').click();

    cy.wait('@postPlanEntry').its('response.statusCode').should('eq', 201);
    cy.get('[data-testid=plan-progress-value]').first().contains('30%');
    cy.get('[data-testid=plan-entry-item]').first().contains('Initial deposit');

    cy.get('mat-select[formControlName=action]').click();
    cy.get('mat-option').eq(1).click();
    cy.get('input[formControlName=amount]').clear().type('50000');
    cy.get('input[formControlName=note]').clear().type('Withdrawal');
    cy.get('[data-testid=save-plan-entry-button]').click();

    cy.wait('@postPlanEntry').then(({ request, response }) => {
      expect(response?.statusCode).to.equal(201);
      expect(Number(request.body.amountSigned)).to.equal(-500);
    });

    cy.get('[data-testid=plan-progress-value]').first().contains('20%');
    cy.get('[data-testid=plan-entry-item]').should('have.length', 2);
  });
});
