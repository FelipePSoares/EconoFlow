using System.Collections.Generic;
using System.Linq;

namespace EasyFinance.Infrastructure.DTOs
{
    public class AppResponse
    {
        private static readonly AppResponse success = new AppResponse { Succeeded = true };
        private readonly List<AppMessage> messages = new List<AppMessage>();

        public bool Succeeded { get; protected set; }

        public IEnumerable<AppMessage> Messages => messages;

        public static AppResponse Success() => success;
        public static AppResponse Success(string code, string description)
        {
            var result = success;
            return AddMessage(result, new AppMessage(code, description));
        }
        public static AppResponse Success(params AppMessage[] messages)
        {
            var result = success;
            return AddMessage(result, messages);
        }

        public static AppResponse Error(string description)
        {
            var result = new AppResponse() { Succeeded = false };
            return AddMessage(result, new AppMessage("General", description));
        }
        public static AppResponse Error(string code, string description)
        {
            var result = new AppResponse() { Succeeded = false };
            return AddMessage(result, new AppMessage(code, description));
        }
        public static AppResponse Error(params AppMessage[] messages)
        {
            var result = new AppResponse() { Succeeded = false };
            return AddMessage(result, messages);
        }
        public static AppResponse Error(IEnumerable<AppMessage> messages)
        {
            var result = new AppResponse() { Succeeded = false };
            return AddMessage(result, messages);
        }

        protected static T AddMessage<T>(T appResponse, params AppMessage[] messages) where T : AppResponse
            => AddMessage(appResponse, messages.ToList());

        protected static T AddMessage<T>(T appResponse, IEnumerable<AppMessage> messages)
            where T : AppResponse
        {
            if (messages != null)
                appResponse.messages.AddRange(messages);

            return appResponse;
        }
    }

    public class AppResponse<T> : AppResponse
    {
        private static readonly AppResponse<T> success = new AppResponse<T> { Succeeded = true };

        public T Data { get; private set; } = default!;

        public static AppResponse<T> Success(T data)
        {
            var result = success;
            result.Data = data;
            return result;
        }
        public static AppResponse<T> Success(T data, string code, string description)
        {
            var result = success;
            result.Data = data;
            return AddMessage(result, new AppMessage(code, description));
        }
        public static AppResponse<T> Success(T data, params AppMessage[] messages)
        {
            var result = success;
            result.Data = data;
            return AddMessage(result, messages);
        }

        public new static AppResponse<T> Error(string description)
        {
            var result = new AppResponse<T>() { Succeeded = false };
            return AddMessage(result, new AppMessage("General", description));
        }
        public new static AppResponse<T> Error(string code, string description)
        {
            var result = new AppResponse<T>() { Succeeded = false };
            return AddMessage(result, new AppMessage(code, description));
        }
        public new static AppResponse<T> Error(params AppMessage[] messages)
        {
            var result = new AppResponse<T>() { Succeeded = false };
            return AddMessage(result, messages);
        }
        public new static AppResponse<T> Error(IEnumerable<AppMessage> messages)
        {
            var result = new AppResponse<T>() { Succeeded = false };
            return AddMessage(result, messages);
        }
    }
}
