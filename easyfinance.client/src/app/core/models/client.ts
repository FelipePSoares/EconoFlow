import { AutoMap } from "@automapper/classes";

export class Client {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  email!: string;
  @AutoMap()
  phone!: string;
  @AutoMap()
  description!: string;
  @AutoMap()
  isActive!: boolean;
}
