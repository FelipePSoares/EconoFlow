import { Component, Input, OnInit, inject } from '@angular/core';
import { ProjectService } from '../../services/project.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-accept-invite',
  template: '',
  imports: []
})
export class AcceptInviteComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);


  @Input({ required: true })
  token!: string;

  ngOnInit(): void {
    this.projectService.acceptInvite(this.token).subscribe({
      complete: () => {
        this.router.navigate(['/projects']);
      }
    });
  }
}
