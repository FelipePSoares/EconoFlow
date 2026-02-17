export class Transaction {
    id!: string;
    name!: string;
    date!: Date;
    amount!: number;
    type!: string;
    categoryName?: string;
    parentExpenseName?: string;
}
