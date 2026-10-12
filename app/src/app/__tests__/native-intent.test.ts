import { redirectSystemPath } from "../+native-intent";

describe("redirectSystemPath", () => {
  it("swallows the Google Calendar callback while the app is running", () => {
    expect(
      redirectSystemPath({ path: "app://?state=abc&code=4/0Ab&scope=calendar.events", initial: false }),
    ).toBeNull();
    expect(
      redirectSystemPath({ path: "app://?error=access_denied&state=abc", initial: false }),
    ).toBeNull();
  });

  it("sends a cold start from the callback home", () => {
    expect(redirectSystemPath({ path: "app://?state=abc&code=4/0Ab", initial: true })).toBe("/");
  });

  it("leaves every other link alone", () => {
    expect(redirectSystemPath({ path: "app://auth/verify?token=t", initial: false })).toBe(
      "app://auth/verify?token=t",
    );
    expect(redirectSystemPath({ path: "/resource/123", initial: true })).toBe("/resource/123");
    expect(redirectSystemPath({ path: "app://reset-password?token=t", initial: false })).toBe(
      "app://reset-password?token=t",
    );
  });
});
