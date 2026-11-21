import * as SecureStore from "expo-secure-store";
import { ApiError, readApiResponse } from "./api-response";
export { ApiError } from "./api-response";
const base = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
export const configured = () =>
  /^https:\/\//.test(base) || (__DEV__ && /^http:\/\//.test(base));
export async function api<T = any>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  if (!configured())
    throw Error("The activation server is not configured. Contact support.");
  const token = await SecureStore.getItemAsync("account.token");
  const form = body instanceof FormData;
  const verb = method || (body ? "POST" : "GET");
  const endpoint = "/api" + path.split("?")[0];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
  const response = await fetch(base + path, {
    method: verb,
    signal: controller.signal,
    headers: {
      Accept: "application/json",
      ...(form ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });
  try {
    return readApiResponse(await response.text(), response.status, response.headers.get("content-type") || "", endpoint, verb, response.headers.get("x-request-id") || "") as T;
  } catch (error) {
    // A hosting-generated 401/challenge is not evidence that our token expired.
    if (error instanceof ApiError && error.kind === "http" && error.status === 401)
      await SecureStore.deleteItemAsync("account.token");
    throw error;
  }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to connect to the activation service. Please retry; your details are preserved.", "connection", endpoint, verb, null, "");
  } finally { clearTimeout(timeout); }
}
export async function authenticate(
  register: boolean,
  phone: string,
  password: string,
) {
  const data = await api("/" + (register ? "register" : "login"), {
    phone,
    password,
  });
  await SecureStore.setItemAsync("account.token", data.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return data;
}
export async function logout() {
  try {
    await api("/logout", {});
  } finally {
    await SecureStore.deleteItemAsync("account.token");
  }
}
