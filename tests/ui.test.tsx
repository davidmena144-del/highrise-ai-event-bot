// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App, makeController } from "../src/ui/App";

afterEach(cleanup);

describe("Arabic RTL dashboard", () => {
  it("renders the dashboard in Arabic with RTL direction", () => {
    render(<App controller={makeController()} />);
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(screen.getByText("لوحة المتابعة")).toBeInTheDocument();
    expect(screen.getByText("الطاقة الحالية")).toBeInTheDocument();
    expect(screen.getByText("التذاكر")).toBeInTheDocument();
    expect(screen.getByText("درجة التحسين")).toBeInTheDocument();
    expect(screen.getByText("حالة النظام")).toBeInTheDocument();
  });

  it("always shows a prominent Stop Now button", () => {
    render(<App controller={makeController()} />);
    const stop = screen.getByTestId("stop-now");
    expect(stop).toBeInTheDocument();
    expect(stop.textContent).toContain("إيقاف فوري");
    expect(stop).toBeDisabled(); // nothing running yet
  });

  it("labels the simulator as a simulation", () => {
    render(<App controller={makeController()} />);
    expect(screen.getAllByText(/محاكاة/).length).toBeGreaterThan(0);
  });

  it("navigates to all nine screens", () => {
    render(<App controller={makeController()} />);
    const tabs = Array.from(document.querySelectorAll("nav button"));
    expect(tabs).toHaveLength(9);
    for (const tab of tabs) fireEvent.click(tab);
    // Last tab is Settings.
    expect(screen.getByText("مصفوفة القدرات الرسمية")).toBeInTheDocument();
    // Back to the dashboard.
    fireEvent.click(tabs[0]);
    expect(screen.getByText("درجة التحسين")).toBeInTheDocument();
  });

  it("shows the official capability matrix in settings", () => {
    render(<App controller={makeController()} />);
    const tabs = Array.from(document.querySelectorAll("nav button"));
    fireEvent.click(tabs[tabs.length - 1]);
    expect(screen.getByText("Execute event actions")).toBeInTheDocument();
  });

  it("stop now ends a running auto play session", () => {
    const ctrl = makeController();
    render(<App controller={ctrl} />);
    act(() => ctrl.start());
    fireEvent.click(screen.getByTestId("stop-now"));
    expect(ctrl.autoPlayer.getStatus()).toBe("stopped");
    expect(ctrl.report).not.toBeNull();
    expect(ctrl.report!.endedBy).toBe("stopped");
  });
});

describe("web app extras", () => {
  it("shows SIMULATION badge in simulator mode and a logout button", () => {
    render(<App controller={makeController()} />);
    expect(screen.getByText(/SIMULATION/)).toBeInTheDocument();
    expect(screen.getByTestId("logout")).toBeInTheDocument();
  });
  it("stop button stays in the sticky header", () => {
    render(<App controller={makeController()} />);
    const header = screen.getByTestId("stop-now").closest("header")!;
    expect(header.className).toContain("sticky");
  });
});
