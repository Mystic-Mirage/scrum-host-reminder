/**
 * Create a plain/markdown message
 *
 * @param {Host} next
 * @param {Host | undefined} nextAfter
 * @param {boolean} [markdown=false]
 * @returns {string}
 */
function composeText(next, nextAfter, markdown= false) {
  if (!nextAfter) {
    nextAfter = next;
  }

  let nextName, nextAfterName, period, separator;
  if (markdown) {
    nextName = `<@${next.slackId}>`;
    nextAfterName = `*${nextAfter.name}*`;
    period = "";
    separator = "\n\n";
  } else {
    nextName = next.name;
    nextAfterName = nextAfter.name;
    period = ".";
    separator = " ";
  }

  const possessiveMarker = nextAfter.name.endsWith("s") ? "'" : "'s";
  const adverb = next.slackId === nextAfter.slackId ? " again" : ""
  const footer = `Next time it's ${nextAfterName}${possessiveMarker} turn${adverb}`;

  const messageLines = [
    "Hello!",
    `This is a friendly reminder that ${nextName} is hosting today's stand-up meeting${period}`,
    markdown ? `_${footer}_` : footer,
  ]

  return messageLines.join(separator);
}

/**
 * Remove buttons from message blocks
 *
 * @param {Object[]} blocks
 * @param {string} blocks[].type
 * @returns {Object[]}
 */
function removeActions(blocks) {
  return blocks.filter((block) => block.type !== "actions");
}

/**
 * Working with Slack API
 */
class Slack {
  constructor() {
    const props = PropertiesService.getScriptProperties().getProperties();
    /** @private */
    this.appId = props.SLACK_APP_ID;
    /** @private */
    this.token = props.SLACK_TOKEN;
    /** @private */
    this.url = "https://slack.com/api/";
  }

 /**
  * Generate API URL with specified path
  *
  * @private
  * @param {string} path
  * @returns {string}
  */
  apiUrl(path) {
    return `${this.url}${path}`;
  }

  /**
   * Fill content type and authorization header for UrlFetchApp.fetch
   *
   * @private
   * @param {{[p: string]: string}} [data]
   * @returns {URL_Fetch.URLFetchRequestOptions}
   */
  prepareFetchParams(data) {
    const params = {
      contentType: "application/json; charset=utf-8",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    };
    return {...params, ...data};
  }

  /**
   * Perform POST-request
   *
   * @private
   * @param {string} url
   * @param {{[p: string]: any}} data
   */
  post(url, data) {
    const params = this.prepareFetchParams(
      {
        method: "post",
        payload: JSON.stringify(data),
      }
    );

    const result = UrlFetchApp.fetch(url, params);
    console.log(result.getContentText());
  }

  /**
   * Slack API helper for POST-requests
   *
   * @private
   * @param {string} path
   * @param {{[p: string]: any}} data
   */
  postApi(path, data) {
    const url = this.apiUrl(path);
    this.post(url, data);
  }

  /**
   * Generate GET-request parameters string using data specified
   *
   * @private
   * @param {{[p: string]: any}} data
   * @returns {string}
   */
  static getParams(data) {
    const params = Object.entries(data).map(([k, v]) => `${k}=${v}`);
    if (params) return `?${params.join("&")}`;
    return "";
  }

  /**
   * Slack API helper for GET-requests
   *
   * @private
   * @param {string} path
   * @param {{[p: string]: string}} data
   * @returns {Object}
   */
  getApi(path, data) {
    const url = this.apiUrl(path) + this.constructor.getParams(data);
    const params = this.prepareFetchParams();

    const response = UrlFetchApp.fetch(url, params);
    const content = response.getContentText();
    console.log(content);
    return JSON.parse(content);
  }

  /**
   * Get Slack channel messages
   *
   * @private
   * @param {string} channelId
   * @returns {Object}
   */
  *readHistory(channelId) {
    let nextCursor = "";
    for (let repeat = 0; repeat < 10; repeat++) {
      const data = {
        channel: channelId,
        cursor: nextCursor,
      };
      const history = this.getApi("conversations.history", data);

      if (!history.messages) break;

      for (const message of history.messages) {
        yield message;
      }

      if (!history.has_more) break;

      nextCursor = history.response_metadata.next_cursor;
    }
  }

