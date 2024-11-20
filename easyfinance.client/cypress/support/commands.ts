Cypress.Commands.add('login', (username, password) => {
    cy.session(
        username,
        () => {
            cy.intercept('GET', '/api/account/').as('getAccount')
            cy.visit('/login')
            cy.get('input[formControlName=email]').type(username)
            cy.get('input[formControlName=password]').type(`${password}{enter}`, { log: false })
        },
        {
            validate: () => {
                cy.wait('@getAccount').then(interception => {
                    cy.getCookie('AuthCookie').should('exist')
                })
            }
        }
    )
})

Cypress.Commands.add('register', (username, password) => {
    cy.session(
        username,
        () => {
            cy.visit('/register')
            cy.get('input[formControlName=email]').type(username)
            cy.get('input[formControlName=password]').type(password)
            cy.get('input[formControlName=confirmPassword]').type(`${password}{enter}`, { force: true, log: false })
            cy.url().should('include', 'login')

            cy.login(username, password)

            cy.visit('/')
            cy.url().should('include', 'first-signin')
        }
    )
})
