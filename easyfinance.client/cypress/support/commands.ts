Cypress.Commands.add('login', (username, password) => {
    cy.session(
        username, 
        () => {
            cy.visit('/login')
            cy.get('#username').type(username)
            cy.get('#password').type(`${password}{enter}`, { log: false })
            cy.url().should('include', 'projects')
        },
        {
            validate: () => {
                cy.getCookie('AuthCookie').should('exist')
            }
        }
    )
})
