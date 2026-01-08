import { User } from "./user";

export class ContactUs {
    id!: string;
    name!: string;
    email!: string;
    message!: string;
    subject!: string;
    createdAt!: Date;
    createdBy!: User | null;
}