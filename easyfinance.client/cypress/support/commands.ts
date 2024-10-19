Cypress.Commands.add('login', (username, password) => {
    cy.session(
        username, 
        () => {
            cy.visit('/login')
            cy.get('#email').type(username)
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