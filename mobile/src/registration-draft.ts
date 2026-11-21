import { Company } from "./domain";
type Store = { setting: (key: string) => string | undefined; setSetting: (key: string, value: string) => unknown };
export type RegistrationDraft = { owner: string; company: Company; confirmed: boolean; entitlementId?: string };
const key = (owner: string) => "registration.draft." + owner;
export function readRegistrationDraft(store: Store, owner: string): RegistrationDraft | null {
  if (!owner) return null;
  try {
    const draft = JSON.parse(store.setting(key(owner)) || "null");
    return draft?.owner === owner && typeof draft.company?.id === "string" && typeof draft.company?.logo === "string" ? draft : null;
  } catch { return null; }
}
export function writeRegistrationDraft(store: Store, owner: string, company: Company, confirmed: boolean, entitlementId?: string) {
  if (!owner) return;
  const previous = readRegistrationDraft(store, owner);
  store.setSetting(key(owner), JSON.stringify({ owner, company, confirmed, entitlementId: entitlementId || (previous?.company.id === company.id ? previous.entitlementId : undefined) }));
}
export function clearRegistrationDraft(store: Store, owner: string) { store.setSetting(key(owner), ""); }
