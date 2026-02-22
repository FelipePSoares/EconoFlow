describe('EconoFlow - Login with two-factor authentication', () => {
  const loginEmail = 'test@test.com';
  const loginPassword = 'Passw0rd!';
  const accountResponse = {
    id: '4efe8807-4a78-4fef-bf58-8fc2fc86c0f2',
    email: loginEmail,
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
    enabled: true,
    isFirstLogin: false,
    emailConfirmed: true,
    twoFactorEnabled: true,
    defaultProjectId: '',
    notificationChannels: [],
    languageCode: 'en'
  };

  it('should require authenticator code and allow login with valid TOTP', () => {
    let loginAttempt = 0;

    cy.intercept('POST', '/api/AccessControl/login', (req) => {
      loginAttempt += 1;

      if (loginAttempt === 1) {
        req.reply({
          statusCode: 401,
          body: {
            code: 'TwoFactorRequired',
            requiresTwoFactor: true
          }
        });
        return;
      }

      expect(req.body.twoFactorCode).to.equal('123456');
      expect(req.body.twoFactorRecoveryCode).to.equal(undefined);
      req.reply({
        statusCode: 200,
        body: {}
      });
    }).as('postLogin');

    cy.intercept('GET', '/api/AccessControl/', accountResponse).as('getAccount');

    cy.visit('/login');
    cy.get('input[formControlName=email]').type(loginEmail);
    cy.get('input[formControlName=password]').type(`${loginPassword}{enter}`, { log: false });

    cy.wait('@postLogin');
    cy.get('input[formControlName=twoFactorCode]').should('be.visible');
    cy.get('input[formControlName=twoFactorCode]').type('123456');
    cy.get('button').contains('Verify').click();

    cy.wait('@postLogin').then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
    });
    cy.wait('@getAccount');
  });

  it('should show clear error when submitted TOTP is invalid', () => {
    let loginAttempt = 0;

    cy.intercept('POST', '/api/AccessControl/login', (req) => {
      loginAttempt += 1;

      if (loginAttempt === 1) {
        req.reply({
          statusCode: 401,
          body: {
            code: 'TwoFactorRequired',
            requiresTwoFactor: true
          }
        });
        return;
      }

      req.reply({
        statusCode: 401,
        body: {
          code: 'InvalidTwoFactorCode',
          requiresTwoFactor: true
        }
      });
    }).as('postLogin');

    cy.visit('/login');
    cy.get('input[formControlName=email]').type(loginEmail);
    cy.get('input[formControlName=password]').type(`${loginPassword}{enter}`, { log: false });

    cy.wait('@postLogin');
    cy.get('input[formControlName=twoFactorCode]').should('be.visible');
    cy.get('input[formControlName=twoFactorCode]').type('000000');
    cy.get('button').contains('Verify').click();

    cy.wait('@postLogin').then(({ response }) => {
      expect(response?.statusCode).to.equal(401);
    });
    cy.contains('Invalid or expired authenticator code.').should('be.visible');
    cy.get('input[formControlName=twoFactorCode]').should('be.visible');
  });

  it('should allow using recovery code instead of authenticator code', () => {
    let loginAttempt = 0;

    cy.intercept('POST', '/api/AccessControl/login', (req) => {
      loginAttempt += 1;

      if (loginAttempt === 1) {
        req.reply({
          statusCode: 401,
          body: {
            code: 'TwoFactorRequired',
            requiresTwoFactor: true
          }
        });
        return;
      }

      expect(req.body.twoFactorCode).to.equal(undefined);
      expect(req.body.twoFactorRecoveryCode).to.equal('recovery-code-1234');
      req.reply({
        statusCode: 200,
        body: {}
      });
    }).as('postLogin');

    cy.intercept('GET', '/api/AccessControl/', accountResponse).as('getAccount');

    cy.visit('/login');
    cy.get('input[formControlName=email]').type(loginEmail);
    cy.get('input[formControlName=password]').type(`${loginPassword}{enter}`, { log: false });

    cy.wait('@postLogin');
    cy.contains('Use recovery code instead').click();
    cy.get('input[formControlName=twoFactorRecoveryCode]').type('recovery-code-1234');
    cy.get('button').contains('Verify').click();

    cy.wait('@postLogin').then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
    });
    cy.wait('@getAccount');
  });
});
