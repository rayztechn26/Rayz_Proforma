import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { UnitSelect } from "../src/UnitSelect";

test("unit list searches full names and saves short names", () => {
  const onChange = jest.fn();
  render(<UnitSelect value="piece" onChange={onChange} />);
  fireEvent.press(screen.getByLabelText("Choose unit"));
  fireEvent.changeText(screen.getByLabelText("Search units"), "carton");
  fireEvent.press(screen.getByText("c/n — Carton"));
  expect(onChange).toHaveBeenCalledWith("c/n");
});
test("legacy units remain available and cancelling does not change them", () => {
  const onChange = jest.fn();
  render(<UnitSelect value="custom legacy" onChange={onChange} />);
  fireEvent.press(screen.getByLabelText("Choose unit"));
  expect(screen.getAllByText("custom legacy").length).toBeGreaterThan(0);
  fireEvent.press(screen.getByText("Cancel"));
  expect(onChange).not.toHaveBeenCalled();
});
