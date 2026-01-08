import { User } from "src/app/core/models/user";

export class ContactUsDto {
    id!: string;
    name!: string;
    email!: string;
    message!: string;
    subject!: string;
    createdAt!: Date;
    createdBy!: User | null;
}