Cypress.Commands.add('login', (username, password) => {
  cy.session([username, password], () => {
    cy.request('POST', '/api/AccessControl/login', {
      email: username,
      password
    }).then((resp) => {
      cy.log('Status: ' + resp.status)
    })
  }, {
    validate: () => {
      cy.getCookie('AuthToken').should('exist')
    }
  })
})

Cypress.Commands.add('register', (username, password) => {
  cy.session(
    username,
    () => {
      cy.intercept('GET', '/api/AccessControl/').as('getAccount')

      cy.request('POST', '/api/AccessControl/register', {
        email: username,
        password
      }).then((resp) => {
        cy.log('Status: ' + resp.status)

        cy.visitProtected('/projects')
        cy.url().should('include', 'first-signin')

        cy.get('input[formControlName=firstName]').type('test')
        cy.get('input[formControlName=lastName]').type('test')
        cy.get('button').contains('Send').click();
        cy.wait('@getAccount')
      })
    },
    {
      validate: () => {
        cy.login(username, password)
        cy.getCookie('AuthToken').should('exist')
      }
    }
  )
});

Cypress.Commands.add('visitProtected', (path: string) => {
  const normalizePath = (value: string) => {
    if (value.length > 1 && value.endsWith('/')) {
      return value.slice(0, -1);
    }

    return value;
  };

  cy.visit(path);
  cy.location('pathname', { timeout: 30000 }).should('not.eq', '/login');

  if (path !== '/') {
    const expectedPath = normalizePath(path);

    cy.location('pathname', { timeout: 30000 }).should((pathname) => {
      const currentPath = normalizePath(pathname);

      expect(
        currentPath === expectedPath || currentPath.startsWith(`${expectedPath}/`),
        `Expected route to start with "${expectedPath}" but got "${currentPath}"`
      ).to.be.true;
    });
  }
});
