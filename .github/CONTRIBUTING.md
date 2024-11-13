## Get the source code

*  `git clone git@github.com:FelipePSoares/EconoFlow.git`

* create and switch to a dev branch `git checkout -b {feat or fix}/#{issue number}_{name_of_the_branch}`

## Running on Visual Studio

Just run in debug mode.

## Running on VS Code

to run on VS Code you will need to run the following command line on root path:
* `dotnet run --project ./EasyFinance.Server --urls https://localhost:7003/`

## Generating migration

#### VS Code

* First you need to go to Persistence project folder
* Then you can execute the following command line:
	* `dotnet ef migrations add {YourMigrationName} --context EasyFinanceDatabaseContext --configuration release -s ../EasyFinance.Server`

#### Visual Studio
* Open Package Manager Console
* Select `EasyFinance.Pesistence` as Default Project
* Then run the following command line:
	* `Add-Migration {YourMigrationName} -Context EasyFinanceDatabaseContext`