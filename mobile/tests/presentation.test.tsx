import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { LanguageProvider } from "../src/locale";
import { LanguageSwitch } from "../src/LanguageSwitch";
import { ServiceNotice } from "../src/ServiceNotice";
import { ApiError } from "../src/api-response";

test("language selector uses the requested Ethiopic abbreviation and selected state", () => {
  render(<LanguageProvider><LanguageSwitch /></LanguageProvider>);
  expect(screen.getByText("አማ")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("አማርኛ"));
  expect(screen.getByLabelText("አማርኛ").props.accessibilityState.selected).toBe(true);
  expect(screen.queryByText("AM")).toBeNull();
});

test("service notices keep diagnostic metadata behind an explicit disclosure", () => {
  const summary = "The activation service is temporarily unavailable. Retry; your approved payment and entered details are preserved.";
  const message = new ApiError(summary, "service", "/api/companies", "POST", 503, "application/json", "test-ref").message;
  render(<LanguageProvider><ServiceNotice message={message} /></LanguageProvider>);
  expect(screen.getByText(summary)).toBeTruthy();
  expect(screen.queryByText(/HTTP 503/)).toBeNull();
  fireEvent.press(screen.getByText("Show technical details"));
  expect(screen.getByText(/POST \/api\/companies; HTTP 503; application\/json; reference test-ref/)).toBeTruthy();
  fireEvent.press(screen.getByText("Hide technical details"));
  expect(screen.queryByText(/HTTP 503/)).toBeNull();
});
