export enum SubscriptionLevel {
  Free = 0,
  Premium = 10,
  Enterprise = 20
}

export const SubscriptionLevel2LabelMapping: Record<SubscriptionLevel, string> = {
  [SubscriptionLevel.Free]: "Free",
  [SubscriptionLevel.Premium]: "Premium",
  [SubscriptionLevel.Enterprise]: "Enterprise",
};



