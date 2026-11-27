import {describe, expect, it} from "vite-plus/test";

import {contactEmail, htmlToText, previewOf, slugOfAddress} from "./contact-email";

describe("contact email", () => {
  it("is the slug in lower case", () => {
    expect(contactEmail("ChatotDHHunt")).toBe("chatotdhhunt@wafflehaus.io");
  });

  it("finds the slug from an address, ignoring case and +tags", () => {
    expect(slugOfAddress("ChatotDHHunt@wafflehaus.io")).toBe("chatotdhhunt");
    expect(slugOfAddress("night-owls+mit2027@wafflehaus.io")).toBe("night-owls");
  });
});

describe("htmlToText", () => {
  it("keeps the words and the line breaks, and drops styles and scripts", () => {
    const html =
      "<html><head><style>p{color:red}</style></head><body><p>Hi&nbsp;team,</p><div>Round 2 &amp; the <b>meta</b> are open.<br>Good luck!</div><script>alert(1)</script><ul><li>One</li><li>Two</li></ul></body></html>";
    expect(htmlToText(html)).toBe(
      "Hi team,\nRound 2 & the meta are open.\nGood luck!\n• One\n• Two"
    );
  });

  it("decodes numeric entities, and a double-escaped one only once", () => {
    expect(htmlToText("caf&#233; &#x2014; &amp;lt;tag&amp;gt;")).toBe("café — &lt;tag&gt;");
  });
});

describe("previewOf", () => {
  it("puts it on one line and cuts it short", () => {
    expect(previewOf("Hello\n\n  there")).toBe("Hello there");
    expect(previewOf("a".repeat(10), 5)).toBe("aaaa…");
  });
});
