import { LanguageSwitch as LanguageControls } from "../src/LanguageSwitch";
import { ServiceNotice } from "../src/ServiceNotice";
import appConfig from "../app.json";
import { Text, TextInput } from "../src/typography";
import { formatAmount, amountInWords } from "../src/amounts";
import { UnitSelect } from "../src/UnitSelect";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  router,
  useLocalSearchParams,
  useFocusEffect,
  useNavigation,
} from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import Decimal from "decimal.js";
import { z } from "zod";
import { useLocale } from "../src/locale";
import { ActivationGate, useActivation } from "../src/ActivationGate";
import { assertLicense } from "../src/licensing";
import {
  Company,
  Customer,
  Catalogue,
  Proforma,
  calculate,
  newCompany,
  newCustomer,
  newDocument,
  id,
  today,
  companySchema,
  customerSchema,
  catalogueSchema,
  documentSchema,
  dateSchema,
} from "../src/domain";
import {
  getRepo,
  chooseLogo,
  chooseStamp,
  stampData,
  logoData,
  pdfAction,
  exportBackup,
  pickBackup,
  restoreBackup,
} from "../src/native";
type Target = {
  screen: string;
  id?: string;
};
const go = (screen: string, id?: string) =>
  router.push({
    pathname: "/[page]",
    params: {
      page: screen,
      ...(id
        ? {
            id,
          }
        : {}),
    },
  });
