type UserReq = {}
type UserRes = { id: string, email: string, firstName: string, lastName: string, preferredCurrency: string, notificationChannels: string[] }

type UserProjectReq = {}
type UserProjectRes = { project: { id: string } }

type ProjectReq = {}
type ProjectRes = { id: string }

type IncomeReq = {}
type IncomeRes = { id: string }

type CategoryReq = {}
type CategoryRes = { id: string, expenses: ExpenseRes[] }

type ExpenseReq = {
  date: Date,
  name?: string,
  budget?: number,
  amount?: number,
  isDeductible?: boolean,
  temporaryAttachmentIds?: string[]
}
type ExpenseRes = {
  id: string,
  date: Date,
  name: string,
  budget: number,
  amount: number,
  isDeductible?: boolean,
  attachments?: { id: string, name: string, attachmentType: number }[],
  items: {id: string, name: string, amount: number}[]
}
