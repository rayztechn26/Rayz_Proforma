import { assertLicense, loadLicense, storeLicense, registerCompany } from "../src/licensing";
import { newCompany } from "../src/domain";
import { api } from "../src/api";
import * as SecureStore from "expo-secure-store";
import { deviceLicense } from "../modules/device-license";
const mockVerify = jest.fn();
jest.mock("../modules/device-license", () => ({
  deviceLicense: { verify: (...args: any[]) => mockVerify(...args), ensureKey: () => "device-public-key", sign: (nonce: string) => "signature:" + nonce },
}));
jest.mock("../src/api", () => ({ api: jest.fn() }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "this-device",
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockImplementation(() =>
    JSON.stringify({ company_name: "Example", company_tin: "123" }),
  );
});
test("missing stored licence fails closed", async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  await expect(loadLicense("missing")).rejects.toThrow(
    "activation is required",
  );
});
test("each protected operation invokes native signature and key-possession verification", async () => {
  await storeLicense("bound", "signed-jws");
  assertLicense("bound", { name: "Example", tin: "123" });
  assertLicense("bound", { name: "Example", tin: "123" });
  expect(mockVerify).toHaveBeenCalledTimes(3);
  mockVerify.mockImplementation(() => {
    throw Error("Device key missing");
  });
  expect(() => assertLicense("bound")).toThrow("Device key missing");
});
test("invalid native verification result is never stored as activation", async () => {
  mockVerify.mockImplementation(() => {
    throw Error("Invalid signature");
  });
  await expect(storeLicense("tamper", "modified")).rejects.toThrow(
    "Invalid signature",
  );
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(() => assertLicense("tamper")).toThrow("activation is required");
});
test("changed company identity from a backup cannot repurpose a valid licence", async () => {
  await storeLicense("identity", "signed");
  expect(() =>
    assertLicense("identity", { name: "Other business", tin: "123" }),
  ).toThrow("identity differs");
  expect(() =>
    assertLicense("identity", { name: "Example", tin: "OTHER" }),
  ).toThrow("identity differs");
});

test("registration retries use fresh possession proofs and store no licence on a failed server request", async () => {
  const profile = { ...newCompany(), id: "retry-company", name: "Example", tin: "123" };
  (api as jest.Mock).mockResolvedValueOnce({ id: "challenge-1", nonce: "nonce-1" }).mockRejectedValueOnce(Error("Service failed"));
  await expect(registerCompany(profile, "approved-entitlement")).rejects.toThrow("Service failed");
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(mockVerify).not.toHaveBeenCalled();
  (api as jest.Mock).mockResolvedValueOnce({ id: "challenge-2", nonce: "nonce-2" }).mockResolvedValueOnce({ license: "valid-signed", profile });
  await expect(registerCompany(profile, "approved-entitlement")).resolves.toEqual(profile);
  const registrations = (api as jest.Mock).mock.calls.filter(([path]) => path === "/companies");
  expect(registrations.map(([, body]) => [body.profile.id, body.entitlement_id, body.challenge_id])).toEqual([
    ["retry-company", "approved-entitlement", "challenge-1"], ["retry-company", "approved-entitlement", "challenge-2"],
  ]);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("license.retry-company", "valid-signed", expect.anything());
});

test("registration and existing-company linking never upload the local organization stamp",async()=>{
  const profile={...newCompany(),id:"local-stamp",name:"Example",tin:"123",stamp:"file:///private-organization-stamp.png",termsAndConditions:"Local custom terms"};
  const {stamp,termsAndConditions,...canonical}=profile;
  (api as jest.Mock).mockResolvedValueOnce({id:"challenge",nonce:"nonce"}).mockResolvedValueOnce({license:"valid-signed",profile:canonical});
  await registerCompany(profile,"approved");
  const request=(api as jest.Mock).mock.calls.find(([path])=>path==="/companies")[1];
  expect(request.profile).not.toHaveProperty("stamp");expect(request.profile).not.toHaveProperty("termsAndConditions");expect(profile.stamp).toBe(stamp);expect(profile.termsAndConditions).toBe(termsAndConditions);
});
