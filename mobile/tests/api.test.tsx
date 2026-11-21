import * as SecureStore from "expo-secure-store";
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(async () => "token"), deleteItemAsync: jest.fn() }));
process.env.EXPO_PUBLIC_API_URL = "https://proforma.rayztechnology.com/api";
const { api } = require("../src/api");
beforeEach(() => { jest.clearAllMocks(); });
function response(status: number, type: string, body: string) {
  global.fetch = jest.fn(async () => ({ status, headers: { get: (key: string) => key === "content-type" ? type : null }, text: async () => body })) as any;
}
test("hosting-generated 401 does not erase authentication", async () => {
  response(401, "text/html", "<html>Imunify360 challenge</html>");
  await expect(api("/account")).rejects.toMatchObject({ kind: "hosting", status: 401 });
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
test("Laravel JSON 401 clears the expired token", async () => {
  response(401, "application/json", '{"message":"Unauthenticated"}');
  await expect(api("/account")).rejects.toMatchObject({ kind: "http", status: 401 });
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("account.token");
});
test("network failure preserves token and exposes a retryable connection error", async () => {
  global.fetch = jest.fn(async () => { throw Error("Network request failed"); }) as any;
  await expect(api("/companies", {})).rejects.toMatchObject({ kind: "connection", status: null, endpoint: "/api/companies", method: "POST" });
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
