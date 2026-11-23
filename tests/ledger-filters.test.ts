import { describe, it, expect, beforeEach } from "vitest";
import {
  parseLedgerFilters,
  serializeLedgerFilters,
  syncLedgerFiltersToUrl,
  LEDGER_FILTER_KEYS,
} from "../src/ledger-filters.js";

describe("parseLedgerFilters", () => {
  it("parses valid supported filter keys from the URL", () => {
    const filters = parseLedgerFilters("?status=settled&type=transfer&asset=USD");
    expect(filters).toEqual({ status: "settled", type: "transfer", asset: "USD" });
  });

  it("ignores unsupported keys and invalid values", () => {
    const filters = parseLedgerFilters("?token=abc123&status=<script>&type=");
    expect(filters).toEqual({});
  });
});

describe("serializeLedgerFilters", () => {
  it("returns an empty string when there are no filters", () => {
    expect(serializeLedgerFilters({})).toBe("");
  });

  it("serializes only supported keys", () => {
    const search = serializeLedgerFilters({ status: "open", from: "2024-01-01" });
    expect(search).toBe("?status=open&from=2024-01-01");
  });
});

describe("syncLedgerFiltersToUrl", () => {
  let replaced: string | null;
  const history = {
    state: null,
    replaceState(_state: unknown, _title: string, url: string) {
      replaced = url;
    },
  } as unknown as History;

  beforeEach(() => {
    replaced = null;
  });

  it("writes filter keys into the URL so a filtered view can be restored", () => {
    const location = { pathname: "/ledger", search: "", hash: "" } as Location;
    syncLedgerFiltersToUrl({ status: "settled", type: "transfer" }, location, history);
    expect(replaced).toBe("/ledger?status=settled&type=transfer");
    expect(parseLedgerFilters(replaced!.split("?")[1] ?? "")).toEqual({
      status: "settled",
      type: "transfer",
    });
  });

  it("removes filter query keys when filters are cleared", () => {
    const location = {
      pathname: "/ledger",
      search: "?status=settled&type=transfer&page=2",
      hash: "",
    } as Location;
    syncLedgerFiltersToUrl({}, location, history);
    expect(replaced).toBe("/ledger?page=2");
    for (const key of LEDGER_FILTER_KEYS) {
      expect(replaced).not.toContain(`${key}=`);
    }
  });

  it("never places session tokens or private values in the URL", () => {
    const location = {
      pathname: "/ledger",
      search: "?session=secret-token&wallet=0xPRIVATE",
      hash: "",
    } as Location;
    syncLedgerFiltersToUrl({ status: "open" }, location, history);
    expect(replaced).not.toContain("secret-token");
    expect(replaced).not.toContain("0xPRIVATE");
    expect(replaced).not.toContain("session");
    expect(replaced).not.toContain("wallet");
  });
});
