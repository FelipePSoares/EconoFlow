import { AutoMap } from "@automapper/classes";

export class Transaction {
    @AutoMap()
    id!: string;
    @AutoMap()
    name!: string;
    @AutoMap()
    date!: Date;
    @AutoMap()
    amount!: number;
    @AutoMap()
    type!: string;
}