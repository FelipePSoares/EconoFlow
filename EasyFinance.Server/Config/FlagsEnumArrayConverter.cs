using Newtonsoft.Json;

namespace EasyFinance.Server.Config
{
    public class FlagsEnumArrayConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType)
        {
            return objectType.IsEnum && Attribute.IsDefined(objectType, typeof(FlagsAttribute));
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            var enumValue = (Enum)value;
            var names = Enum.GetValues(enumValue.GetType())
                .Cast<Enum>()
                .Where(enumValue.HasFlag)
                .Where(e => Convert.ToInt64(e) != 0) // Exclude the 'None' value if it's defined as 0
                .Select(e => e.ToString());

            serializer.Serialize(writer, names.ToArray());
        }

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            var items = serializer.Deserialize<List<string>>(reader) ?? new List<string>();
            long result = 0;

            foreach (var item in items)
            {
                if (Enum.TryParse(objectType, item, ignoreCase: true, out var parsed))
                {
                    result |= Convert.ToInt64(parsed);
                }
            }

            return Enum.ToObject(objectType, result);
        }
    }

}
