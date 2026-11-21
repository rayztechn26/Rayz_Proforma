module.exports = {
  preset: "jest-expo/android",
  transform: {
    "\\.[jt]sx?$": [
      "babel-jest",
      {
        configFile: require.resolve("expo/internal/babel-preset"),
        caller: { name: "metro", bundler: "metro", platform: "android" },
      },
    ],
  },
  testMatch: ["<rootDir>/tests/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/tests/ui-setup.cjs"],
};
