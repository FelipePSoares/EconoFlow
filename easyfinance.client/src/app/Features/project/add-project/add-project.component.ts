import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectService } from '../../../core/services/project.service';
import { ProjectType, ProjectType2LabelMapping } from 'src/app/core/enums/project-type';
import { comboRequiredValidator } from 'src/app/core/utils/custom-validators/combo-required-validator';
import { ProjectDto } from '../models/project-dto';
import { Router } from '@angular/router';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';

@Component({
  selector: 'app-add-project',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, ReturnButtonComponent],
  templateUrl: './add-project.component.html',
  styleUrl: './add-project.component.css'
})
export class AddProjectComponent implements OnInit {
  public projectType2LabelMapping = ProjectType2LabelMapping;
  public projectTypes = Object.values(ProjectType) as ProjectType[];
  projectForm!: FormGroup;
  httpErrors = false;
  errors: any;
  
  constructor(private projectService: ProjectService, private router: Router) { }

  ngOnInit(): void {
    this.projectForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      type: new FormControl('Choose...', [comboRequiredValidator])
    });
  }

  saveProject(){
    if (this.projectForm.valid) {
      const name = this.projectForm.get('name')?.value;
      const type = this.projectForm.get('type')?.value;

      var newProject = <ProjectDto>({
        name: name,
        type: type
      })

      this.projectService.addProject(newProject).subscribe({
        next: response => {
          this.previous();
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
  }

  get name() {
    return this.projectForm.get('name');
  }

  get type() {
    return this.projectForm.get('type');
  }

  previous() {
    this.router.navigate(['projects']);
  }
}
