type ProjectReq = {}
type ProjectRes = { id: string }

type IncomeReq = {}
type IncomeRes = { id: string }

type CategoryReq = {}
type CategoryRes = { id: string, expenses: ExpenseRes[] }

type ExpenseReq = { date: Date }
type ExpenseRes = { id: string, date: Date, name: string, budget: number, amount: number, items: {id: string, name: string, amount: number}[] }