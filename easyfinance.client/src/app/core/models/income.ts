import { Attachment } from "./attachment";

export class Income {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  attachments!: Attachment[];
  temporaryAttachmentIds!: string[];
}
