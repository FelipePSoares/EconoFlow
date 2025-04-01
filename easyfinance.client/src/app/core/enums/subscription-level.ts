export enum SubscriptionLevel {
  Free = "Free",
  Premium = "Premium",
  Enterprise = "Enterprise"
}

export const SubscriptionLevel2LabelMapping: Record<SubscriptionLevel, string> = {
  [SubscriptionLevel.Free]: "Free",
  [SubscriptionLevel.Premium]: "Premium",
  [SubscriptionLevel.Enterprise]: "Enterprise",
};



