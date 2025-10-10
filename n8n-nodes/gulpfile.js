const { src, dest } = require("gulp");

function buildIcons() {
  return src("nodes/**/*.svg").pipe(dest("dist/"));
}

exports["build:icons"] = buildIcons;
