using System.Linq;
using AutoFixture;

namespace EasyFinance.Common.Tests
{
    public class BaseTests
    {
        private static readonly object fixtureLock = new object();
        private static Fixture? fixture;

        protected static Fixture Fixture
        {
            get
            {
                lock (fixtureLock)
                {
                    if (fixture == null)
                    {
                        fixture = new Fixture();
                        fixture.Behaviors.OfType<ThrowingRecursionBehavior>().ToList().ForEach(b => fixture.Behaviors.Remove(b));
                        fixture.Behaviors.Add(new OmitOnRecursionBehavior());
                    }

                    return fixture;
                }
            }
        }
    }
}
