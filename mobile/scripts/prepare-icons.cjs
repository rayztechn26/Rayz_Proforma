const fs = require("node:fs");
const {
  generateImageAsync,
  generateImageBackgroundAsync,
  compositeImagesAsync,
} = require("@expo/image-utils");
(async () => {
  fs.mkdirSync("assets", { recursive: true });
  if (process.argv[2]) fs.copyFileSync(process.argv[2], "assets/rayz-logo.png");
  for (const [file, backgroundColor, padding] of [
    ["icon.png", "#071E2F", 50],
    ["adaptive-foreground.png", "#00000000", 190],
  ]) {
    const { source } = await generateImageAsync(
      { projectRoot: process.cwd() },
      {
        src: "assets/rayz-logo.png",
        width: 1024 - padding * 2,
        height: 1024 - padding * 2,
        resizeMode: "contain",
        backgroundColor: "#00000000",
      },
    );
    const background = await generateImageBackgroundAsync({
      width: 1024,
      height: 1024,
      resizeMode: "contain",
      backgroundColor,
    });
    fs.writeFileSync(
      "assets/" + file,
      await compositeImagesAsync({
        foreground: source,
        background,
        x: padding,
        y: padding,
      }),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
