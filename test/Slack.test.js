const assert = require("assert");

const itParam = require("mocha-param");
const rewire = require("rewire");

const SlackModule = rewire("../Slack.js");
const composeText = SlackModule.__get__("composeText");

describe("Slack", () => {
  describe(composeText.name,  () => {
    const composeTextParams = [
      {
        desc: "next and after next differ, no markdown",
        next: {name: "Alex", slackId: "UA1E5"},
        nextAfter: {name: "Bob", slackId: "UB0BB"},
        markdown: false,
        expected: "Hello! This is a friendly reminder that Alex is hosting today's stand-up meeting. Next time it's Bob's turn",
      },
      {
        desc: "next and after next the same, no markdown",
        next: {name: "Alex", slackId: "UA1E5"},
        nextAfter: {name: "Alex", slackId: "UA1E5"},
        markdown: false,
        expected: "Hello! This is a friendly reminder that Alex is hosting today's stand-up meeting. Next time it's Alex's turn again",
      },
      {
        desc: "next after ends with 's', no markdown",
        next: {name: "Bob", slackId: "UB0BB"},
        nextAfter: {name: "James", slackId: "UD435"},
        markdown: false,
        expected: "Hello! This is a friendly reminder that Bob is hosting today's stand-up meeting. Next time it's James' turn",
      },
      {
        desc: "next and after next differ, with markdown",
        next: {name: "Alex", slackId: "UA1E5"},
        nextAfter: {name: "Bob", slackId: "UB0BB"},
        markdown: true,
        expected: "Hello!\n\nThis is a friendly reminder that <@UA1E5> is hosting today's stand-up meeting\n\n_Next time it's *Bob*'s turn_",
      },
      {
        desc: "next and after next the same, with markdown",
        next: {name: "Alex", slackId: "UA1E5"},
        nextAfter: {name: "Alex", slackId: "UA1E5"},
        markdown: true,
        expected: "Hello!\n\nThis is a friendly reminder that <@UA1E5> is hosting today's stand-up meeting\n\n_Next time it's *Alex*'s turn again_",
      },
      {
        desc: "next after ends with 's', with markdown",
        next: {name: "Bob", slackId: "UB0BB"},
        nextAfter: {name: "James", slackId: "UD435"},
        markdown: true,
        expected: "Hello!\n\nThis is a friendly reminder that <@UB0BB> is hosting today's stand-up meeting\n\n_Next time it's *James*' turn_",
      },
      {
        desc: "no after next, no markdown",
        next: {name: "Alex", slackId: "UA1E5"},
        nextAfter: undefined,
        markdown: false,
        expected: "Hello! This is a friendly reminder that Alex is hosting today's stand-up meeting. Next time it's Alex's turn again",
      },
    ];

    itParam("${value.desc}", composeTextParams, (value) => {
      assert.strictEqual(composeText(value.next, value.nextAfter, value.markdown), value.expected);
    });
  });
});
