import React from "react";
import { Text, TextInput, Pressable, AppState } from "react-native";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivationGate, useActivation } from "../src/ActivationGate";
import { api, authenticate } from "../src/api";
import { router } from "expo-router";
import { registerCompany } from "../src/licensing";
import { LanguageProvider } from "../src/locale";
import { newCompany } from "../src/domain";
let mockAccount: any;
let mockValid = false;
let mockToken: string | null = null;
let mockCompanies: any[] = [];
let mockSettings: Record<string, string> = {};
const mockSaveCompany = jest.fn((company: any) => {mockCompanies.push(company);});
jest.mock("../src/api", () => ({
  api: jest.fn(async () => {
    if (!mockToken) throw Error("Offline or unauthenticated");
    return mockAccount;
  }),
  configured: () => false,
  authenticate: jest.fn(),
  logout: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => mockToken),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("../src/native", () => ({
  getRepo: () => ({
    companies: () => mockCompanies,
    company: (id: string) => mockCompanies.find((c) => c.id === id),
    setting: (key: string) => mockSettings[key],
    setSetting: (key: string, value: string) => { mockSettings[key] = value; },
    saveCompany: mockSaveCompany,
  }),
  exportBackup: jest.fn(),
  pickBackup: jest.fn(),
  logoData: jest.fn(async (uri: string) => uri ? "data:image/png;base64,example" : ""),
}));
jest.mock("../src/licensing", () => ({
  loadLicense: jest.fn(async () => {
    if (!mockValid) throw Error("Invalid license");
  }),
  assertLicense: jest.fn(() => {
    if (!mockValid) throw Error("Invalid license");
  }),
  nativeKeys: jest.fn(),
  proof: jest.fn(),
  recoverCompany: jest.fn(),
  registerCompany: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
  (api as jest.Mock).mockImplementation(async () => {
    if (!mockToken) throw Error("Offline or unauthenticated");
    return mockAccount;
  });
  mockAccount = {
    phone: "+251911111111",
    settings: { enabled: false },
    payments: [],
    entitlements: [],
    companies: [],
    changes: [],
  };
  mockToken = null;
  mockValid = false;
  mockCompanies = [];
  mockSettings = {};
});
function launch(page?: string, companyId = "") {
  return render(
    <SafeAreaProvider>
      <LanguageProvider initialLanguage="en" onChange={() => {}}>
        <ActivationGate page={page} companyId={companyId}>
          <Text>Protected workspace</Text>
        </ActivationGate>
      </LanguageProvider>
    </SafeAreaProvider>,
  );
}
test("unconfigured, unactivated install shows account recovery and no company fields", async () => {
  launch("company");
  await waitFor(() =>
    expect(
      screen.getByText(
        "The activation server is not configured. Contact support. Business records are preserved.",
      ),
    ).toBeOnTheScreen(),
  );
  expect(screen.queryByText("Protected workspace")).toBeNull();
  expect(screen.queryByLabelText("Business / legal name *")).toBeNull();
  expect(
    screen.getByLabelText("Account phone (+ country code)"),
  ).toBeOnTheScreen();
});
test("pending payment cannot open company registration; rejection reason is visible", async () => {
  mockToken = "token";
  mockAccount.payments = [
    {
      id: "request",
      status: "rejected",
      reason: "Reference not found in merchant records",
      expected_cents: 10000,
      payer_phone: "+251933333333",
      reference: "FT",
      created_at: "2026-10-19",
    },
  ];
  launch("company");
  await waitFor(() =>
    expect(screen.getByText(/Reference not found/)).toBeOnTheScreen(),
  );
  expect(screen.queryByText("Protected workspace")).toBeNull();
  expect(screen.getByText("Correct this submission")).toBeOnTheScreen();
});
test("approved unused entitlement opens only company registration", async () => {
  mockToken = "token";
  mockAccount.entitlements = [{ id: "approved" }];
  launch("company");
  await waitFor(() =>
    expect(screen.getByText("Protected workspace")).toBeOnTheScreen(),
  );
});
test("valid current-device license opens existing workspace while account server is offline", async () => {
  (api as jest.Mock).mockRejectedValue(Error("Service unavailable"));
  mockValid = true;
  const company = { ...newCompany(), name: "Example", tin: "123" };
  mockCompanies = [company];
  launch(undefined, company.id);
  await waitFor(() =>
    expect(screen.getByText("Protected workspace")).toBeOnTheScreen(),
  );
});

test("failed settings fetch shows Retry and service error without claiming fees are unconfigured", async () => {
  mockToken = "token";
  (api as jest.Mock).mockRejectedValue(Error("Hosting blocked this connection"));
  launch("activation");
  await waitFor(() => expect(screen.getByText("Retry")).toBeOnTheScreen());
  expect(screen.getByText("Hosting blocked this connection")).toBeOnTheScreen();
  expect(screen.queryByText(/until the administrator configures/)).toBeNull();
  (api as jest.Mock).mockResolvedValue(mockAccount);
  fireEvent.press(screen.getByText("Retry"));
  await waitFor(() => expect(screen.getByText(/until the administrator configures/)).toBeOnTheScreen());
});

test("successful approved refresh routes first-time users to company registration", async () => {
  mockToken = "token";
  mockAccount.entitlements = [{ id: "approved" }];
  launch("activation");
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: "/[page]", params: { page: "company" } }));
});

