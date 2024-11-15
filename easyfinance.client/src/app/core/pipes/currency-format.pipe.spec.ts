import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CurrencyPipe } from '@angular/common';
import { CurrencyFormatPipe } from './currency-format.pipe';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { Observable } from 'rxjs';
import { User } from '../models/user';
import { UserService } from '../services/user.service';
import { HttpClient } from '@angular/common/http';

//registerLocaleData(localeDe); enable to test de-DE

describe('CurrencyFormatPipe', () => {
  let userService: UserService;
  let httpMock: HttpTestingController;
  let user: User;

  let pipe: CurrencyFormatPipe;
  let currencyPipe: CurrencyPipe;

  beforeEach(async () => {
    user = new User();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService],
    });
    userService = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);

    currencyPipe = new CurrencyPipe('en-US');
    pipe = new CurrencyFormatPipe(currencyPipe, userService);
  });

  it('should format the Euro amount correctly for EUR preferences', () => {
    userService.refreshUserInfo().subscribe();
    const req = httpMock.expectOne('/api/account/');

    user.preferredCurrency = 'EUR';
    req.flush(user);

    const amount = 1234.56;
    const result = pipe.transform(amount);

    expect(result).toEqual('€1,234.56');
  });

  it('should format the Dollars amount correctly for USD preferences', () => {
    userService.refreshUserInfo().subscribe();
    const req = httpMock.expectOne('/api/account/');

    user.preferredCurrency = 'USD';
    req.flush(user);

    const amount = 1234.56;
    const result = pipe.transform(amount);

    expect(result).toEqual('$1,234.56');
  });
});
