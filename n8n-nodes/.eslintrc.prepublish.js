module.exports = {
  extends: ["plugin:n8n-nodes-base/nodes"],
  parserOptions: {
    project: "./tsconfig.json",
  },
  rules: {
    "n8n-nodes-base/node-param-default-missing": "error",
    "n8n-nodes-base/node-param-placeholder-missing": "error",
  },
};