function DraftForm() {
  const activation = useActivation();
  const [company, setCompany] = React.useState(activation.companyDraft?.company || { ...newCompany(), logo: "file:///permanent-logo.jpg", stamp:"file:///organization-stamp.png", termsAndConditions:"Local custom terms" });
  return <><TextInput accessibilityLabel="Draft name" value={company.name} onChangeText={(name) => { const next = { ...company, name }; setCompany(next); activation.saveCompanyDraft?.(next, true); }} /><Text>{company.logo}</Text><Pressable onPress={() => { activation.saveCompany(company).catch(() => {}); }}><Text>Submit draft</Text></Pressable></>;
}

test("refresh failure keeps company fields/logo mounted and restart restores the same registration ID", async () => {
  mockToken = "token";
  mockAccount.entitlements = [{ id: "approved" }];
  const state = jest.spyOn(AppState, "addEventListener");
  const mount = () => render(<SafeAreaProvider><LanguageProvider><ActivationGate page="company" companyId=""><DraftForm /></ActivationGate></LanguageProvider></SafeAreaProvider>);
  const first = mount();
  await waitFor(() => expect(screen.getByLabelText("Draft name")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Draft name"), "Preserved Trading");
  const saved = Object.values(mockSettings).find((value) => value.includes("Preserved Trading"))!;
  const id = JSON.parse(saved).company.id;
  (api as jest.Mock).mockRejectedValue(Error("Connection failed"));
  await act(async () => { const listener = state.mock.calls[state.mock.calls.length - 1]![1]; listener("active"); });
  expect(screen.getByLabelText("Draft name")).toHaveDisplayValue("Preserved Trading");
  expect(screen.getByText("file:///permanent-logo.jpg")).toBeOnTheScreen();
  expect(screen.queryByText(/until the administrator configures/)).toBeNull();
  first.unmount();
  (api as jest.Mock).mockResolvedValue(mockAccount);
  mount();
  await waitFor(() => expect(screen.getByLabelText("Draft name")).toHaveDisplayValue("Preserved Trading"));
  expect(JSON.parse(Object.values(mockSettings).find((value) => value.includes("Preserved Trading"))!).company.id).toBe(id);
});

test("registration keeps the local stamp after the server returns its canonical company profile",async()=>{
  mockToken="token";mockAccount.entitlements=[{id:"approved"}];
  (registerCompany as jest.Mock).mockImplementation(async profile=>{mockValid=true;return profile;});
  render(<SafeAreaProvider><LanguageProvider><ActivationGate page="company" companyId=""><DraftForm /></ActivationGate></LanguageProvider></SafeAreaProvider>);
  await waitFor(()=>expect(screen.getByLabelText("Draft name")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Draft name"),"Example");fireEvent.press(screen.getByText("Submit draft"));
  await waitFor(()=>expect(mockSaveCompany).toHaveBeenCalled());
  expect((registerCompany as jest.Mock).mock.calls[0][0].stamp).toBeUndefined();
  expect((registerCompany as jest.Mock).mock.calls[0][0].termsAndConditions).toBeUndefined();
  expect(mockSaveCompany.mock.calls[0]![0].termsAndConditions).toBe("Local custom terms");
  expect(mockSaveCompany).toHaveBeenCalledWith(expect.objectContaining({name:"Example",stamp:"file:///organization-stamp.png", termsAndConditions:"Local custom terms"}));
});

test("lost registration response retains the entitlement assignment after refresh removes it from unused list", async () => {
  mockToken = "token";
  mockAccount.entitlements = [{ id: "approved-once" }];
  (registerCompany as jest.Mock).mockRejectedValue(Error("Response lost"));
  const state = jest.spyOn(AppState, "addEventListener");
  render(<SafeAreaProvider><LanguageProvider><ActivationGate page="company" companyId=""><DraftForm /></ActivationGate></LanguageProvider></SafeAreaProvider>);
  await waitFor(() => expect(screen.getByLabelText("Draft name")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Draft name"), "Retried Company");
  fireEvent.press(screen.getByText("Submit draft"));
  await waitFor(() => expect(registerCompany).toHaveBeenCalledTimes(1));
  const first = (registerCompany as jest.Mock).mock.calls[0];
  mockAccount = { ...mockAccount, entitlements: [], companies: [{ id: first[0].id }] };
  await act(async () => { state.mock.calls[state.mock.calls.length - 1]![1]("active"); });
  expect(screen.getByLabelText("Draft name")).toHaveDisplayValue("Retried Company");
  fireEvent.press(screen.getByText("Submit draft"));
  await waitFor(() => expect(registerCompany).toHaveBeenCalledTimes(2));
  expect((registerCompany as jest.Mock).mock.calls[1][0].id).toBe(first[0].id);
  expect((registerCompany as jest.Mock).mock.calls[1][1]).toBe("approved-once");
});
test("copied business records without device licence stay locked and preserved", async () => {
  const company = { ...newCompany(), name: "Copied records", tin: "123" };
  mockCompanies = [company];
  launch(undefined, company.id);
  await waitFor(() =>
    expect(
      screen.getByText(/Existing local records are preserved/),
    ).toBeOnTheScreen(),
  );
  expect(screen.queryByText("Protected workspace")).toBeNull();
  expect(mockCompanies).toHaveLength(1);
});

test("new user registration accepts six or more digits and retains leading zeros", async () => {
  launch();
  await waitFor(() => expect(screen.getByText("New account? Register")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("New account? Register"));
  expect(screen.getByLabelText("Password").props.keyboardType).toBe("number-pad");
  expect(screen.getByLabelText("Password").props.maxLength).toBe(72);
  expect(screen.getByText("Use at least 6 digits for your password.")).toBeOnTheScreen();
  fireEvent.changeText(screen.getByLabelText("Account phone (+ country code)"), "+251944444444");
  fireEvent.changeText(screen.getByLabelText("Password"), "abc123");
  fireEvent.press(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(authenticate).not.toHaveBeenCalled());
  fireEvent.changeText(screen.getByLabelText("Password"), "042681234");
  fireEvent.press(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(authenticate).toHaveBeenCalledWith(true, "+251944444444", "042681234"));
});

test("existing account sign in keeps the full password and regular keyboard", async () => {
  launch();
  await waitFor(() => expect(screen.getByLabelText("Password")).toBeOnTheScreen());
  expect(screen.getByLabelText("Password").props.maxLength).toBeUndefined();
  expect(screen.getByLabelText("Password").props.keyboardType).toBe("default");
  fireEvent.changeText(screen.getByLabelText("Account phone (+ country code)"), "+251944444444");
  fireEvent.changeText(screen.getByLabelText("Password"), "LegacyPassword123");
  fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(authenticate).toHaveBeenCalledWith(false, "+251944444444", "LegacyPassword123"));
});
