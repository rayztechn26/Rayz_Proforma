import {AccountInput as Input} from "./AccountInput";
import {ChangePassword} from "./ChangePassword";
import { Text, TextInput } from "./typography";
import { formatAmount } from "./amounts";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Alert,
  Image,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { api, authenticate, logout, configured } from "./api";
import {
  assertLicense,
  loadLicense,
  nativeKeys,
  proof,
  recoverCompany,
  registerCompany,
} from "./licensing";
import {
  getRepo,
  logoData,
  exportBackup,
  pickBackup,
  restoreBackup,
} from "./native";
import { Company } from "./domain";
import { ApiError } from "./api-response";
import { RegistrationDraft, readRegistrationDraft, writeRegistrationDraft, clearRegistrationDraft } from "./registration-draft";
import { useLocale } from "./locale";
import { LanguageSwitch } from "./LanguageSwitch";
import { ServiceNotice } from "./ServiceNotice";
type Account = {
  phone: string;
  settings: Record<string, any>;
  payments: any[];
  entitlements: { id: string }[];
  companies: any[];
  changes: any[];
};
const ActivationContext = createContext<{
  saveCompany: (c: Company) => Promise<void>;
  companyDraft?: RegistrationDraft | null;
  saveCompanyDraft?: (c: Company, confirmed: boolean) => void;
}>({
  saveCompany: async () => {
    throw Error("Activation required");
  },
});
export const useActivation = () => useContext(ActivationContext);
function Action({
  label,
  onPress,
  disabled = false,
  variant = "secondary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: variant === "primary" ? "#117568" : variant === "quiet" ? "transparent" : "#fff",
        borderColor: "#cbdcd6",
        borderWidth: variant === "secondary" ? 1 : 0,
        minHeight: 44,
        justifyContent: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 9,
        marginVertical: 4,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: variant === "primary" ? "#fff" : "#245950", fontSize: 14, fontWeight: "600", textAlign: "center", lineHeight: 21 }}>
        {label}
      </Text>
    </Pressable>
  );
}
export function ActivationGate({
  companyId,
  page,
  recordId,
  children,
}: {
  companyId: string;
  page?: string;
  recordId?: string;
  children: React.ReactNode;
}) {
  const { t, setLanguage } = useLocale();
  const [ready, setReady] = useState(false),
    [valid, setValid] = useState(false),
    [account, setAccount] = useState<Account | null>(null),
    [signedIn, setSignedIn] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [accountError, setAccountError] = useState("");
  const [registrationStarted, setRegistrationStarted] = useState(false);
  const [phone, setPhone] = useState(""),
    [password, setPassword] = useState(""),
    [register, setRegister] = useState(false),
    [payer, setPayer] = useState(""),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [previous, setPrevious] = useState<string | undefined>();
  const [reason, setReason] = useState(""),
    [newName, setNewName] = useState(""),
    [newTin, setNewTin] = useState("");
  const target = page === "company" && recordId ? recordId : companyId;
  const newForm = page === "company" && !recordId;
  const draft = account ? readRegistrationDraft(getRepo(), account.phone) : null;
  const routeApproved = (next: Account) => {
    // Do not replace an existing company form or silently link legacy data.
    if (page !== "company" && !valid && !getRepo().companies().length && (next.entitlements.length || readRegistrationDraft(getRepo(), next.phone)?.entitlementId))
      router.replace({ pathname: "/[page]", params: { page: "company" } });
  };
  const refresh = async () => {
    try {
      const next = await api<Account>("/account");
      if (!next || typeof next.phone !== "string" || !next.settings || !Array.isArray(next.entitlements) || !Array.isArray(next.companies) || !Array.isArray(next.payments) || !Array.isArray(next.changes))
        throw Error("Account status could not be read. Please retry.");
      setAccount(next);
      setAccountError("");
      setSignedIn(true);
      if (newForm && (next.entitlements.length || readRegistrationDraft(getRepo(), next.phone)?.entitlementId)) setRegistrationStarted(true);
      routeApproved(next);
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : String(e));
      if (e instanceof ApiError && e.kind === "http" && e.status === 401) { setSignedIn(false); setAccount(null); setRegistrationStarted(false); }
      throw e;
    }
  };
  const check = async () => {
    let ok = false;
    try {
      if (target) {
        await loadLicense(target);
        assertLicense(target, getRepo().company(target));
        ok = true;
      }
    } catch {}
    setValid(ok);
    setSignedIn(!!(await SecureStore.getItemAsync("account.token")));
    setReady(true);
  };
  useEffect(() => {
    setReady(false);
    setValid(false);
    check();
    refresh().catch(() => {});
    const s = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        check();
        refresh().catch(() => {});
      }
    });
    return () => s.remove();
  }, [target, page]);
  const task = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const saveCompany = async (c: Company) => {
    c = { ...c, name: c.name.trim(), tin: c.tin.trim() };
    const existing = getRepo()
      .companies()
      .find((x) => x.id === c.id);
    // The optional stamp is a local document asset, not activation authority.
    const { stamp, termsAndConditions, ...remoteProfile } = c;
    const profile = { ...remoteProfile, logo: await logoData(c.logo) };
    if (!profile.logo) throw Error("Choose a JPG or PNG company logo.");
    if (existing) {
      assertLicense(c.id, existing);
      await api("/companies/" + encodeURIComponent(c.id), { profile }, "PUT");
    } else {
      const pending = account ? readRegistrationDraft(getRepo(), account.phone) : null;
      const entitlementId = (pending?.company.id === c.id ? pending.entitlementId : undefined) || account?.entitlements[0]?.id;
      if (!entitlementId || !account) throw Error("Approved unused entitlement required. Refresh status and retry.");
      // Save stable company/entitlement IDs before any request. A lost response
      // can then be retried with a fresh proof even after account refresh/restart.
      writeRegistrationDraft(getRepo(), account.phone, c, true, entitlementId);
      const canonical = await registerCompany(profile, entitlementId);
      if (canonical) c = { ...canonical, logo: c.logo, ...(stamp !== undefined ? {stamp} : {}), ...(termsAndConditions !== undefined ? {termsAndConditions} : {}) };
      assertLicense(c.id, c);
    }
    getRepo().saveCompany(c);
    if (!existing && account) clearRegistrationDraft(getRepo(), account.phone);
    setValid(true);
    await refresh().catch(() => {});
  };
  const open =
    ready &&
    page !== "activation" &&
    ((newForm && signedIn && (!!account?.entitlements.length || !!draft?.entitlementId || registrationStarted)) || (!newForm && valid));
  if (open)
    return (
      <ActivationContext.Provider value={{ saveCompany, companyDraft: draft, saveCompanyDraft: (c, confirmed) => { if (account) writeRegistrationDraft(getRepo(), account.phone, c, confirmed); } }}>
        {accountError && newForm ? <View style={{ backgroundColor: "#f0f5f4", padding: 12 }}><ServiceNotice message={accountError} /><Action label={t("Retry")} disabled={busy} onPress={() => task(refresh)} /></View> : null}
        {children}
      </ActivationContext.Provider>
    );
  const s = accountError ? undefined : account?.settings;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f5f4" }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 10, maxWidth: 600, width: "100%", alignSelf: "center" }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image
            source={require("../assets/icon.png")}
            accessibilityLabel="Rayz Technology logo"
            style={{ width: 36, height: 36, borderRadius: 8 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 16, fontWeight: "600", flex: 1, color: "#15393e" }}>Rayz Proforma</Text>
          <LanguageSwitch />
        </View>
        <Text style={{ fontSize: 26, lineHeight: 35, marginTop: 14, fontWeight: "600", color: "#15393e" }}>
          {t("All in One Proformas")}
        </Text>
        <Text style={{ color: "#607679", fontSize: 13 }}>{t("Activation & recovery")}</Text>
        {!configured() && (
          <Text accessibilityRole="alert">
            {t(
              "The activation server is not configured. Contact support. Business records are preserved.",
            )}
          </Text>
        )}
        {!ready && <ActivityIndicator />}
        {error ? (
          <ServiceNotice message={error} />
        ) : null}
        {busy && <ActivityIndicator />}
        {accountError && signedIn ? <View><ServiceNotice message={accountError} /><Text style={{ fontSize: 12, color: "#607679", marginTop: 8 }}>{t("Account and payment settings could not be refreshed. Please retry.")}</Text><Action label={t("Retry")} disabled={busy} onPress={() => task(refresh)} /></View> : null}
        {!signedIn ? (
          <View style={{ backgroundColor: "white", borderWidth: 1, borderColor: "#dce6e2", borderRadius: 14, padding: 16, marginTop: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#15393e", marginBottom: 6 }}>{t(register ? "Create account" : "Sign in")}</Text>
            <Text style={{ fontSize: 12, lineHeight: 20, color: "#607679", marginBottom: 8 }}>{t("Manage your company activation and payments.")}</Text>
            <Input
              label={t("Account phone (+ country code)")}
              value={phone}
              set={setPhone}
              phoneInput
            />
            <Input
              label={t("Password")}
              value={password}
              set={setPassword}
              secret
              numericPassword={register}
              newPassword={register}
            />
            {register && <Text style={{ fontSize: 12, lineHeight: 20, color: "#607679" }}>
              {t(
                "Use at least 6 digits for your password.",
              )}
            </Text>}
            {register && <Text style={{ fontSize: 12, lineHeight: 20, color: "#607679", marginVertical: 6 }}>{t("Phone verification by SMS is not enabled.")}</Text>}
            <Action
              variant="primary"
              disabled={busy}
              label={t(register ? "Create account" : "Sign in")}
              onPress={() =>
                task(async () => {
                  if (register && !/^[0-9]{6,72}$/.test(password)) throw new Error("Use at least 6 digits for your password.");
                  await authenticate(register, phone, password);
                  setPassword("");
                  setSignedIn(true);
                  await refresh();
                })
              }
            />
            <Action
              variant="quiet"
              label={t(
                register
                  ? "Already have an account? Sign in"
                  : "New account? Register",
              )}
              onPress={() => setRegister(!register)}
            />
          </View>
        ) : (
          <>
            <Text>
              {t("Account phone")}:{" "}
              {account?.phone || t("Connect to refresh account")}
            </Text>
            <ChangePassword />
            <Action
              disabled={busy}
              label={t("Refresh status")}
              variant="primary"
              onPress={() => task(refresh)}
            />
            <Action
              disabled={busy}
              label={t("Sign out")}
              variant="quiet"
              onPress={() =>
                task(async () => {
                  try { await logout(); } finally { setAccount(null); setSignedIn(false); setRegistrationStarted(false); }
                })
              }
            />
            {s?.enabled ? (
              <View>
                <Text style={{ fontSize: 22, fontWeight: "bold" }}>
                  {s.fee} ETB · {t("One-time company activation")}
                </Text>
                <Text>
                  {s.merchant}
                  {"\n"}
                  {s.recipient}
                  {"\n"}
                  {s.instructions}
                  {"\n"}
                  {t("Expected review time")}: {s.waiting}
                  {"\n"}
                  {t("Support")}: {s.support}
                </Text>
                <Text>
                  {t(
                    "Pay externally in Telebirr. Approval requires an independent administrator check.",
                  )}
                </Text>
              </View>
            ) : account && !accountError ? (
              <Text>
                {t(
                  "New payments are unavailable until the administrator configures the fee and instructions.",
                )}
              </Text>
            ) : null}
            {account?.payments.map((p) => (
              <View
                key={p.id}
                style={{
                  backgroundColor: "white",
                  padding: 16,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontWeight: "bold" }}>
                  {t(p.status)} · {p.id}
                </Text>
                <Text>
                  {t("Payer phone")}: {p.payer_phone}
                  {"\n"}
                  {t("Transaction reference")}: {p.reference}
                  {"\n"}
                  {t("Submitted")}: {p.created_at}
                  {"\n"}
                  {t("Expected fee")}: {formatAmount((p.expected_cents / 100).toFixed(2))} ETB
                </Text>
                <Text>{p.note}</Text>
                {p.instructions && (
                  <Text>
                    {(() => {
                      try {
                        const snapshot =
                          typeof p.instructions === "string"
                            ? JSON.parse(p.instructions)
                            : p.instructions;
                        return [
                          snapshot.merchant,
                          snapshot.recipient,
                          snapshot.instructions,
                          snapshot.waiting,
                        ]
                          .filter(Boolean)
                          .join("\n");
                      } catch {
                        return "";
                      }
                    })()}
                  </Text>
                )}
                {p.reason && (
                  <Text>
                    {t("Review reason")}: {p.reason}
                  </Text>
                )}
                {p.status === "rejected" && (
                  <Action
                    disabled={busy}
                    label={t("Correct this submission")}
                    onPress={() => {
                      setPrevious(p.id);
                      setPayer(p.payer_phone);
                      setReference("");
                      setNote("");
                    }}
                  />
                )}
              </View>
            ))}
            {!!account?.entitlements.length && (
              <Action
                disabled={busy}
                label={t("Register approved company")}
                variant="primary"
                onPress={() =>
                  router.push({
                    pathname: "/[page]",
                    params: { page: "company" },
                  })
                }
              />
            )}
            {s?.enabled && (
              <View>
                <Text style={{ fontSize: 20 }}>
                  {t(
                    previous
                      ? "Corrected payment submission"
                      : "Submit payment for a company",
                  )}
                </Text>
                <Text>
                  {t("Account phone")}: {account?.phone}
                </Text>
                <Input
                  label={t("Payer phone (+ country code)")}
                  value={payer}
                  set={setPayer}
                  phoneInput
                />
                <Input
                  label={t("Transaction reference / FT number")}
                  value={reference}
                  set={setReference}
                />
                <Input label={t("Optional note")} value={note} set={setNote} />
                <Action
                  disabled={busy}
                  label={t(
                    receipt
                      ? "Receipt selected — change"
                      : "Attach optional JPG / PNG receipt",
                  )}
                  onPress={() =>
                    task(async () => {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ["images"],
                        quality: 1,
                      });
                      if (!result.canceled) {
                        const a = result.assets[0]!;
                        if (
                          !["image/png", "image/jpeg"].includes(
                            a.mimeType || "",
                          ) ||
                          (a.fileSize || 0) > 5 * 1024 * 1024
                        )
                          throw Error("Select JPG/PNG no larger than 5 MB.");
                        setReceipt(a);
                      }
                    })
                  }
                />
                <Action
                  disabled={busy || !payer || !reference}
                  label={t("Submit for manual review")}
                  variant="primary"
                  onPress={() =>
                    task(async () => {
                      // Persist retry ID before the network call; a timeout can safely retry the same request.
                      const payload = JSON.stringify({
                        payer,
                        reference,
                        note,
                        previous: previous || "",
                        receipt: receipt?.uri || "",
                      });
                      const stored =
                        await SecureStore.getItemAsync("payment.retry");
                      let retry: { payload: string; id: string } | null = null;
                      try {
                        retry = stored ? JSON.parse(stored) : null;
                      } catch {}
                      const key =
                        retry && retry.payload === payload
                          ? retry.id
                          : nativeKeys().randomId();
                      await SecureStore.setItemAsync(
                        "payment.retry",
                        JSON.stringify({ payload, id: key }),
                      );
                      const form = new FormData();
                      form.append("idempotency", key);
                      form.append("payer_phone", payer);
                      form.append("reference", reference);
                      form.append("note", note);
                      if (previous) form.append("previous_id", previous);
                      if (receipt)
                        form.append("receipt", {
                          uri: receipt.uri,
                          type: receipt.mimeType,
                          name: receipt.fileName || "receipt.png",
                        } as any);
                      await api("/payments", form);
                      await SecureStore.deleteItemAsync("payment.retry");
                      setReference("");
                      setNote("");
                      setReceipt(null);
                      setPrevious(undefined);
                      await refresh();
                    })
                  }
                />
              </View>
            )}
            {!!account?.companies.length && (
              <View>
                <Text style={{ fontSize: 21 }}>
                  {t("Existing licences / device transfer")}
                </Text>
                <Input
                  label={t("Ownership explanation / correction reason")}
                  value={reason}
                  set={setReason}
                />
                <Input
                  label={t("Corrected legal name (identity correction only)")}
                  value={newName}
                  set={setNewName}
                />
                <Input
                  label={t("Corrected TIN (identity correction only)")}
                  value={newTin}
                  set={setNewTin}
                />
                {account.companies.map((c) => (
                  <View key={c.id}>
                    <Text>
                      {c.name} · {c.id}
                    </Text>
                    <Action
                      disabled={busy}
                      label={t("Recover licence / finish approved transfer")}
                      onPress={() =>
                        task(async () => {
                          const transfer = account.changes.find(
                            (x) =>
                              x.company_id === c.id &&
                              x.kind === "transfer" &&
                              x.status === "approved",
                          );
                          const profile = await recoverCompany(
                            c.id,
                            transfer?.id,
                          );
                          const local = getRepo()
                            .companies()
                            .find((x) => x.id === c.id);
                          getRepo().saveCompany({
                            ...profile,
                            logo: local?.logo || profile.logo,
                            ...(local?.stamp !== undefined ? {stamp:local.stamp} : {}),
                            ...(local?.termsAndConditions !== undefined ? {termsAndConditions:local.termsAndConditions} : {}),
                          });
                          getRepo().setSetting("activeCompany", c.id);
                          await check();
                          router.replace("/");
                        })
                      }
                    />
                    <Action
                      disabled={busy || reason.length < 10}
                      label={t(
                        "Request administrator-approved device transfer",
                      )}
                      onPress={() =>
                        task(async () => {
                          await api(`/companies/${c.id}/changes`, {
                            kind: "transfer",
                            reason,
                            ...(await proof()),
                          });
                          await refresh();
                        })
                      }
                    />
                    <Action
                      disabled={
                        busy || reason.length < 10 || !newName || !newTin
                      }
                      label={t("Request legal name / TIN correction")}
                      onPress={() =>
                        task(async () => {
                          await api(`/companies/${c.id}/changes`, {
                            kind: "identity",
                            reason,
                            name: newName,
                            tin: newTin,
                          });
                          await refresh();
                        })
                      }
                    />
                  </View>
                ))}
                {account.changes.map((c) => (
                  <Text key={c.id}>
                    {c.kind}: {t(c.status)} · {c.reason}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
        {!!getRepo().companies().length && (
          <View>
            <Text>
              {t(
                "Existing local records are preserved. Linking needs an unused approved entitlement, or an administrator grant after ownership checks.",
              )}
            </Text>
            {account?.entitlements.length
              ? getRepo()
                  .companies()
                  .map((c) => (
                    <Action
                      disabled={busy}
                      key={c.id}
                      label={t("Link existing company") + ": " + c.name}
                      onPress={() =>
                        task(async () => {
                          const logo = await logoData(c.logo);
                          await registerCompany(
                            { ...c, logo },
                            account.entitlements[0]!.id,
                          );
                          getRepo().setSetting("activeCompany", c.id);
                          await check();
                          await refresh();
                          router.replace("/");
                        })
                      }
                    />
                  ))
              : null}
          </View>
        )}
        <View style={{ borderTopWidth: 1, borderTopColor: "#dce6e2", paddingTop: 16, marginTop: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: "#314e54", marginBottom: 6 }}>{t("Data & backup")}</Text>
        <Text style={{ fontSize: 12, lineHeight: 20, color: "#607679", marginBottom: 8 }}>{t("Backups preserve business records; they do not transfer activation.")}</Text>
        <Action
          disabled={busy}
          label={t("Export business data backup")}
          onPress={() => task(exportBackup)}
        />
        <Action
          disabled={busy}
          label={t("Restore business data (does not activate)")}
          onPress={() =>
            task(async () => {
              const m = await pickBackup();
              if (m)
                Alert.alert(
                  t("Replace local business records?"),
                  t(
                    "Validated backup will replace local business records. Licences and accounts are separate.",
                  ),
                  [
                    { text: t("Cancel") },
                    {
                      text: t("Restore"),
                      onPress: () =>
                        task(async () => {
                          await restoreBackup(m);
                          setLanguage(m.settings.language || "en");
                          await check();
                        }),
                    },
                  ],
                );
            })
          }
        />
        </View>
        {valid && (
          <Action
            label={t("Open activated workspace")}
            onPress={() => router.replace("/")}
          />
        )}
        <Text style={{ textAlign: "center", fontSize: 11, lineHeight: 18, color: "#607679", marginTop: 16 }}>
          {t("Developed by Rayz Technology plc")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
