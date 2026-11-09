/**
 * The device fields of the deprecated web deferred match (shared-spec/RECIPE.md). Kept only so
 * `StraitConfig.device` and the `DeviceFields` export still compile; removed in 0.9.0 (ADR 0003).
 */
export interface DeviceFields {
  screenWidth: number;
  pixelRatio: number;
  language: string;
  timezone: string;
}
