export type FeedFailureReason =
  | "configuration_invalid"
  | "environment_blocked"
  | "schema_missing"
  | "read_failed"
  | "catalog_incomplete"
  | "catalog_changed"
  | "catalog_limit"
  | "catalog_timeout"
  | "catalog_empty"
  | "property_invalid"
  | "identifier_duplicate"
  | "unexpected";

export class FeedError extends Error {
  readonly reason: FeedFailureReason;
  constructor(reason: FeedFailureReason, message: string) {
    super(message);
    this.name = "FeedError";
    this.reason = reason;
  }
}
