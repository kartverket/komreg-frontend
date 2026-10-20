import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { ToolInfoBox } from "./ToolInfoBox";

describe("ToolInfoBox", () => {
  it("is only shown while its tool is active", () => {
    const { rerender } = render(
      <ToolInfoBox isActive={true}>Instruksjon for aktivt verktøy</ToolInfoBox>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Instruksjon for aktivt verktøy");

    rerender(<ToolInfoBox isActive={false}>Instruksjon for aktivt verktøy</ToolInfoBox>);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
