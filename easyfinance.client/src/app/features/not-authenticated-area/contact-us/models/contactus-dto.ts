
import { AutoMap } from "@automapper/classes";

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
    createdBy!: string;
}