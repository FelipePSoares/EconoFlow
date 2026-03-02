export type UploadState<T = unknown> =
  | { kind: 'progress'; percent: number }
  | { kind: 'done'; body: T };
