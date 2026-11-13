using System.Text.Json;
using FluentAssertions;
using FpsSoftware.Chassis;
using Serilog.Events;
using Serilog.Parsing;

namespace EasyFinance.Server.Tests.Logging;

/// <summary>
/// Verifies the console/file JSON formatter used on Kubernetes keeps the
/// log level and the fully rendered message in every event, so Grafana can
/// filter on the level and display a readable message without re-rendering
/// the message template.
/// </summary>
public class JsonLogFormatterTests
{
    private static readonly ChassisJsonFormatter Formatter = new();

    private static LogEvent CreateEvent(
        LogEventLevel level,
        string template,
        Exception? exception = null,
        params KeyValuePair<string, LogEventPropertyValue>[] properties)
        => new(DateTimeOffset.UtcNow, level, exception, new MessageTemplateParser().Parse(template),
            properties.Select(p => new LogEventProperty(p.Key, p.Value)));

    private static string Format(LogEvent logEvent)
    {
        using var output = new StringWriter();
        Formatter.Format(logEvent, output);
        return output.ToString();
    }

    [Theory]
    [InlineData(LogEventLevel.Verbose, "verbose")]
    [InlineData(LogEventLevel.Debug, "debug")]
    [InlineData(LogEventLevel.Information, "information")]
    [InlineData(LogEventLevel.Warning, "warning")]
    [InlineData(LogEventLevel.Error, "error")]
    [InlineData(LogEventLevel.Fatal, "fatal")]
    public void Format_AlwaysWritesLevel_EvenForInformation(LogEventLevel level, string expectedLevel)
    {
        var output = Format(CreateEvent(level, "Request completed"));

        using var document = JsonDocument.Parse(output);
        document.RootElement.GetProperty("@l").GetString().Should().Be(expectedLevel);
    }

    [Fact]
    public void Format_WritesRenderedMessageAlongsideTemplate()
    {
        const string template = "HTTP {RequestMethod} {RequestPath} responded {StatusCode}";
        var logEvent = CreateEvent(
            LogEventLevel.Information,
            template,
            properties:
            [
                new("RequestMethod", new ScalarValue("GET")),
                new("RequestPath", new ScalarValue("/api/Account/Notifications")),
                new("StatusCode", new ScalarValue(200)),
            ]);

        var output = Format(logEvent);
        using var document = JsonDocument.Parse(output);
        var root = document.RootElement;

        root.GetProperty("@mt").GetString().Should().Be(template);
        // Chassis 1.3.0 renders @m through Serilog.Expressions, which does not quote
        // string properties; <=1.2.0 wrote them with quotes
        // (docs/logging-migration-1.3.0.md §3.1 in the chassis repository).
        root.GetProperty("@m").GetString().Should().Be("HTTP GET /api/Account/Notifications responded 200");
    }

    [Fact]
    public void Format_RendersStructuredObjectsAsCompactJson_WithTypeTag()
    {
        // 1.3.0 renders destructured objects as compact JSON (not Serilog's
        // `Person { Name: "Ada", Age: 36 }`) and keeps the structure's type tag as `$type`
        // in both @m and the first-class property.
        var user = new StructureValue(
            [
                new LogEventProperty("Name", new ScalarValue("Ada")),
                new LogEventProperty("Age", new ScalarValue(36)),
            ],
            "Person");

        var output = Format(CreateEvent(
            LogEventLevel.Information,
            "Payload {User}",
            properties: [new("User", user)]));

        using var document = JsonDocument.Parse(output);
        var root = document.RootElement;

        // @m is the prefix followed by compact JSON, not Serilog's
        // `Person { Name: "Ada", Age: 36 }`. Parsing the rendering keeps this test from
        // depending on the order in which Serilog.Expressions writes the fields.
        var rendered = root.GetProperty("@m").GetString()!;
        rendered.Should().StartWith("Payload {");

        using var renderedDocument = JsonDocument.Parse(rendered["Payload ".Length..]);
        renderedDocument.RootElement.GetProperty("Name").GetString().Should().Be("Ada");
        renderedDocument.RootElement.GetProperty("Age").GetInt32().Should().Be(36);
        renderedDocument.RootElement.GetProperty("$type").GetString().Should().Be("Person");

        root.GetProperty("User").GetProperty("Name").GetString().Should().Be("Ada");
        root.GetProperty("User").GetProperty("$type").GetString().Should().Be("Person");
    }

    [Fact]
    public void Format_WritesDateTimePropertiesInRoundTripFormat()
    {
        // 1.3.0 writes the 7-digit round-trip format instead of the old short ISO form.
        var when = new DateTime(2026, 11, 13, 12, 34, 56, DateTimeKind.Utc);

        var output = Format(CreateEvent(
            LogEventLevel.Information,
            "Payload",
            properties: [new("When", new ScalarValue(when))]));

        using var document = JsonDocument.Parse(output);

        document.RootElement.GetProperty("When").GetString().Should().Be("2026-11-13T12:34:56.0000000Z");
    }

