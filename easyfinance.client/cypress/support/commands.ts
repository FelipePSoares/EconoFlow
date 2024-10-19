Cypress.Commands.add('login', (username, password) => {
    cy.session(
        username, 
        () => {
            cy.intercept('/api/account/').as('getAccount')
            cy.visit('/login')
            cy.get('#username').type(username)
            cy.get('#password').type(`${password}{enter}`, { log: false })
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
            cy.get('#email').type(username)
            cy.get('#password').type(password)
            cy.get('#confirmPassword').type(`${password}{enter}`, { log: false })
            cy.url().should('include', 'login')
            
            cy.login(username, password)
            
            cy.visit('/')
            cy.url().should('include', 'first-signin')
        }
    )
})
