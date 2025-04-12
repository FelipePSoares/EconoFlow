import { Component, Input, OnInit } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { ClientService } from '../../../core/services/client.service';
import { ProjectService } from '../../../core/services/project.service';
import { mapper } from '../../../core/utils/mappings/mapper';
import { Role } from '../../../core/enums/Role';
import { Client } from '../../../core/models/client';
import { ClientDto } from '../models/client-dto';
import { UserProjectDto } from '../../project/models/user-project-dto';

@Component({
  selector: 'app-list-clients',
  imports: [],
  templateUrl: './list-clients.component.html',
  styleUrl: './list-clients.component.css'
})
export class ListClientsComponent implements OnInit {
  faPlus = faPlus;

  private clients: BehaviorSubject<ClientDto[]> = new BehaviorSubject<ClientDto[]>([new ClientDto()]);
  clients$: Observable<ClientDto[]> = this.clients.asObservable();

  userProject!: UserProjectDto;

  @Input({ required: true })
  projectId!: string;

  constructor(
    private clientService: ClientService,
    private projectService: ProjectService
  ) { }

  ngOnInit(): void {
    this.projectService.selectedUserProject$.subscribe(userProject => {

    });

    this.clientService.get(this.projectId)
      .pipe(map(clients => mapper.mapArray(clients, Client, ClientDto)))
      .subscribe(
        {
          next: res => this.clients.next(res)
        });
  }

  canAddOrEdit(): boolean {
    return this.userProject.role === Role.Admin || this.userProject.role === Role.Manager;
  }
}
