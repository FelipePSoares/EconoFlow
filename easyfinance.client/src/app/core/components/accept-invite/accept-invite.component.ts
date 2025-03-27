import { Component, Input, OnInit } from '@angular/core';
import { ProjectService } from '../../services/project.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-accept-invite',
  template: '',
  imports: []
})
export class AcceptInviteComponent implements OnInit {

  @Input({ required: true })
  token!: string;

  constructor(private projectService: ProjectService, private router: Router) { }

  ngOnInit(): void {
    this.projectService.acceptInvite(this.token).subscribe({
      complete: () => {
        this.router.navigate(['/projects']);
      }
    });
  }
}
