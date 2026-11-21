import * as SecureStore from "expo-secure-store";
import { deviceLicense } from "../modules/device-license";
import keys from "./license-keys.json";
import { api } from "./api";
import type { Company } from "./domain";
const tokens = new Map<string, string>();
function verifyBoundLicense(token: string, companyId: string, identity?: Pick<Company, "name" | "tin">) {
  const claims = JSON.parse(nativeKeys().verify(token, companyId, JSON.stringify(keys)));
  if (identity && (identity.name !== claims.company_name || identity.tin !== claims.company_tin))
    throw Error("Company identity differs from its signed licence. Recover the approved profile or request an identity correction. Records are preserved.");
  return claims;
}
export function nativeKeys() {
  if (!deviceLicense)
    throw Error(
      "Install the Android development build or signed APK. Expo Go cannot provide protected device licensing.",
    );
  return deviceLicense;
}
export async function loadLicense(companyId: string) {
  const token = await SecureStore.getItemAsync("license." + companyId);
  if (token) tokens.set(companyId, token);
  else tokens.delete(companyId);
  assertLicense(companyId);
}
export function assertLicense(
  companyId: string,
  identity?: Pick<Company, "name" | "tin">,
) {
  const token = tokens.get(companyId);
  if (!token)
    throw Error(
      "Company activation is required. Business records are preserved. Open activation and recovery.",
    );
  return verifyBoundLicense(token, companyId, identity);
}
export async function storeLicense(companyId: string, token: string, identity?: Pick<Company, "name" | "tin">) {
  verifyBoundLicense(token, companyId, identity);
  await SecureStore.setItemAsync("license." + companyId, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  tokens.set(companyId, token);
}
export async function proof() {
  const public_key = nativeKeys().ensureKey();
  const c = await api("/challenges", { public_key });
  return { challenge_id: c.id, signature: nativeKeys().sign(c.nonce) };
}
export async function registerCompany(
  profile: Company,
  entitlement_id: string,
) {
  const { stamp: _localStamp, termsAndConditions: _localTerms, ...activationProfile } = profile;
  const result = await api("/companies", {
    profile: activationProfile,
    entitlement_id,
    ...(await proof()),
  });
  const canonical = (result.profile || profile) as Company;
  if (canonical.id !== profile.id) throw Error("Registration returned a different company. Contact support.");
  await storeLicense(profile.id, result.license, canonical);
  return canonical;
}
export async function recoverCompany(companyId: string, transfer_id?: string) {
  const result = await api(
    `/companies/${encodeURIComponent(companyId)}/recover`,
    { ...(await proof()), ...(transfer_id ? { transfer_id } : {}) },
  );
  if (result.profile?.id !== companyId) throw Error("Recovery returned a different company. Contact support.");
  await storeLicense(companyId, result.license, result.profile);
  return result.profile as Company;
}
