import { describe, it, expect } from "vitest";
import { checkClientConsistency } from "./consistency-check";

describe("checkClientConsistency", () => {
  it("flags permit G with Swiss residence (reported case)", () => {
    const issues = checkClientConsistency({ permit: "G", country_of_residence: "CH" });
    expect(
      issues.some((i) => i.fields.includes("permit") && i.fields.includes("country_of_residence")),
    ).toBe(true);
  });

  it("flags a Swiss residence permit with a foreign residence", () => {
    const issues = checkClientConsistency({ permit: "B", country_of_residence: "FR" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags permit swiss with a non-CH nationality", () => {
    const issues = checkClientConsistency({ permit: "swiss", nationality: "FR" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags permit C source-taxed", () => {
    const issues = checkClientConsistency({ permit: "C", tax_status: "source_taxed" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags permit G marked as ordinary resident", () => {
    const issues = checkClientConsistency({ permit: "G", tax_status: "resident" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags cross_border_ge with a non-GE canton", () => {
    const issues = checkClientConsistency({ tax_status: "cross_border_ge", canton: "VD" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags cross_border_fr_1983 outside the 1983-accord cantons", () => {
    const issues = checkClientConsistency({ tax_status: "cross_border_fr_1983", canton: "ZH" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("does not flag cross_border_fr_1983 in an accord canton", () => {
    const issues = checkClientConsistency({ tax_status: "cross_border_fr_1983", canton: "VD" });
    expect(issues.length).toBe(0);
  });

  it("flags single civil status with spouse data filled in", () => {
    const issues = checkClientConsistency({
      civil_status: "single",
      spouse_first_name: "Jean",
    });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("does not flag married civil status with spouse data", () => {
    const issues = checkClientConsistency({
      civil_status: "married",
      spouse_first_name: "Jean",
    });
    expect(issues.length).toBe(0);
  });

  it("flags a child born before the client", () => {
    const issues = checkClientConsistency({
      date_of_birth: "1990-01-01",
      children: [{ date_of_birth: "1980-01-01" }],
    });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags an AVS contribution start year before birth", () => {
    const issues = checkClientConsistency({
      date_of_birth: "1990-01-01",
      avs_contribution_start_year: "1985",
    });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags a future arrival year", () => {
    const issues = checkClientConsistency({
      date_of_birth: "1990-01-01",
      arrival_year_ch: String(new Date().getFullYear() + 5),
    });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("returns no issues for a coherent ordinary resident profile", () => {
    const issues = checkClientConsistency({
      date_of_birth: "1990-01-01",
      nationality: "CH",
      permit: "swiss",
      country_of_residence: "CH",
      canton: "VD",
      tax_status: "resident",
      civil_status: "single",
      avs_contribution_start_year: "2010",
    });
    expect(issues.length).toBe(0);
  });

  it("returns no issues for a coherent frontalier profile", () => {
    const issues = checkClientConsistency({
      date_of_birth: "1990-01-01",
      nationality: "FR",
      permit: "G",
      country_of_residence: "FR",
      canton: "GE",
      tax_status: "cross_border_ge",
      civil_status: "single",
    });
    expect(issues.length).toBe(0);
  });
});
