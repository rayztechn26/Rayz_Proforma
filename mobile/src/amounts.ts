import Decimal from "decimal.js";

export function formatAmount(value: string): string {
  const [whole = "0", cents = "00"] = new Decimal(value).toFixed(2, Decimal.ROUND_HALF_UP).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

const small = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const scales = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion", "sextillion", "septillion", "octillion", "nonillion", "decillion", "undecillion", "duodecillion"];
function groupWords(n: number): string {
  if (n < 20) return small[n]!;
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? "-" + small[n % 10] : "");
  return small[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + groupWords(n % 100) : "");
}
function integerWords(digits: string): string {
  const groups = digits.match(/\d{1,3}(?=(\d{3})*$)/g)!;
  if (groups.length > scales.length) throw Error("Amount is too large to spell out.");
  return groups.map((part, index) => Number(part) ? groupWords(Number(part)) + (scales[groups.length - index - 1] ? " " + scales[groups.length - index - 1] : "") : "").filter(Boolean).join(" ") || "zero";
}
const amSmall = ["ዜሮ", "አንድ", "ሁለት", "ሦስት", "አራት", "አምስት", "ስድስት", "ሰባት", "ስምንት", "ዘጠኝ"];
const amTens = ["", "አስር", "ሃያ", "ሠላሳ", "አርባ", "ሃምሳ", "ስልሳ", "ሰባ", "ሰማንያ", "ዘጠና"];
function amGroup(n: number): string {
  if (n < 10) return amSmall[n]!;
  if (n < 20) return n === 10 ? amTens[1]! : "አስራ " + amSmall[n % 10];
  if (n < 100) return amTens[Math.floor(n / 10)] + (n % 10 ? " " + amSmall[n % 10] : "");
  return amSmall[Math.floor(n / 100)] + " መቶ" + (n % 100 ? " " + amGroup(n % 100) : "");
}
function amInteger(digits: string): string {
  digits = digits.replace(/^0+(?=\d)/, "");
  // Work with decimal strings, never Number(value): allowed invoice totals can
  // exceed JavaScript's safe integer range. Large counts recurse in trillions.
  if (digits.length > 12) {
    const high = digits.slice(0, -12), low = digits.slice(-12);
    return amInteger(high) + " ትሪሊዮን" + (/[1-9]/.test(low) ? " " + amInteger(low) : "");
  }
  const groups = digits.match(/\d{1,3}(?=(\d{3})*$)/g)!;
  const units = ["", "ሺህ", "ሚሊዮን", "ቢሊዮን"];
  return groups.map((part, index) => Number(part) ? amGroup(Number(part)) + (units[groups.length - index - 1] ? " " + units[groups.length - index - 1] : "") : "").filter(Boolean).join(" ") || amSmall[0]!;
}
export function amountInWords(value: string, currency: string, language: "en" | "am" = "en"): string {
  const amount = new Decimal(value);
  if (!amount.isFinite() || amount.isNegative()) throw Error("Invalid amount");
  const [whole = "0", fraction = "00"] = amount.toFixed(2, Decimal.ROUND_HALF_UP).split(".");
  if (language === "am") {
    const names: Record<string, [string, string]> = {
      ETB: ["ብር", "ሳንቲም"], USD: ["የአሜሪካ ዶላር", "ሴንት"],
      EUR: ["ዩሮ", "ሴንት"], GBP: ["የእንግሊዝ ፓውንድ", "ፔንስ"],
    };
    const [major, minor] = names[currency.toUpperCase()] || [currency, "መቶኛ ክፍል"];
    return `${amInteger(whole)} ${major} እና ${amInteger(fraction)} ${minor} ብቻ።`;
  }
  const names: Record<string, [string, string]> = {
    ETB: ["Ethiopian birr", "cents"], USD: ["US dollars", "cents"],
    EUR: ["euros", "cents"], GBP: ["pounds sterling", "pence"],
  };
  let [major, minor] = names[currency.toUpperCase()] || [currency, "hundredths"];
  if (whole === "1") major = ({USD: "US dollar", EUR: "euro", GBP: "pound sterling"} as Record<string,string>)[currency.toUpperCase()] || major;
  if (fraction === "01") minor = minor === "pence" ? "penny" : minor === "cents" ? "cent" : "hundredth";
  const words = `${integerWords(whole)} ${major} and ${integerWords(fraction)} ${minor} only`;
  return words[0]!.toUpperCase() + words.slice(1) + ".";
}