  /**
   * Get Slack channel member IDs
   *
   * @param {string} channelId
   * @returns {string[]}
   */
  getMembers(channelId) {
    const result = this.getApi("conversations.members", {channel: channelId});
    return result.members;
  }

  /**
   * Get user info by user ID
   *
   * @param {string} userId
   * @returns {{real_name: string, is_bot: boolean}}
   */
  getUserInfo(userId) {
    const result = this.getApi("users.info", {user: userId});
    return result.user;
  }

  /**
   * Remove buttons from the previous message
   *
   * @param {string} channelId
   */
  disarmLastMessage(channelId) {
    for (const message of this.readHistory(channelId)) {
      if (message.app_id === this.appId) {
        const data = {
          channel: channelId,
          ts: message.ts,
          blocks: removeActions(message.blocks),
        };

        this.postApi("chat.update", data);
        break;
      }
    }
  }

  /**
   * Add `Sipped` mark to a message
   *
   * @param {Object} message
   * @param {Object[]} message.blocks
   * @param {string} responseUrl
   */
  markMessageSkipped(message, responseUrl) {
    const blocks = removeActions(message.blocks);
    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*` Skipped `*",
        },
      },
    );

    const data = {
      blocks,
      replace_original: true,
    };

    this.post(responseUrl, data);
  }

  /**
   * Post message to Slack channel
   * Change existing message if responseUrl is specified
   * Delete previous and post a new one if not
   *
   * @param {Host} next
   * @param {Host} nextAfter
   * @param {string} channelId
   * @param {string} [responseUrl]
   */
  sendMessage(next, nextAfter, channelId, responseUrl) {
    const data = {
      text: composeText(next, nextAfter),
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: composeText(next, nextAfter, true),
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Skip the meeting",
              },
              style: "danger",
              confirm: {
                title: {
                    type: "plain_text",
                    text: "Skip the meeting",
                },
                text: {
                    type: "plain_text",
                    text: "Re-select today's host for the next meeting?",
                },
                confirm: {
                    type: "plain_text",
                    text: "Yes",
                },
                deny: {
                    type: "plain_text",
                    text: "No",
                },
              },
              action_id: "skip-meeting",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Next host",
              },
              style: "primary",
              confirm: {
                title: {
                    type: "plain_text",
                    text: "Next host"
                },
                text: {
                    type: "plain_text",
                    text: "Select a new host for today's meeting?",
                },
                confirm: {
                    type: "plain_text",
                    text: "Yes",
                },
                deny: {
                    type: "plain_text",
                    text: "No",
                },
              },
              action_id: "next-host",
            },
          ],
        },
      ],
    };

    if (responseUrl) {
      data.replace_original = true;
      this.post(responseUrl, data);
    } else if (channelId) {
      this.disarmLastMessage(channelId);
      data.channel = channelId;
      this.postApi("chat.postMessage", data);
    }
  }

  /**
   * Add integration (bot) to a channel
   *
   * @param {string} channelId
   */
  joinChannel(channelId) {
    this.postApi("conversations.join", {channel: channelId});
  }

  /**
   * Remove integration (bot) from a channel
   *
   * @param {string} channelId
   */
  leaveChannel(channelId) {
    this.postApi("conversations.leave", {channel: channelId});
  }

  /**
   * Check a channel validity/accessibility
   *
   * @param {string} channelId
   * @returns {boolean}
   */
  checkChannel(channelId) {
    const result = this.getApi("conversations.info", {channel: channelId});
    return result.ok;
  }

}

function debugGetMembers() {
  const sheet = SpreadsheetApp.getActive().getSheets()[1];
  const slack = new Slack();
  console.log(slack.getMembers(sheet.getName()));
}

function debugGetUserInfo() {
  const sheet = SpreadsheetApp.getActive().getSheets()[1];
  const userId = sheet.getRange(1, 2).getValue();
  const slack = new Slack();
  console.log(slack.getUserInfo(userId));
}

function debugReadHistory() {
  const sheet = SpreadsheetApp.getActive().getSheets()[1];
  const channelId = sheet.getName();
  const slack = new Slack();
  let count = 0;
  for (const message of slack.readHistory(channelId)) {
    console.log(message.ts, message.text);
    count += 1;
  }
  console.log(count);
}
