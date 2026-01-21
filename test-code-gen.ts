// Test the code generation logic
const VISUALIZATION_GENERATOR_CODE = `
const requestJson = Deno.args[0];
console.log("Starting...");
if (!requestJson) {
  console.error("No request data provided");
  Deno.exit(1);
}
let request;
try {
  request = JSON.parse(requestJson);
  console.log("Parsed:", request.prompt);
} catch (error) {
  console.error("Failed to parse:", error);
  Deno.exit(1);
}
`;

const request = {
  apiData: { url: "https://example.com", data: [], structure: { fields: [], totalRecords: 0 } },
  prompt: "Create a chart"
};

const requestData = JSON.stringify(request);
const codeWithRequest = VISUALIZATION_GENERATOR_CODE.replace(
  "const requestJson = Deno.args[0];",
  `const requestJson = ${JSON.stringify(requestData)};`,
);

console.log("=== Generated Code ===");
console.log(codeWithRequest);
console.log("=== End Generated Code ===");
