import { Transaction } from "src/app/core/models/transaction";

export class TransactionDto {
    id!: string;
    name!: string;
    date!: Date;
    amount!: number;
    type!: string;
    categoryName?: string;
    parentExpenseName?: string;
      
    static fromTransaction(transaction: Transaction): TransactionDto {
        const dto = new TransactionDto();
        dto.id = transaction.id;
        dto.name = transaction.name;
        dto.date = transaction.date;
        dto.amount = transaction.amount;
        dto.type = transaction.type;
        dto.categoryName = transaction.categoryName;
        dto.parentExpenseName = transaction.parentExpenseName;
        return dto;
    }

    static fromTransactions(transactions: Transaction[]): TransactionDto[] {
        return transactions.map(transaction => TransactionDto.fromTransaction(transaction));
    }
}
