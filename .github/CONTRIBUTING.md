## Prerequisites 

* Node v18.19 or higher
* .NET SDK v8.0
* Cypress for E2E tests
* Angular Cli (to generate new components)

We do not recommend use the VS for mac because microsoft stopped the support after Aug 31, 2024	and it didn't support .Net 8 officially.
https://learn.microsoft.com/en-us/visualstudio/releases/2022/what-happened-to-vs-for-mac?view=vsmac-2022

### 

## Get the source code
*  `git clone git@github.com:FelipePSoares/EconoFlow.git`

* create and switch to a dev branch `git checkout -b {feat or fix}/#{issue number}_{name_of_the_branch}`

## Running on Visual Studio (Windows)
Just run it in debug mode.

### Running tests
We have 3 type of tests in our application, backend unit tests, frontend unit tests and e2e tests.

backend unit tests:
* Open Test Explorer window and run. 

frontend unit tests:
* Open Package Manager Console.
* Select `easyfinance.client` as Default Project
* Run `npm test`

e2e tests:
* Open Package Manager Console.
* Select `easyfinance.client` as Default Project
* Run `npx cypress open`
* It'll open a new window just select and run the desired tests.

## Running on VS Code
to run on VS Code you will need to run the following command line on root path:
* `dotnet dev-certs https` (just the first time)
* `dotnet run --project ./EasyFinance.Server --urls https://localhost:7003/`

### Running tests
We have 3 type of tests in our application, backend unit tests, frontend unit tests and e2e tests.

backend unit tests:
* Run `dotnet test` on root folder of the project

frontend unit tests:
* On folder `easyfinance.client`
* Run `npm test`

e2e tests:
* On folder `easyfinance.client`
* Run `npx cypress open`
* It'll open a new window just select and run the desired tests.

## Generating migration (when needed)
This commands are **not required to run the application** when you change some of the database structures, Models or Mappings. Otherwise you can ignore this topic.

#### VS Code
* First you need to go to Persistence project folder
* Then you can execute the following command line:
	* `dotnet ef migrations add {YourMigrationName} --context EasyFinanceDatabaseContext --project EasyFinance.Persistence --configuration release -s ./EasyFinance.Server`

#### Visual Studio
* Open Package Manager Console
* Select `EasyFinance.Pesistence` as Default Project
* Then run the following command line:
	* `Add-Migration {YourMigrationName} -Context EasyFinanceDatabaseContext`
