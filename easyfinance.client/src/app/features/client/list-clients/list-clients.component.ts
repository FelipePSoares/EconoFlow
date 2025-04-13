import { Component, Input, OnInit } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { faBoxArchive, faPenToSquare, faPlus } from '@fortawesome/free-solid-svg-icons';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Router } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field';
import { MatInput, MatInputModule } from '@angular/material/input';
import { compare } from 'fast-json-patch';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ClientService } from '../../../core/services/client.service';
import { ProjectService } from '../../../core/services/project.service';
import { mapper } from '../../../core/utils/mappings/mapper';
import { Role } from '../../../core/enums/Role';
import { Client } from '../../../core/models/client';
import { ClientDto } from '../models/client-dto';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-list-clients',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    FontAwesomeModule,
    MatCardModule,
    MatFormField,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatSlideToggleModule
  ],
  templateUrl: './list-clients.component.html',
  styleUrl: './list-clients.component.css'
})
export class ListClientsComponent implements OnInit {
  faPlus = faPlus;
  faPenToSquare = faPenToSquare;
  faBoxArchive = faBoxArchive;

  searchText = '';
  private allClients: Client[] = [];
  private clients: BehaviorSubject<ClientDto[]> = new BehaviorSubject<ClientDto[]>([new ClientDto()]);
  clients$: Observable<ClientDto[]> = this.clients.asObservable();

  clientForm!: FormGroup;
  userProject!: UserProjectDto;
  editingClient: ClientDto = new ClientDto();
  httpErrors = false;
  errors!: Record<string, string[]>;

  @Input({ required: true })
  projectId!: string;

  constructor(
    private clientService: ClientService,
    private projectService: ProjectService,
    private router: Router,
    private dialog: MatDialog,
    private translateService: TranslateService,
    private errorMessageService: ErrorMessageService
  ) {
    this.edit(this.editingClient);
  }

  ngOnInit(): void {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      if (userProject) {
        this.userProject = userProject;
      } else {
        this.projectService.getUserProject(this.projectId)
          .subscribe(res => {
            this.projectService.selectUserProject(res);
            this.userProject = res;
          });
      }
    });

    this.fillData();
  }

  fillData() {
    this.clientService.get(this.projectId)
      .pipe(map(clients => mapper.mapArray(clients, Client, ClientDto)))
      .subscribe(
        {
          next: res => {
            this.allClients = res;
            this.clients.next(res)
          }
        });
  }

  save(): void {
    if (this.clientForm.valid) {
      const id = this.id?.value;
      const name = this.name?.value;
      const email = this.email?.value;
      const phone = this.phone?.value;
      const description = this.description?.value;

      const newClient = ({
        id: id,
        name: name,
        email: email,
        phone: phone,
        description: description,
        isActive: this.editingClient.isActive
      }) as ClientDto;

      const patch = compare(this.editingClient, newClient);

      this.clientService.update(this.projectId, id, patch).subscribe({
        next: response => {
          this.editingClient.name = response.name;
          this.editingClient.email = response.email;
          this.editingClient.phone = response.phone;
          this.editingClient.description = response.description;
          this.editingClient = new ClientDto();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.clientForm, this.errors);
        }
      });
    }
  }

  canAddOrEdit(): boolean {
    return this.userProject.role === Role.Admin || this.userProject.role === Role.Manager;
  }

  add() {
    this.router.navigate([{ outlets: { modal: ['projects', this.projectId, 'add-client'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input',
      data: {
        title: this.translateService.instant('CreateExpense')
      }
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.fillData();
      }
      this.router.navigate([{ outlets: { modal: null } }]);
    });
  }

  changeStatus(client: ClientDto): void {
    if (client.isActive) {
      this.clientService.deactivate(this.projectId, client.id).subscribe({
        next: res => {
          if (res) {
            client.isActive = false;
          }
        }
      });
    } else {
      this.clientService.activate(this.projectId, client.id).subscribe({
        next: res => {
          if (res) {
            client.isActive = true;
          }
        }
      });
    }
  }

  triggerArchive(client: ClientDto): void {
    const message = this.translateService.instant('AreYouSureYouWantArchiveClient', { value: client.name });

    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'ArchiveClient', message: message, action: 'ButtonArchive' },
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.archive(client);
      }
    });
  }

  private archive(client: ClientDto): void {
    this.clientService.archive(this.projectId, client.id).subscribe({
      next: () => {
        const clientsNewArray: ClientDto[] = this.clients.getValue();

        clientsNewArray.forEach((item, index) => {
          if (item.id === client.id) {
            clientsNewArray.splice(index, 1);
          }
        });

        this.clients.next(clientsNewArray);
      }
    });
  }

  edit(client: ClientDto): void {
    this.editingClient = client;
    this.clientForm = new FormGroup({
      id: new FormControl(client.id),
      name: new FormControl(client.name, [Validators.required]),
      email: new FormControl(client.email, [Validators.email]),
      phone: new FormControl(client.phone, [Validators.pattern('^([0-9]*)$')]),
      description: new FormControl(client.description)
    });
  }

  cancelEdit(): void {
    this.editingClient = new ClientDto();
  }

  filterClients() {
    if (!this.searchText.trim()) {
      this.clients.next(this.allClients);
      return;
    }

    const searchTermLower = this.searchText.toLowerCase().trim();

    const filteredClients = this.allClients.filter(client =>
      client.name.toLowerCase().includes(searchTermLower) ||
      (client.email && client.email.toLowerCase().includes(searchTermLower)) ||
      (client.phone && client.phone.toLowerCase().includes(searchTermLower)) ||
      (client.description && client.description.toLowerCase().includes(searchTermLower))
    );

    this.clients.next(filteredClients);
  }

  clearSearch() {
    this.searchText = '';
    this.filterClients();
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.clientForm, fieldName);
  }

  get id() {
    return this.clientForm.get('id');
  }
  get name() {
    return this.clientForm.get('name');
  }
  get email() {
    return this.clientForm.get('email');
  }
  get phone() {
    return this.clientForm.get('phone');
  }
  get description() {
    return this.clientForm.get('description');
  }
}
