import { AutoMap } from "@automapper/classes";
import { User } from "./user";

export class ContactUs {
    @AutoMap()
    id!: string;
    @AutoMap()
    name!: string;
    @AutoMap() 
    email!: string;
    @AutoMap()
    message!: string;
    @AutoMap()
    subject!: string;
    @AutoMap()
    createdAt!: Date;
    @AutoMap()
    createdBy!: User | null;
}