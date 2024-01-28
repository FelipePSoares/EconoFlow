export class WeatherForecast {
  dateOnly: number;
  temperatureC: number;
  temperatureF: number;
  summary: string;

  constructor(dateOnly: number, temperatureC: number, temperatureF: number, summary: string) {
    this.dateOnly = dateOnly;
    this.temperatureC = temperatureC;
    this.temperatureF = temperatureF;
    this.summary = summary;
  }
}