const titles: Record<string, string> = {
  home: "Your workspace",
  companies: "Companies",
  company: "Company profile",
  customers: "Customers",
  customer: "Customer details",
  catalogue: "Catalogue",
  item: "Catalogue item",
  documents: "Proformas",
  edit: "Compose proforma",
  preview: "Document preview",
  settings: "Settings & backup",
};
function Button({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && s.danger,
        (pressed || disabled) && {
          opacity: 0.5,
        },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          secondary && {
            color: "#174e54",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
function Logo({ uri }: { uri: string }) {
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View style={s.logo}>
      {uri && !failed ? (
        <Image
          source={{
            uri,
          }}
          resizeMode="contain"
          style={{
            width: 120,
            height: 120,
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={s.muted}>{t("Company logo")}</Text>
      )}
    </View>
  );
}
function Field({
  label,
  value,
  onChange,
  numeric = false,
  money = false,
  multiline = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  money?: boolean;
  multiline?: boolean;
  error?: string;
}) {
  const { t } = useLocale();
  const [focused, setFocused] = useState(false);
  const shown = money && !focused && /^\d+(\.\d+)?$/.test(value) ? formatAmount(value) : value;
  return (
    <View
      style={{
        marginBottom: 15,
      }}
    >
      <Text style={s.label}>{t(label)}</Text>
      <TextInput
        accessibilityLabel={t(label)}
        value={shown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={(v) => onChange(money ? v.replace(/,/g, "") : v)}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        autoCapitalize="sentences"
        style={[
          s.input,
          multiline && {
            minHeight: 90,
          },
          error && {
            borderColor: "#ab3636",
          },
        ]}
      />
      {error && <Text style={s.error}>{t(error)}</Text>}
    </View>
  );
}
function Empty({ text }: { text: string }) {
  const { t } = useLocale();
  return (
    <Card>
      <Text style={s.muted}>{t(text)}</Text>
    </Card>
  );
}
function Confirm({
  title,
  message,
  onConfirm,
  cancelText = "Cancel",
  confirmText = "Confirm",
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  cancelText?: string;
  confirmText?: string;
}) {
  Alert.alert(title, message, [
    {
      text: cancelText,
      style: "cancel",
    },
    {
      text: confirmText,
      style: "destructive",
      onPress: onConfirm,
    },
  ]);
}
export default function App() {
  const p = useLocalSearchParams<{
    page?: string;
    id?: string;
  }>();
  const [, refreshScope] = useState(0);
  useFocusEffect(
    useCallback(() => {
      refreshScope((v) => v + 1);
    }, []),
  );
  let scope = "";
  try {
    const r = getRepo();
    scope = r.setting("activeCompany") || r.companies()[0]?.id || "";
  } catch {}
  return (
    <ActivationGate companyId={scope} page={p.page} recordId={p.id}>
      <Workspace
        key={`${scope}:${p.page || "home"}:${p.id || ""}`}
        screen={p.page || "home"}
        recordId={p.id}
      />
    </ActivationGate>
  );
}
function Workspace({
  screen,
  recordId,
}: {
  screen: string;
  recordId?: string;
}) {
  const { t, setLanguage, language } = useLocale();
  const activation = useActivation();
  const confirm = (args: Parameters<typeof Confirm>[0]) =>
    Confirm({
      ...args,
      title: t(args.title),
      message: t(args.message),
      cancelText: t("Cancel"),
      confirmText: t("Confirm"),
    });
  const navigation = useNavigation();
  const [repo] = useState(() => {
    try {
      return getRepo();
    } catch (e) {
      return null;
    }
  });
  const [, setRevision] = useState(0);
  const refresh = () => setRevision((v) => v + 1);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, []),
  );
  const companies = repo?.companies() || [];
  const active =
    companies.find((c) => c.id === repo?.setting("activeCompany")) ||
    companies[0];
  const [dirty, setDirty] = useState(false),
    [pending, setPending] = useState<Target | null>(null);
  usePreventRemove(dirty, ({ data }) =>
    Alert.alert(
      t("Discard unsaved edits?"),
      t("Your changes have not been saved."),
      [
        {
          text: t("Keep editing"),
          style: "cancel",
        },
        {
          text: t("Discard"),
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    ),
  );
  useEffect(() => {
    if (pending && !dirty) {
      if (pending.screen === "home") {
        router.dismissAll();
        router.replace("/");
        setPending(null);
        return;
      }
      router.replace({
        pathname: "/[page]",
        params: {
          page: pending.screen,
          ...(pending.id
            ? {
                id: pending.id,
              }
            : {}),
        },
      });
      setPending(null);
    }
  }, [pending, dirty]);
  const finish = (screen: string, id?: string) => {
    setDirty(false);
    setPending({
      screen,
      id,
    });
  };
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({});
  const run = async (fn: () => unknown | Promise<unknown>, success = "") => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (active && !["company", "settings"].includes(screen))
        assertLicense(active.id);
      await fn();
      refresh();
      if (success) setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const validate = (schema: z.ZodType, value: unknown) => {
    const r = schema.safeParse(value);
    if (r.success) {
      setErrors({});
      return true;
    }
    const map: Record<string, string> = {};
    r.error.issues.forEach((i) => {
      map[i.path.join(".")] = i.message;
    });
    setErrors(map);
    setMessage("Please check the highlighted fields.");
    return false;
  };
  const [company, setCompany] = useState<Company>(() =>
    recordId
      ? repo?.companies().find((c) => c.id === recordId) || newCompany()
      : activation.companyDraft?.company || newCompany(),
  );
  const [confirmed, setConfirmed] = useState(!!recordId || !!activation.companyDraft?.confirmed);
  const [customer, setCustomer] = useState<Customer>(() =>
    repo && active && recordId
      ? repo.customers(active.id).find((c) => c.id === recordId) ||
        newCustomer(active.id)
      : newCustomer(active?.id || ""),
  );
  const [item, setItem] = useState<Catalogue>(() =>
    repo && active && recordId
      ? repo.catalogue(active.id).find((c) => c.id === recordId) || {
          id: id(),
          companyId: active.id,
          name: "",
          description: "",
          unit: "pcs",
          price: "0",
        }
      : {
          id: id(),
          companyId: active?.id || "",
          name: "",
          description: "",
          unit: "pcs",
          price: "0",
        },
  );
  const [doc, setDoc] = useState<Proforma | null>(() => {
    if (!active || !repo) return null;
    if (recordId && (screen === "edit" || screen === "preview")) {
      try {
        return repo.document(active.id, recordId);
      } catch {
        return null;
      }
    }
    return newDocument(active, newCustomer(active.id));
  });
  const [quick, setQuick] = useState(false),
    [picker, setPicker] = useState<"customer" | "catalogue" | null>(null);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const changeCompany = (key: keyof Company, v: string | number) => {
    const next = { ...company, [key]: v };
    setCompany(next);
    if (!recordId) activation.saveCompanyDraft?.(next, confirmed);
    setDirty(true);
  };
  const changeCustomer = (key: keyof Customer, v: string) => {
    setCustomer((c) => ({
      ...c,
      [key]: v,
    }));
    setDirty(true);
  };
  const changeItem = (key: keyof Catalogue, v: string) => {
    setItem((c) => ({
      ...c,
      [key]: v,
    }));
    setDirty(true);
  };
  const changeDoc = (key: keyof Proforma, value: unknown) => {
    setDoc((d) =>
      d
        ? {
            ...d,
            [key]: value,
          }
        : d,
    );
    setDirty(true);
  };
  const docFields = (fields: [keyof Proforma, string, boolean?][]) =>
    doc &&
    fields.map(([key, label, numeric]) => (
      <Field
        key={key}
        label={label}
        value={String(doc[key] ?? "")}
        numeric={numeric}
        multiline={["notes", "paymentTerms", "deliveryTerms", "termsAndConditions"].includes(key)}
        onChange={(v) => changeDoc(key, v)}
        error={errors[key]}
      />
    ));
  const customerFields = (
    value: Customer,
    change: (key: keyof Customer, v: string) => void,
    prefix = "",
  ) =>
    (
      [
        ["name", "Customer / business name *"],
        ["tin", "TIN (optional)"],
        ["address", "Address (optional)"],
        ["phone", "Phone (optional)"],
        ["email", "Email (optional)"],
        ["contact", "Contact person (optional)"],
      ] as [keyof Customer, string][]
    ).map(([key, label]) => (
      <Field
        key={key}
        label={label}
        value={value[key]}
        onChange={(v) => change(key, v)}
        error={errors[prefix + key]}
      />
    ));
  const visibleScreen =
    !active && !["company", "settings"].includes(screen) ? "setup" : screen;
  const totals = (() => {
    try {
      return doc ? calculate(doc.lines, doc.vat) : null;
    } catch {
      return null;
    }
  })();
  const render = () => {
    if (!repo)
      return (
        <Empty
          text={t(
            "Unable to open local storage. Close and reopen the app. Your existing data has not been replaced.",
          )}
        />
      );
    if (visibleScreen === "setup")
      return (
        <>
          <Text style={s.hero}>{t("All in One Proformas")}</Text>
          <Text style={s.subtitle}>
            {t(
              "Professional proformas for your business. Saved on this phone, ready when you are.",
            )}
          </Text>
          <Card>
            <Text style={s.cardTitle}>{t("Start with your company")}</Text>
            <Text style={s.muted}>
              {t(
                "Add your business details, confirm VAT, and create your first proforma.",
              )}
            </Text>
            <Button label={t("Set up company")} onPress={() => go("company")} />
          </Card>
          <Button
            secondary
            label={t("Restore an existing backup")}
            onPress={() => go("settings")}
          />
        </>
      );
    if (visibleScreen === "company")
      return (
        <>
          <Text style={s.subtitle}>
            {t("Your details appear on new proformas. * Required")}
          </Text>
          <Card>
            <Logo uri={company.logo} />
            <Button
              secondary
              label={t("Choose JPG / PNG logo")}
              onPress={() =>
                run(async () => {
                  const uri = await chooseLogo();
                  if (uri) changeCompany("logo", uri);
                })
              }
            />
            {!!company.logo && (
              <Button
                secondary
                label={t("Remove logo")}
                onPress={() => changeCompany("logo", "")}
              />
            )}
          </Card>
          <Card>
            <Text style={s.cardTitle}>{t("Organization stamp (optional)")}</Text>
            <Text style={s.muted}>{t("Attach your organization's PNG stamp. A transparent background works best. It appears near the bottom of new proformas.")}</Text>
            {!!company.stamp && <Image source={{uri:company.stamp}} accessibilityLabel={t("Organization stamp preview")} resizeMode="contain" style={{width:"100%",height:120,marginVertical:12}} />}
            <Button secondary label={t("Choose PNG stamp")} onPress={() => run(async () => {const uri=await chooseStamp();if(uri)changeCompany("stamp",uri);})} />
            {!!company.stamp && <Button secondary label={t("Remove stamp")} onPress={() => changeCompany("stamp","")} />}
            <Text style={[s.muted,{fontSize:12,marginTop:6}]}>{t("Keep a business-data backup to restore your stamp on another phone.")}</Text>
          </Card>
          <Card>
            {(
              [
                ["name", t("Business / legal name *")],
                ["tin", t("TIN *")],
                ["vatNumber", t("VAT registration number (optional)")],
                ["address", t("Address (optional)")],
                ["phone", t("Phone (optional)")],
                ["email", t("Email (optional)")],
                ["website", t("Website (optional)")],
                ["currency", t("Default currency *")],
                ["vat", t("Default VAT rate (%) *")],
                ["validity", t("Default validity (days) *")],
                ["prefix", t("Numbering prefix *")],
                ["paymentTerms", t("Payment terms (optional)")],
                ["deliveryTerms", t("Delivery terms (optional)")],
                ["termsAndConditions", t("Terms & Conditions (optional)")],
                ["bankName", t("Bank name (optional)")],
                ["accountName", t("Account name (optional)")],
                ["accountNumber", t("Account number (optional)")],
              ] as [keyof Company, string][]
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={String(company[key] ?? "")}
                onChange={(v) =>
                  changeCompany(key, key === "validity" ? Number(v) : v)
                }
                numeric={key === "vat" || key === "validity"}
                multiline={[
                  "address",
                  "paymentTerms",
                  "deliveryTerms",
                  "termsAndConditions",
                ].includes(key)}
                error={errors[key]}
              />
            ))}
            <Text style={s.muted}>
              {t(
                "15% is an editable initial value. Confirm the appropriate rate for your business; this is not tax advice.",
              )}
            </Text>
            <Button
              secondary
              label={
                confirmed
                  ? t("\u2713 VAT rate confirmed")
                  : t("Confirm this VAT rate")
              }
              onPress={() => {
                setConfirmed(!confirmed);
                if (!recordId) activation.saveCompanyDraft?.(company, !confirmed);
                setDirty(true);
              }}
            />
            {errors.vatConfirmed && (
              <Text style={s.error}>{t("Confirm this VAT rate")}</Text>
            )}
            <Button
              disabled={busy}
              label={t("Save company")}
              onPress={() =>
                run(async () => {
                  const c = {
                    ...company,
                    vatConfirmed: confirmed,
                  };
                  if (!validate(companySchema, c)) return;
                  await activation.saveCompany(c as Company);
                  repo.setSetting("activeCompany", company.id);
                  finish("home");
                })
              }
            />
          </Card>
        </>
      );
    if (visibleScreen === "companies")
      return (
        <>
          <Text style={s.subtitle}>
            {t(
              "Separate customers, catalogue and numbering for every business.",
            )}
          </Text>
          {companies.map((c) => (
            <Card key={c.id}>
              <Text style={s.cardTitle}>{c.name}</Text>
              <Text style={s.muted}>
                {c.tin}
                {c.id === active?.id ? " · Active company" : ""}
              </Text>
              <Button
                label={t("Use this company")}
                onPress={() => {
                  repo.setSetting("activeCompany", c.id);
                  finish("home");
                }}
              />
              <Button
                secondary
                label={t("Edit profile")}
                onPress={() => go("company", c.id)}
              />
            </Card>
          ))}
          <Button label={t("Add company")} onPress={() => go("company")} />
        </>
      );
    if (visibleScreen === "home" && active) {
      const ds = repo.documents(active.id);
      const currencies = [
        ...new Set(
          ds.filter((d) => d.status === "issued").map((d) => d.currency),
        ),
      ];
      return (
        <>
          <View style={s.banner}>
            <Text style={s.eyebrow}>{t("OFFLINE \xB7 ON YOUR PHONE")}</Text>
            <Text style={s.bannerTitle}>
              {t("Good business\\nstarts with a clear quote.")}
            </Text>
            <Text style={s.bannerSub}>{active.name}</Text>
          </View>
          <Button
            label={t("\uFF0B Create proforma")}
            onPress={() => go("edit")}
          />
          <View style={s.stats}>
            {(["draft", "issued", "void"] as const).map((st) => (
              <View style={s.stat} key={st}>
                <Text style={s.statValue}>
                  {ds.filter((d) => d.status === st).length}
                </Text>
                <Text style={s.muted}>{t(st.toUpperCase())}</Text>
              </View>
            ))}
          </View>
          <Card>
            <Text style={s.cardTitle}>{t("Issued proforma values")}</Text>
            <Text style={s.muted}>
              {t(
                "Quoted amounts, not sales or revenue. Voided documents excluded.",
              )}
            </Text>
            {currencies.map((cur) => (
              <Text style={s.amount} key={cur}>
                {cur}{" "}
                {formatAmount(ds
                  .filter((d) => d.status === "issued" && d.currency === cur)
                  .reduce(
                    (sum, d) => sum.plus(calculate(d.lines, d.vat).total),
                    new Decimal(0),
                  )
                  .toFixed(2))}
              </Text>
            ))}
            {!currencies.length && (
              <Text style={s.muted}>
                {t("Your first issued quote will appear here.")}
              </Text>
            )}
          </Card>
          <Text style={s.section}>{t("Recent documents")}</Text>
          {ds.slice(0, 4).map((d) => (
            <DocumentCard key={d.id} d={d} />
          ))}
          {!ds.length && (
            <Empty
              text={t("No proformas yet. Create a draft to get started.")}
            />
          )}
        </>
      );
    }
    if (visibleScreen === "customers" && active)
      return (
        <>
          <Button
            label={t("\uFF0B Add customer")}
            onPress={() => go("customer")}
          />
          <Field
            label={t("Search customers")}
            value={query}
            onChange={setQuery}
          />
          {repo
            .customers(active.id)
            .filter((c) =>
              `${c.name} ${c.tin}`.toLowerCase().includes(query.toLowerCase()),
            )
            .map((c) => (
              <Pressable key={c.id} onPress={() => go("customer", c.id)}>
                <Card>
                  <Text style={s.cardTitle}>{c.name}</Text>
                  <Text style={s.muted}>
                    {[c.contact, c.phone, c.tin].filter(Boolean).join(" · ") ||
                      t("Tap to edit customer")}
                  </Text>
                </Card>
              </Pressable>
            ))}
          {!repo.customers(active.id).length && (
            <Empty
              text={t(
                "No customers yet. Add one here or while composing a proforma.",
              )}
            />
          )}
        </>
      );
    if (visibleScreen === "customer")
      return (
        <Card>
          {customerFields(customer, changeCustomer)}
          <Button
            label={t("Save customer")}
            disabled={busy}
            onPress={() =>
              run(() => {
                if (!validate(customerSchema, customer)) return;
                repo.saveCustomer(customer);
                finish("customers");
              })
            }
          />
        </Card>
      );
    if (visibleScreen === "catalogue" && active)
      return (
        <>
          <Button
            label={t("\uFF0B Add item or service")}
            onPress={() => go("item")}
          />
          <Field
            label={t("Search catalogue")}
            value={query}
            onChange={setQuery}
          />
          {repo
            .catalogue(active.id)
            .filter((c) =>
              `${c.name} ${c.description}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((c) => (
              <Pressable key={c.id} onPress={() => go("item", c.id)}>
                <Card>
                  <Text style={s.cardTitle}>{c.name}</Text>
                  <Text style={s.muted}>
                    {formatAmount(c.price)}
                    {t(" / ")}
                    {c.unit}
                  </Text>
                  <Text numberOfLines={2} style={s.body}>
                    {c.description}
                  </Text>
                </Card>
              </Pressable>
            ))}
          {!repo.catalogue(active.id).length && (
            <Empty
              text={t(
                "Build a reusable catalogue, or enter custom lines directly on a proforma.",
              )}
            />
          )}
        </>
      );
    if (visibleScreen === "item")
      return (
        <Card>
          {(
            [
              ["name", t("Item / service name *")],
              ["description", t("Description (optional)")],
              ["unit", t("Unit (optional)")],
              ["price", t("Default unit price *")],
            ] as [keyof Catalogue, string][]
          ).map(([key, label]) => key === "unit" ? (
            <UnitSelect key={key} value={item.unit} onChange={(v) => changeItem("unit", v)} />
          ) : (
            <Field
              key={key}
              label={label}
              value={item[key]}
              onChange={(v) => changeItem(key, v)}
              numeric={key === "price"}
              money={key === "price"}
              multiline={key === "description"}
              error={errors[key]}
            />
          ))}
          <Button
            label={t("Save catalogue item")}
            disabled={busy}
            onPress={() =>
              run(() => {
                if (!validate(catalogueSchema, item)) return;
                repo.saveCatalogue(item);
                finish("catalogue");
              })
            }
          />
        </Card>
      );
    if (visibleScreen === "documents" && active) {
      const invalidDate =
        (from && !dateSchema.safeParse(from).success) ||
        (to && !dateSchema.safeParse(to).success);
      const ds = repo
        .documents(active.id)
        .filter(
          (d) =>
            `${d.number} ${d.customer.name}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (status === "all" || d.status === status) &&
            (!from || d.issueDate >= from) &&
            (!to || d.issueDate <= to),
        );
      return (
        <>
          <Button
            label={t("\uFF0B Create proforma")}
            onPress={() => go("edit")}
          />
          <Field
            label={t("Search number or customer")}
            value={query}
            onChange={setQuery}
          />
          <View style={s.chips}>
            {["all", "draft", "issued", "void"].map((v) => (
              <Pressable
                key={v}
                onPress={() => setStatus(v)}
                style={[s.chip, status === v && s.chipActive]}
              >
                <Text
                  style={
                    status === v
                      ? {
                          color: "white",
                        }
                      : s.body
                  }
                >
                  {t(v.toUpperCase())}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label={t("Issue date from (YYYY-MM-DD, optional)")}
            value={from}
            onChange={setFrom}
          />
          <Field
            label={t("Issue date to (YYYY-MM-DD, optional)")}
            value={to}
            onChange={setTo}
          />
          {invalidDate ? (
            <Text style={s.error}>{t("Enter real dates as YYYY-MM-DD.")}</Text>
          ) : (
            ds.map((d) => <DocumentCard key={d.id} d={d} />)
          )}
          {!ds.length && (
            <Empty text={t("No documents match these filters.")} />
          )}
        </>
      );
    }
    if (visibleScreen === "edit" && doc && active) {
      if (doc.status !== "draft")
        return (
          <Empty
            text={t(
              "Issued and voided proformas are read-only. Open their preview to duplicate them.",
            )}
          />
        );
      return (
        <>
          <Text style={s.subtitle}>
            {active.name}
            {t(" \xB7 VAT-exclusive prices")}
          </Text>
          <Card>
            <Text style={s.eyebrow}>
              {t("DRAFT \xB7 NUMBER ALLOCATED ON ISSUE")}
            </Text>
            <Text style={s.cardTitle}>
              {repo.suggested(active.id, doc.issueDate)}
            </Text>
            <Text style={s.muted}>
              {t(
                "Suggested number; the next available number is assigned when issued.",
              )}
            </Text>
            {docFields([
              ["issueDate", t("Issue date (YYYY-MM-DD) *")],
              ["validUntil", t("Valid until (YYYY-MM-DD) *")],
              ["currency", t("Currency *")],
            ])}
          </Card>
          <Card>
            <Text style={s.section}>{t("Customer")}</Text>
            <Text style={s.cardTitle}>
              {doc.customer.name || t("Choose or create a customer")}
            </Text>
            <Button
              secondary
              label={t("Select saved customer")}
              onPress={() =>
                setPicker(picker === "customer" ? null : "customer")
              }
            />
            {picker === "customer" && (
              <>
                <Field
                  label={t("Find customer")}
                  value={query}
                  onChange={setQuery}
                />
                {repo
                  .customers(active.id)
                  .filter((c) =>
                    c.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((c) => (
                    <Button
                      secondary
                      key={c.id}
                      label={c.name}
                      onPress={() => {
                        changeDoc("customer", {
                          ...c,
                        });
                        setPicker(null);
                        setQuick(false);
                      }}
                    />
                  ))}
                {!repo.customers(active.id).length && (
                  <Text style={s.muted}>
                    {t("No saved customers. Create one below.")}
                  </Text>
                )}
              </>
            )}
            <Button
              secondary
              label={
                quick
                  ? t("Hide customer fields")
                  : t("Quick create / edit customer")
              }
              onPress={() => setQuick(!quick)}
            />
            {quick &&
              customerFields(
                doc.customer,
                (key, v) =>
                  changeDoc("customer", {
                    ...doc.customer,
                    [key]: v,
                  }),
                "customer.",
              )}
            {errors["customer.name"] && (
              <Text style={s.error}>{t(errors["customer.name"]!)}</Text>
            )}
          </Card>
          <Text style={s.section}>{t("Line items")}</Text>
          {doc.lines.map((line, i) => (
            <Card key={line.id}>
              <Text style={s.eyebrow}>
                {t("ITEM ")}
                {i + 1}
              </Text>
              {(
                [
                  ["description", t("Description *")],
                  ["unit", t("Unit (optional)")],
                  ["quantity", t("Quantity *")],
                  ["price", t("Unit price *")],
                ] as const
              ).map(([key, label]) => key === "unit" ? (
                <UnitSelect key={key} value={line.unit} onChange={(v) => changeDoc("lines", doc.lines.map((l, j) => j === i ? { ...l, unit: v } : l))} />
              ) : (
                <Field
                  key={key}
                  label={label}
                  value={line[key]}
                  numeric={key === "quantity" || key === "price"}
                  money={key === "price"}
                  multiline={key === "description"}
                  error={errors[`lines.${i}.${key}`]}
                  onChange={(v) =>
                    changeDoc(
                      "lines",
                      doc.lines.map((l, j) =>
                        j === i
                          ? {
                              ...l,
                              [key]: v,
                            }
                          : l,
                      ),
                    )
                  }
                />
              ))}
              <Text style={s.amount}>
                {doc.currency} {totals ? formatAmount(totals.amounts[i]!) : "—"}
              </Text>
              <Button
                secondary
                label={t("Remove line")}
                onPress={() =>
                  changeDoc(
                    "lines",
                    doc.lines.filter((_, j) => j !== i),
                  )
                }
              />
            </Card>
          ))}
          {errors.lines && <Text style={s.error}>{t(errors.lines)}</Text>}
          <Button
            secondary
            label={t("\uFF0B Add custom line")}
            onPress={() =>
              changeDoc("lines", [
                ...doc.lines,
                {
                  id: id(),
                  description: "",
                  unit: "pcs",
                  quantity: "1",
                  price: "0",
                },
              ])
            }
          />
          <Button
            secondary
            label={t("\uFF0B Add from catalogue")}
            onPress={() =>
              setPicker(picker === "catalogue" ? null : "catalogue")
            }
          />
          {picker === "catalogue" && (
            <Card>
              <Field label={t("Find item")} value={query} onChange={setQuery} />
              {repo
                .catalogue(active.id)
                .filter((c) =>
                  `${c.name} ${c.description}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((c) => (
                  <Button
                    secondary
                    key={c.id}
                    label={`${c.name} · ${formatAmount(c.price)}`}
                    onPress={() => {
                      const line = {
                        id: id(),
                        description: [c.name, c.description]
                          .filter(Boolean)
                          .join("\n"),
                        unit: c.unit,
                        quantity: "1",
                        price: c.price,
                      };
                      changeDoc(
                        "lines",
                        doc.lines.length === 1 && !doc.lines[0]?.description
                          ? [line]
                          : [...doc.lines, line],
                      );
                      setPicker(null);
                    }}
                  />
                ))}
              {!repo.catalogue(active.id).length && (
                <Text style={s.muted}>
                  {t(
                    "Catalogue is empty. Custom lines work without a catalogue.",
                  )}
                </Text>
              )}
            </Card>
          )}
          <Card>
            {docFields([
              ["vat", t("VAT rate (%) *"), true],
              ["paymentTerms", t("Payment terms (optional)")],
              ["deliveryTerms", t("Delivery terms (optional)")],
                ["termsAndConditions", t("Terms & Conditions (optional)")],
              ["notes", t("Notes (optional)")],
              ["preparedBy", t("Prepared by (optional)")],
            ])}
            <Text style={s.muted}>
              {t("Bank:")}{" "}
              {[active.bankName, active.accountName, active.accountNumber]
                .filter(Boolean)
                .join(" · ") ||
                t("No bank details. Add them in the company profile.")}
            </Text>
          </Card>
          <Totals doc={doc} />
          <Button
            label={t("Save draft & preview")}
            disabled={busy}
            onPress={() =>
              run(() => {
                const d = {
                  ...doc,
                  company: {
                    ...active,
                  },
                };
                if (!validate(documentSchema, d)) return;
                repo.saveDraft(d, true);
                finish("preview", d.id);
              })
            }
          />
        </>
      );
    }
    if (visibleScreen === "preview" && doc && active) {
      const current = repo.document(active.id, doc.id);
      const display =
        current.status === "draft"
          ? {
              ...current,
              company: active,
            }
          : current;
      return (
        <>
          <View style={s.document}>
            <Text style={s.eyebrow}>{t(display.status.toUpperCase())}</Text>
            <Logo uri={display.company.logo} />
            <Text style={s.section}>{display.company.name}</Text>
            <Text style={s.muted}>
              {t("TIN ")}
              {display.company.tin}
            </Text>
            <Text style={s.heroSmall}>{t("PROFORMA INVOICE")}</Text>
            <Text style={s.cardTitle}>
              {display.number || t("DRAFT \u2014 number pending")}
            </Text>
            <Text style={s.muted}>
              {display.issueDate}
              {t(" \xB7 Valid until ")}
              {display.validUntil}
            </Text>
            <Text style={s.section}>
              {t("Quoted to ")}
              {display.customer.name}
            </Text>
            {display.lines.map((l, i) => (
              <View key={l.id} style={s.previewLine}>
                <Text style={s.body}>
                  {i + 1}
                  {t(". ")}
                  {l.description}
                </Text>
                <Text style={s.muted}>
                  {l.quantity} {l.unit}
                  {t(" \xD7 ")}
                  {formatAmount(l.price)}
                </Text>
                <Text style={s.lineAmount}>
                  {formatAmount(calculate(display.lines, display.vat).amounts[i]!)}
                </Text>
              </View>
            ))}
            <Totals doc={display} />
            {[
              [t("Payment terms"), display.paymentTerms],
              [t("Delivery terms"), display.deliveryTerms],
              [t("Terms & Conditions"), display.termsAndConditions || ""],
              [t("Bank"), display.company.bankName],
              [t("Account name"), display.company.accountName],
              [t("Account number"), display.company.accountNumber],
              [t("Notes"), display.notes],
              [t("Prepared by"), display.preparedBy],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <Text key={k} style={s.body}>
                  {k}
                  {t(": ")}
                  {v}
                </Text>
              ))}
            <Text style={s.subtitle}>
              {t("This is a proforma invoice, not a tax invoice.")}
            </Text>
          </View>
          {current.status === "draft" ? (
            <>
              <Button
                label={t("Issue proforma")}
                disabled={busy}
                onPress={() =>
                  confirm({
                    title: t("Issue this proforma?"),
                    message: t(
                      "A final number will be allocated. The document becomes read-only.",
                    ),
                    onConfirm: () =>
                      run(async () => {
                        const logo = await logoData(active.logo);
                        const stamp = await stampData(active.stamp);
                        repo.issue(active.id, current.id, logo, stamp);
                        refresh();
                      }, t("Proforma issued. Historical details are now preserved.")),
                  })
                }
              />
              <Button
                secondary
                label={t("Edit draft")}
                onPress={() => go("edit", current.id)}
              />
            </>
          ) : null}
          <View style={s.chips}>
            {(["preview", "export", "share", "print"] as const).map((a) => (
              <Button
                key={a}
                secondary
                label={
                  a === "preview"
                    ? t("PDF preview")
                    : t(a[0]!.toUpperCase() + a.slice(1) + " PDF")
                }
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    await pdfAction(display, a, language);
                  }, t("PDF generated. Use the Android sheet to save, share, or print."))
                }
              />
            ))}
          </View>
          <Button
            secondary
            label={t("Duplicate as a new draft")}
            disabled={busy}
            onPress={() =>
              run(() => {
                const d = repo.duplicate(active.id, current.id);
                finish("edit", d.id);
              })
            }
          />
          {current.status === "draft" && (
            <Button
              danger
              label={t("Delete draft")}
              onPress={() =>
                confirm({
                  title: t("Delete draft?"),
                  message: t("This draft will be permanently removed."),
                  onConfirm: () =>
                    run(() => {
                      repo.deleteDraft(active.id, current.id);
                      finish("documents");
                    }),
                })
              }
            />
          )}{" "}
          {current.status === "issued" && (
            <Button
              danger
              label={t("Mark as void")}
              onPress={() =>
                confirm({
                  title: t("Void this proforma?"),
                  message: t("Its record and number will be retained."),
                  onConfirm: () =>
                    run(
                      () => repo.void(active.id, current.id),
                      t("Proforma marked void."),
                    ),
                })
              }
            />
          )}
        </>
      );
    }
    if (visibleScreen === "settings")
      return (
        <>
          <Card>
            <Text style={s.cardTitle}>{t("Your data belongs to you")}</Text>
            <Text style={s.body}>
              {t(
                "Everything is stored locally on this phone. Uninstalling the app or losing the phone may remove your data. Export backups regularly and keep a copy elsewhere.",
              )}
            </Text>
            <Button
              label={t("Export backup ZIP")}
              disabled={busy}
              onPress={() =>
                run(async () => {
                  await exportBackup();
                }, t("Backup exported. Save a copy outside this app."))
              }
            />
            <Button
              secondary
              label={t("Restore from backup ZIP")}
              disabled={busy}
              onPress={() =>
                run(async () => {
                  const m = await pickBackup();
                  if (!m) return;
                  confirm({
                    title: t("Replace ALL local data?"),
                    message: `${t("Validated backup")}: ${m.companies.length} ${t("Companies")}, ${m.documents.length} ${t("Proformas")}. ${t("All current local data will be replaced. Export a current backup first.")}`,
                    onConfirm: () =>
                      run(async () => {
                        await restoreBackup(m);
                        setLanguage(m.settings.language || "en");
                        finish("home");
                      }),
                  });
                })
              }
            />
          </Card>
          <Card>
            <Text style={s.cardTitle}>{`Rayz Proforma · ${appConfig.expo.version}`}</Text>
            <Text style={s.body}>
              {t(
                "Activated companies work offline. Sign in to register or recover a company. Prices exclude VAT; totals use precise decimal rounding.",
              )}
            </Text>
          </Card>
        </>
      );
    return (
      <Empty text={t("Document or page not found. Choose a section below.")} />
    );
  };
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{
          flex: 1,
        }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.top}>
          <View style={s.headerRow}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flex: 1,
              }}
            >
              <Image
                source={require("../assets/icon.png")}
                accessibilityLabel="Rayz Technology logo"
                resizeMode="contain"
                style={{ width: 30, height: 30, borderRadius: 7 }}
              />
              <Text style={[s.brand, { marginBottom: 0, flexShrink: 1 }]}>
                RAYZ PROFORMA
              </Text>
            </View>
            <LanguageControls />
            <Pressable
              accessibilityRole="button"
              onPress={() => go("activation")}
            >
              <Text>{t("Account")}</Text>
            </Pressable>
          </View>
          <View style={s.headerRow}>
            <Text style={[s.title, { flex: 1 }]}>
              {t(titles[visibleScreen] || "Welcome")}
            </Text>
            {screen !== "home" && (
              <Pressable
                accessibilityLabel={t("Go back")}
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/")
                }
                style={s.back}
              >
                <Text style={s.body}>{t("Back")}</Text>
              </Pressable>
            )}
          </View>
        </View>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {busy && <ActivityIndicator size="large" color="#117568" />}
          {!!message && (
            <View accessibilityRole="alert" style={s.message}>
              <ServiceNotice message={message} />
            </View>
          )}
          {render()}
        </ScrollView>
        {active && !dirty && (
          <View style={s.nav}>
            {[
              ["home", t("Home")],
              ["documents", t("Quotes")],
              ["customers", t("People")],
              ["catalogue", t("Items")],
              ["companies", t("Business")],
              ["settings", t("Backup")],
            ].map(([route, label]) => (
              <Pressable
                key={route}
                accessibilityRole="button"
                onPress={() => route && go(route)}
                style={s.navItem}
              >
                <Text
                  style={[
                    s.navText,
                    screen === route && {
                      color: "#117568",
                      fontWeight: "800",
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={s.credit}>
          <Text style={s.creditText}>Developed by Rayz Technology plc</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function DocumentCard({ d }: { d: Proforma }) {
  const { t } = useLocale();
  return (
    <Pressable onPress={() => go("preview", d.id)}>
      <Card>
        <View style={s.row}>
          <Text style={s.cardTitle}>{d.number || t("Unissued draft")}</Text>
          <Text style={s.badge}>{t(d.status.toUpperCase())}</Text>
        </View>
        <Text style={s.body}>{d.customer.name}</Text>
        <View style={s.row}>
          <Text style={s.muted}>{d.issueDate}</Text>
          <Text style={s.lineAmount}>
            {d.currency} {formatAmount(calculate(d.lines, d.vat).total)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
function Totals({ doc }: { doc: Proforma }) {
  const { t, language } = useLocale();
  try {
    const values = calculate(doc.lines, doc.vat);
    return (
      <Card>
        <View style={s.row}>
          <Text style={s.body}>{t("Subtotal")}</Text>
          <Text style={s.body}>{formatAmount(values.subtotal)}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.body}>
            {t("VAT (")}
            {doc.vat}
            {t("%)")}
          </Text>
          <Text style={s.body}>{formatAmount(values.vat)}</Text>
        </View>
        <View style={[s.row, s.totalRow]}>
          <Text style={s.cardTitle}>{t("Grand total")}</Text>
          <Text style={s.amount}>
            {doc.currency} {formatAmount(values.total)}
          </Text>
        </View>
        <Text style={[s.muted, { marginTop: 12 }]}>{t("Amount in words")}: {amountInWords(values.total, doc.currency, language)}</Text>
      </Card>
    );
  } catch {
    return (
      <Text style={s.error}>
        {t(
          "Complete valid line items and a positive VAT rate to calculate totals.",
        )}
      </Text>
    );
  }
}
const s = StyleSheet.create({
  headerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 4,
  },
  languagePicker: {
    flexDirection: "row",
    backgroundColor: "#e9f1ee",
    borderRadius: 10,
    padding: 2,
  },
  languageButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  languageSelected: { backgroundColor: "#117568" },
  languageText: { fontSize: 12, fontWeight: "800", color: "#174e54" },
  credit: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#dce5e1",
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
  },
  creditText: { fontSize: 11, color: "#536c72", textAlign: "center" },
  safe: {
    flex: 1,
    backgroundColor: "#f2f5f4",
  },
  top: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#fff",
    flexDirection: "column",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e8e6",
  },
  brand: {
    fontSize: 10,
    letterSpacing: 1,
    color: "#117568",
    fontWeight: "800",
    marginBottom: 9,
  },
  title: {
    fontSize: 21,
    fontWeight: "700",
    color: "#16383e",
  },
  back: {
    padding: 12,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  hero: {
    fontSize: 28,
    lineHeight: 37,
    fontWeight: "800",
    color: "#16383e",
    marginVertical: 16,
  },
  heroSmall: {
    fontSize: 24,
    fontWeight: "800",
    color: "#117568",
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#617477",
    marginBottom: 20,
  },
  banner: {
    backgroundColor: "#163f45",
    padding: 24,
    borderRadius: 20,
    marginBottom: 15,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    color: "#378f82",
    marginBottom: 10,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 29,
    fontWeight: "700",
    lineHeight: 36,
  },
  bannerSub: {
    color: "#b6d6d0",
    fontSize: 15,
    marginTop: 18,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e1e9e6",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#193b40",
    marginBottom: 7,
    flexShrink: 1,
  },
  section: {
    fontSize: 19,
    fontWeight: "700",
    color: "#193b40",
    marginTop: 15,
    marginBottom: 16,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: "#2b464d",
  },
  muted: {
    fontSize: 12,
    lineHeight: 20,
    color: "#607679",
  },
  button: {
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: "#117568",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginVertical: 6,
  },
  secondary: {
    backgroundColor: "#eaf2ef",
    borderWidth: 1,
    borderColor: "#cbded7",
  },
  danger: {
    backgroundColor: "#a53a3a",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#314e54",
    marginBottom: 8,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#cbd8d4",
    borderRadius: 9,
    backgroundColor: "#fafcfb",
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    color: "#193b40",
  },
  error: {
    color: "#a13030",
    fontSize: 12,
    marginVertical: 6,
  },
  logo: {
    width: 120,
    height: 120,
    backgroundColor: "#f1f5f3",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  stats: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 17,
  },
  stat: {
    flex: 1,
    backgroundColor: "#e5eeeb",
    padding: 14,
    borderRadius: 13,
  },
  statValue: {
    fontSize: 28,
    color: "#193b40",
    fontWeight: "800",
    marginBottom: 3,
  },
  amount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#117568",
    marginVertical: 6,
    flexShrink: 1,
  },
  lineAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#117568",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#dce7e2",
    paddingTop: 12,
    marginTop: 10,
    flexWrap: "wrap",
  },
  badge: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#117568",
    backgroundColor: "#e8f2ee",
    padding: 6,
    borderRadius: 5,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 15,
  },
  chip: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: "#e4ece8",
    minHeight: 44,
  },
  chipActive: {
    backgroundColor: "#117568",
  },
  document: {
    padding: 17,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
  },
  previewLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#e3ebe7",
    paddingVertical: 12,
  },
  nav: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#dce5e1",
    paddingVertical: 5,
  },
  navItem: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  navText: {
    fontSize: 11,
    color: "#5e7275",
  },
  message: {
    backgroundColor: "#e1eee8",
    borderRadius: 10,
    padding: 16,
    marginBottom: 15,
  },
});
