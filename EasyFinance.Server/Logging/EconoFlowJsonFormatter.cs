using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Serilog.Events;
using Serilog.Formatting;
using Serilog.Parsing;

namespace EasyFinance.Server.Logging;

/// <summary>
/// Compact JSON (CLEF-style) formatter for the console and file sinks that
/// always writes the log level (<c>@l</c>) and the fully rendered message
/// (<c>@m</c>) alongside the message template (<c>@mt</c>). The stock
/// <c>CompactJsonFormatter</c> drops both, which hides the level and forces
/// Grafana to re-render templates by hand. Otherwise the shape matches the
/// stock compact format (timestamp, renderings, exception, trace/span ids,
/// enriched properties) so existing log consumers keep working.
/// </summary>
public sealed class EconoFlowJsonFormatter : ITextFormatter
{
    /// <inheritdoc />
    public void Format(LogEvent logEvent, TextWriter output)
    {
        using var stream = new MemoryStream();
        using (var buffer = new Utf8JsonWriter(stream, new JsonWriterOptions
        {
            Indented = false,
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        }))
        {
            buffer.WriteStartObject();

            buffer.WriteString("@t", logEvent.Timestamp.UtcDateTime.ToString("O", CultureInfo.InvariantCulture));
            buffer.WriteString("@l", logEvent.Level.ToString().ToLowerInvariant());
            buffer.WriteString("@mt", logEvent.MessageTemplate.Text);

            var tokensWithFormat = logEvent.MessageTemplate.Tokens
                .OfType<PropertyToken>()
                .Where(token => token.Format != null)
                .ToList();

            if (tokensWithFormat.Count > 0)
            {
                buffer.WriteStartArray("@r");
                foreach (var token in tokensWithFormat)
                {
                    var rendering = new StringWriter(CultureInfo.InvariantCulture);
                    token.Render(logEvent.Properties, rendering);
                    buffer.WriteStringValue(rendering.ToString());
                }
                buffer.WriteEndArray();
            }

            buffer.WriteString("@m", logEvent.RenderMessage(CultureInfo.InvariantCulture));

            if (logEvent.Exception is not null)
                buffer.WriteString("@x", logEvent.Exception.ToString());

            if (logEvent.TraceId is not null)
                buffer.WriteString("@tr", logEvent.TraceId.Value.ToString());

            if (logEvent.SpanId is not null)
                buffer.WriteString("@sp", logEvent.SpanId.Value.ToString());

            foreach (var property in logEvent.Properties)
            {
                if (property.Key.StartsWith('@'))
                    continue;

                buffer.WritePropertyName(property.Key);
                WriteValue(buffer, property.Value);
            }

            buffer.WriteEndObject();
        }

        output.WriteLine(Encoding.UTF8.GetString(stream.ToArray()));
    }

    private static void WriteValue(Utf8JsonWriter writer, LogEventPropertyValue value)
    {
        switch (value)
        {
            case ScalarValue scalar:
                if (scalar.Value is null)
                {
                    writer.WriteNullValue();
                }
                else if (scalar.Value is bool b)
                {
                    writer.WriteBooleanValue(b);
                }
                else if (scalar.Value is byte byteValue)
                {
                    writer.WriteNumberValue(byteValue);
                }
                else if (scalar.Value is sbyte sbyteValue)
                {
                    writer.WriteNumberValue(sbyteValue);
                }
                else if (scalar.Value is short shortValue)
                {
                    writer.WriteNumberValue(shortValue);
                }
                else if (scalar.Value is ushort ushortValue)
                {
                    writer.WriteNumberValue(ushortValue);
                }
                else if (scalar.Value is int intValue)
                {
                    writer.WriteNumberValue(intValue);
                }
                else if (scalar.Value is uint uintValue)
                {
                    writer.WriteNumberValue(uintValue);
                }
                else if (scalar.Value is long longValue)
                {
                    writer.WriteNumberValue(longValue);
                }
                else if (scalar.Value is ulong ulongValue)
                {
                    writer.WriteNumberValue(ulongValue);
                }
                else if (scalar.Value is float floatValue)
                {
                    if (float.IsFinite(floatValue))
                        writer.WriteNumberValue(floatValue);
                    else
                        writer.WriteStringValue(floatValue.ToString(CultureInfo.InvariantCulture));
                }
                else if (scalar.Value is double doubleValue)
                {
                    if (double.IsFinite(doubleValue))
                        writer.WriteNumberValue(doubleValue);
                    else
                        writer.WriteStringValue(doubleValue.ToString(CultureInfo.InvariantCulture));
                }
                else if (scalar.Value is decimal decimalValue)
                {
                    writer.WriteNumberValue(decimalValue);
                }
                else if (scalar.Value is DateTime dt)
                {
                    writer.WriteStringValue(dt);
                }
                else if (scalar.Value is DateTimeOffset dto)
                {
                    writer.WriteStringValue(dto);
                }
                else
                {
                    writer.WriteStringValue(scalar.Value.ToString() ?? string.Empty);
                }
                break;

            case SequenceValue sequence:
                writer.WriteStartArray();
                foreach (var element in sequence.Elements)
                    WriteValue(writer, element);
                writer.WriteEndArray();
                break;

            case StructureValue structure:
                writer.WriteStartObject();
                foreach (var member in structure.Properties)
                {
                    writer.WritePropertyName(member.Name);
                    WriteValue(writer, member.Value);
                }
                writer.WriteEndObject();
                break;

            case DictionaryValue dictionary:
                writer.WriteStartObject();
                foreach (var entry in dictionary.Elements)
                {
                    writer.WritePropertyName(entry.Key.Value?.ToString() ?? string.Empty);
                    WriteValue(writer, entry.Value);
                }
                writer.WriteEndObject();
                break;

            default:
                writer.WriteStringValue(value.ToString() ?? string.Empty);
                break;
        }
    }
}