    [Fact]
    public void Format_TerminatesTheLineWithLf_NotCrLf()
    {
        // The template ends with `\n` on every platform; the old formatter used
        // TextWriter.WriteLine, which is `\r\n` on Windows.
        var output = Format(CreateEvent(LogEventLevel.Information, "Message"));

        output.Should().EndWith("\n");
        output.Should().NotContain("\r");
    }

    [Fact]
    public void Format_WritesEnrichedPropertiesAndTimestamp()
    {
        var logEvent = CreateEvent(
            LogEventLevel.Warning,
            "Something happened",
            properties:
            [
                new("CorrelationId", new ScalarValue("19986c2b-1e63-4dd3-8d25-6a3029b2adcf")),
                new("Application", new ScalarValue("EconoFlow")),
            ]);

        var output = Format(logEvent);
        using var document = JsonDocument.Parse(output);
        var root = document.RootElement;

        root.GetProperty("CorrelationId").GetString().Should().Be("19986c2b-1e63-4dd3-8d25-6a3029b2adcf");
        root.GetProperty("Application").GetString().Should().Be("EconoFlow");
        root.TryGetProperty("@t", out var timestamp).Should().BeTrue();
        timestamp.GetDateTimeOffset().Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromMinutes(1));
    }

    [Fact]
    public void Format_WritesFormattedRenderingsForTemplatesWithFormatTokens()
    {
        const string template = "Responded in {Elapsed:0.0000} ms";
        var logEvent = CreateEvent(
            LogEventLevel.Information,
            template,
            properties: [new("Elapsed", new ScalarValue(11.928291))]);

        var output = Format(logEvent);
        using var document = JsonDocument.Parse(output);

        document.RootElement.GetProperty("@r")[0].GetString().Should().Be("11.9283");
        document.RootElement.GetProperty("@m").GetString().Should().Be("Responded in 11.9283 ms");
    }

    [Fact]
    public void Format_WritesExceptionDetail()
    {
        var logEvent = CreateEvent(LogEventLevel.Error, "Boom", exception: new InvalidOperationException("kaboom"));

        var output = Format(logEvent);
        using var document = JsonDocument.Parse(output);

        document.RootElement.GetProperty("@x").GetString().Should().Contain("kaboom");
    }

    [Fact]
    public void Format_EmitsOneSelfContainedJsonLine()
    {
        var output = Format(CreateEvent(LogEventLevel.Information, "Message"));

        output.TrimEnd('\r', '\n').Split('\n').Should().ContainSingle();
        using var document = JsonDocument.Parse(output); // would throw if the line is not valid JSON
        document.RootElement.ValueKind.Should().Be(JsonValueKind.Object);
    }

    [Fact]
    public void Format_WritesTypedScalarProperties()
    {
        var logEvent = CreateEvent(
            LogEventLevel.Information,
            "Payload",
            properties:
            [
                new("StatusCode", new ScalarValue(200)),
                new("Succeeded", new ScalarValue(true)),
                new("Amount", new ScalarValue(11.928291)),
            ]);

        var output = Format(logEvent);
        using var document = JsonDocument.Parse(output);
        var root = document.RootElement;

        root.GetProperty("StatusCode").ValueKind.Should().Be(JsonValueKind.Number);
        root.GetProperty("StatusCode").GetInt32().Should().Be(200);
        root.GetProperty("Succeeded").ValueKind.Should().Be(JsonValueKind.True);
        root.GetProperty("Amount").ValueKind.Should().Be(JsonValueKind.Number);
    }

    [Fact]
    public void Format_WritesNullScalarAsJsonNull()
    {
        var logEvent = CreateEvent(
            LogEventLevel.Information,
            "Payload",
            properties: [new("NullableValue", new ScalarValue(null))]);

        using var document = JsonDocument.Parse(Format(logEvent));
        document.RootElement.GetProperty("NullableValue").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public void Format_WritesNonFiniteDoubleAsString_InsteadOfThrowing()
    {
        var nan = CreateEvent(
            LogEventLevel.Information,
            "Payload",
            properties: [new("Ratio", new ScalarValue(double.NaN))]);
        var infinity = CreateEvent(
            LogEventLevel.Information,
            "Payload",
            properties: [new("Ratio", new ScalarValue(double.PositiveInfinity))]);

        using var nanDocument = JsonDocument.Parse(Format(nan));
        nanDocument.RootElement.GetProperty("Ratio").ValueKind.Should().Be(JsonValueKind.String);

        using var infinityDocument = JsonDocument.Parse(Format(infinity));
        infinityDocument.RootElement.GetProperty("Ratio").ValueKind.Should().Be(JsonValueKind.String);
    }
}
