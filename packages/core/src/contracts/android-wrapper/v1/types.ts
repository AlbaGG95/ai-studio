export type AndroidWrapperSchemaVersion = "android-wrapper@1";
export type AndroidWrapperOrientation = "portrait" | "landscape";

export interface AndroidWrapperSpec {
  schemaVersion: AndroidWrapperSchemaVersion;
  appId: string;
  appName: string;
  versionCode: number;
  versionName: string;
  orientation: AndroidWrapperOrientation;
  minSdk?: number;
  targetSdk?: number;
  cleartextTraffic?: boolean;
  webviewDebug?: boolean;
}

export interface AndroidWrapperValidationResult {
  valid: boolean;
  errors?: string[];
  data?: AndroidWrapperSpec;
}
