const claimCallbackId = "chores_claim";

const head = {
    "type": "modal",
    "title": { "type": "plain_text", "text": "Chores", "emoji": true },
    "submit": { "type": "plain_text", "text": "Submit", "emoji": true },
    "close": { "type": "plain_text", "text": "Cancel", "emoji": true }
}

function claim(acts) {
  const mappedActs = acts.map((act, index) => {
    return {
      "value": `${index}`,
      "text": { "type": "plain_text", "text": act.chore_name, "emoji": true },
      "description": { "type": "plain_text", "text": `${act.value}.${act.id}` }
    }
  });

  const body = {
    "callback_id": claimCallbackId,
    "blocks": [
      {
        "type": "input",
        "block_id": "input",
        "label": { "type": "plain_text", "text": "🧹 Claim a chore", "emoji": true },
        "element": { "type": "radio_buttons", "action_id": "options", "options": mappedActs }
      }
    ]
  }

  return { ...head, ...body };
}

exports.claimCallbackId = claimCallbackId;
exports.claim = claim;
