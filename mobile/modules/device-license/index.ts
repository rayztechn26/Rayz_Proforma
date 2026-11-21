import { requireOptionalNativeModule } from "expo-modules-core";
export interface DeviceLicenseNative {
  ensureKey(): string;
  sign(message: string): string;
  verify(token: string, companyId: string, keysJson: string): string;
  randomId(): string;
}
export const deviceLicense =
  requireOptionalNativeModule<DeviceLicenseNative>("DeviceLicense");
