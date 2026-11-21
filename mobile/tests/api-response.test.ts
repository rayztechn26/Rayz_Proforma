import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, readApiResponse } from "../src/api-response";

test("hosting JSON blocks retain endpoint/status/type and are distinct from Laravel", () => {
  assert.throws(() => readApiResponse('{"message":"Access denied by Imunify360 bot-protection"}', 403, "application/json", "/api/account", "GET"), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.kind, "hosting"); assert.equal(e.status, 403);
    assert.equal(e.endpoint, "/api/account"); assert.equal(e.contentType, "application/json"); return true;
  });
});
test("HTML challenges and HTML errors are never treated as successful API JSON", () => {
  for (const status of [200, 403, 503]) {
    assert.throws(() => readApiResponse('<html>Imunify360 <script>secret</script></html>', status, "text/html", "/api/companies", "POST"), (e: unknown) => e instanceof ApiError && e.kind === "hosting" && !e.message.includes("<script>"));
  }
  assert.throws(() => readApiResponse('<html>Server Error</html>', 500, "text/html", "/api/companies", "POST"), (e: unknown) => e instanceof ApiError && e.kind === "invalid-response");
});
test("Laravel JSON errors preserve correlation ID without revealing server internals", () => {
  assert.throws(() => readApiResponse('{"message":"SQLSTATE secret details"}', 500, "application/json", "/api/companies", "POST", "request-123"), (e: unknown) => e instanceof ApiError && e.kind === "service" && e.requestId === "request-123" && !e.message.includes("SQLSTATE"));
  assert.throws(() => readApiResponse('{"errors":{"profile.name":["Required"]}}', 422, "application/json", "/api/companies", "POST"), /Required/);
  assert.throws(() => readApiResponse('{}', 401, "application/json", "/api/account", "GET"), /sign in again/);
  assert.deepEqual(readApiResponse('{"ok":true}', 200, "application/json; charset=utf-8", "/api/account", "GET"), { ok: true });
  assert.deepEqual(readApiResponse('{"company":{"name":"Imunify360 Consulting"}}', 200, "application/json", "/api/account", "GET"), { company: { name: "Imunify360 Consulting" } });
});
