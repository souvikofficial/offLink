const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node set-offsync-url.js <url>");
  process.exit(2);
}
const url = args[0];

const gradlePath = path.join(__dirname, "..", "android", "app", "build.gradle");
if (!fs.existsSync(gradlePath)) {
  console.error("Could not find build.gradle at", gradlePath);
  process.exit(2);
}

let content = fs.readFileSync(gradlePath, "utf8");

// Replace existing OFFSYNC_SERVER_URL buildConfigField if present, otherwise insert under defaultConfig
const fieldRegex =
  /buildConfigField\s+"String",\s+"OFFSYNC_SERVER_URL",\s+"[^"]*"/;
const newField = `buildConfigField "String", "OFFSYNC_SERVER_URL", '"${url}"'`;

if (fieldRegex.test(content)) {
  content = content.replace(fieldRegex, newField);
  fs.writeFileSync(gradlePath, content, "utf8");
  console.log("Updated OFFSYNC_SERVER_URL in build.gradle");
} else {
  // Try to insert into defaultConfig block
  const dcRegex = /defaultConfig\s*\{[^}]*\}/s;
  const match = content.match(dcRegex);
  if (match) {
    const updated = match[0].replace(/\}$/, `    ${newField}\n}`);
    content = content.replace(dcRegex, updated);
    fs.writeFileSync(gradlePath, content, "utf8");
    console.log(
      "Inserted OFFSYNC_SERVER_URL into defaultConfig in build.gradle",
    );
  } else {
    console.error(
      "Could not locate defaultConfig block to insert BuildConfig field. Please add manually.",
    );
    process.exit(2);
  }
}
