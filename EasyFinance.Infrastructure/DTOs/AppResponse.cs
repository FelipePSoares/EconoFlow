using System.Collections.Generic;
using System.Linq;

namespace EasyFinance.Infrastructure.DTOs
{
    public class AppResponse
    {
        private readonly List<AppMessage> messages = new List<AppMessage>();

        public bool Succeeded => messages.Count == 0;
        public bool Failed => !Succeeded;

        public IEnumerable<AppMessage> Messages => messages;

        protected AppResponse() { }

        public static AppResponse Success() => new AppResponse();

        public static AppResponse Error(string description) 
            => new AppResponse().AddErrorMessage(description);
        public static AppResponse Error(string code, string description) 
            => new AppResponse().AddErrorMessage(code, description);
        public static AppResponse Error(params AppMessage[] messages) 
            => new AppResponse().AddErrorMessage(messages);
        public static AppResponse Error(IEnumerable<AppMessage> messages) 
            => new AppResponse().AddErrorMessage(messages);

        public AppResponse AddErrorMessage(string description)
            => AddErrorMessage(new AppMessage("General", description));
        public AppResponse AddErrorMessage(string code, string description)
            => AddErrorMessage(new AppMessage(code, description));
        public AppResponse AddErrorMessage(params AppMessage[] messages)
            => AddErrorMessage(messages.ToList());
        public AppResponse AddErrorMessage(IEnumerable<AppMessage> messages)
        {
            if (messages != null)
                this.messages.AddRange(messages);

            return this;
        }
    }

    public class AppResponse<T> : AppResponse
    {
        public T Data { get; private set; } = default!;

        private AppResponse() { }
        private AppResponse(T data) => Data = data;

        public static AppResponse<T> Success(T data) => new AppResponse<T>(data);

        public new static AppResponse<T> Error(string description)
            => new AppResponse<T>().AddErrorMessage(description);
        public new static AppResponse<T> Error(string code, string description)
            => new AppResponse<T>().AddErrorMessage(code, description);
        public new static AppResponse<T> Error(params AppMessage[] messages)
            => new AppResponse<T>().AddErrorMessage(messages);
        public new static AppResponse<T> Error(IEnumerable<AppMessage> messages)
            => new AppResponse<T>().AddErrorMessage(messages);

        public new AppResponse<T> AddErrorMessage(string description)
        {
            base.AddErrorMessage(description);

            return this;
        }
        public new AppResponse<T> AddErrorMessage(string code, string description)
            => AddErrorMessage(new AppMessage(code, description));
        public new AppResponse<T> AddErrorMessage(params AppMessage[] messages)
            => AddErrorMessage(messages.ToList());
        public new AppResponse<T> AddErrorMessage(IEnumerable<AppMessage> messages)
        {
            base.AddErrorMessage(messages);

            return this;
        }
    }
}
