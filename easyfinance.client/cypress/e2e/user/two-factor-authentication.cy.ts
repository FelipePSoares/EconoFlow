describe('EconoFlow - Two-factor authentication settings', () => {
  beforeEach(() => {
    cy.fixture('users').then((users) => {
      const user = users.testUser;
      cy.login(user.username, user.password);
    });
  });

  it('should enable two-factor authentication with QR setup flow', () => {
    const accountResponse = {
      id: 'f779f47e-a8a8-46c1-9eeb-a57e303f3ae3',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      fullName: 'Test User',
      enabled: true,
      isFirstLogin: false,
      emailConfirmed: true,
      twoFactorEnabled: false,
      defaultProjectId: '',
      notificationChannels: [],
      languageCode: 'en'
    };

    cy.intercept('GET', '/api/AccessControl/', accountResponse).as('getAccount');
    cy.intercept('GET', '/api/AccessControl/2fa/setup', {
      statusCode: 200,
      body: {
        isTwoFactorEnabled: false,
        sharedKey: 'abcd efgh ijkl mnop',
        otpAuthUri: 'otpauth://totp/EconoFlow:test%40test.com?secret=ABCDEFGHIJKLMNOP&issuer=EconoFlow&digits=6'
      }
    }).as('getTwoFactorSetup');
    cy.intercept('POST', '/api/AccessControl/2fa/enable', (req) => {
      expect(req.body.code).to.equal('123456');
      req.reply({
        statusCode: 200,
        body: {
          twoFactorEnabled: true,
          recoveryCodes: [
            'recovery-code-1',
            'recovery-code-2'
          ]
        }
      });
    }).as('enableTwoFactor');

    cy.visit('/user/authentication');
    cy.wait('@getAccount');
    cy.get('#twoFactorStartSetup').click();

    cy.wait('@getTwoFactorSetup');
    cy.get('[data-testid="two-factor-qr"] svg').should('exist');
    cy.contains('abcd efgh ijkl mnop').should('be.visible');

    cy.get('input[formControlName=code]').type('123456');
    cy.get('#twoFactorEnableButton').click();

    cy.wait('@enableTwoFactor');
    cy.contains('recovery-code-1').should('be.visible');
    cy.contains('recovery-code-2').should('be.visible');
  });
});
