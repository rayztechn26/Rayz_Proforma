import React from "react";
import {StyleSheet} from "react-native";
import {render,screen,fireEvent,waitFor} from "@testing-library/react-native";
import {LanguageProvider} from "../src/locale";
import {ChangePassword} from "../src/ChangePassword";
import {AccountInput} from "../src/AccountInput";
import {api} from "../src/api";
jest.mock("../src/api",()=>({api:jest.fn()}));
beforeEach(()=>jest.clearAllMocks());
function open(){render(<LanguageProvider><ChangePassword/></LanguageProvider>);fireEvent.press(screen.getByRole("button",{name:"Change password"}));}
test("password change checks confirmation, retains inputs after outages and clears secrets after success",async()=>{
 open();fireEvent.changeText(screen.getByLabelText("Current password"),"LegacyPassword123");fireEvent.changeText(screen.getByLabelText("New password"),"012345678");
 fireEvent.changeText(screen.getByLabelText("Confirm new password"),"012345679");fireEvent.press(screen.getByRole("button",{name:"Update password"}));
 expect(api).not.toHaveBeenCalled();expect(screen.getByText("The new passwords do not match.")).toBeOnTheScreen();
 fireEvent.changeText(screen.getByLabelText("Confirm new password"),"012345678");(api as jest.Mock).mockRejectedValueOnce(Error("Connection failed"));
 fireEvent.press(screen.getByRole("button",{name:"Update password"}));await waitFor(()=>expect(screen.getByText("Connection failed")).toBeOnTheScreen());
 expect(screen.getByLabelText("New password")).toHaveDisplayValue("012345678");
 (api as jest.Mock).mockResolvedValueOnce({ok:true});fireEvent.press(screen.getByRole("button",{name:"Update password"}));
 await waitFor(()=>expect(screen.getByText("Password changed. Other account sessions were signed out.")).toBeOnTheScreen());
 expect(api).toHaveBeenLastCalledWith("/password",{current_password:"LegacyPassword123",password:"012345678",password_confirmation:"012345678"});
 fireEvent.press(screen.getByRole("button",{name:"Change password"}));expect(screen.getByLabelText("New password")).toHaveDisplayValue("");
});
test("secure Android password masking uses the system font and visibility toggles retain the controlled value",()=>{
 const Example=()=>{const [value,set]=React.useState("01234567");return <AccountInput label="Password" value={value} set={set} secret numericPassword/>;};
 render(<LanguageProvider initialLanguage="am"><Example/></LanguageProvider>);
 const input=screen.getByLabelText("Password");expect(input.props.secureTextEntry).toBe(true);expect(StyleSheet.flatten(input.props.style).fontFamily).toBe("sans-serif");
 fireEvent.press(screen.getByRole("button"));expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);expect(screen.getByLabelText("Password")).toHaveDisplayValue("01234567");
 fireEvent.press(screen.getByRole("button"));expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
});
