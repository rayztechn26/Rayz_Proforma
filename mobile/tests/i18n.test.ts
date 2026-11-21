import { test } from "node:test";
import assert from "node:assert/strict";
import { translate } from "../src/i18n";
test("Amharic labels and status translations preserve surrounding spacing", () => {
  assert.equal(translate("Set up company", "am"), "ድርጅት ያዋቅሩ");
  assert.equal(translate(" DRAFT ", "am"), " ረቂቅ ");
  assert.equal(translate("VAT (", "am"), "ተ.እ.ታ (");
});
test("English retains the requested heading and formats UI line breaks", () => {
  assert.equal(translate("All in One Proformas", "en"), "All in One Proformas");
  assert.equal(
    translate("Good business\\nstarts with a clear quote.", "en"),
    "Good business\nstarts with a clear quote.",
  );
});
test("unknown text passes through without changing user data", () => {
  assert.equal(translate("ሙከራ ድርጅት", "am"), "ሙከራ ድርጅት");
});
