
import { AutoMap } from "@automapper/classes";
import { User } from "src/app/core/models/user";

export class ContactUsDto {
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