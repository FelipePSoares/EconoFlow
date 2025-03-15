import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CurrencyPipe } from '@angular/common';
import { CurrencyFormatPipe } from './currency-format.pipe';
import { User } from '../../models/user';
import { UserService } from '../../services/user.service';
import { GlobalService } from '../../services/global.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project';

describe('CurrencyFormatPipe', () => {
  let projectService: ProjectService;
  let globalService: GlobalService;
  let httpMock: HttpTestingController;
  let project: Project;

  let pipe: CurrencyFormatPipe;
  let currencyPipe: CurrencyPipe;

  beforeEach(() => {
    project = new Project();

    TestBed.configureTestingModule({
      imports: [],
      providers: [ProjectService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    projectService = TestBed.inject(ProjectService);
    globalService = TestBed.inject(GlobalService);
    httpMock = TestBed.inject(HttpTestingController);

    currencyPipe = new CurrencyPipe('en-US');
    pipe = new CurrencyFormatPipe(currencyPipe, projectService, globalService);
  });

  it('should format the Euro amount correctly for EUR preferences', () => {
    project.preferredCurrency = 'EUR';
    projectService.selectProject(project);

    const amount = 1234.56;
    const result = pipe.transform(amount);

    expect(result).toEqual('€1,234.56');
  });

  it('should format the Dollars amount correctly for USD preferences', () => {
    project.preferredCurrency = 'USD';
    projectService.selectProject(project);

    const amount = 1234.56;
    const result = pipe.transform(amount);

    expect(result).toEqual('$1,234.56');
  });
});
