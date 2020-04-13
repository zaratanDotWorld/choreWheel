const claimCallbackId = "chores_claim";
const tuneCallbackId = "chores_tune";

function claim(acts) {
  const mappedActs = acts.map((act, index) => {
    return {
      "value": index.toString(),
      "text": { "type": "plain_text", "text": act.chore_name, "emoji": true },
      "description": { "type": "plain_text", "text": `${act.value}.${act.id}` }
    }
  });

  return {
    "type": "modal",
    "callback_id": claimCallbackId,
    "title": { "type": "plain_text", "text": "Chores", "emoji": true },
    "submit": { "type": "plain_text", "text": "Submit", "emoji": true },
    "close": { "type": "plain_text", "text": "Cancel", "emoji": true },
    "blocks": [
      {
        "type": "input",
        "block_id": "act_input",
        "label": { "type": "plain_text", "text": "🧹 Claim a chore", "emoji": true },
        "element": { "type": "radio_buttons", "action_id": "act_select", "options": mappedActs }
      }
    ]
  }
}

function tune(chores) {
  const mappedChores = chores.map((chore, index) => {
    return {
      "value": index.toString(),
      "text": { "type": "plain_text", "text": chore.name, "emoji": true },
      "description": { "type": "plain_text", "text": `${chore.name}.${chore.id}` }
    }
  });

  return {
    "type": "modal",
    "callback_id": tuneCallbackId,
    "title": { "type": "plain_text", "text": "Chores", "emoji": true },
    "submit": { "type": "plain_text", "text": "Submit", "emoji": true },
    "close": { "type": "plain_text", "text": "Cancel", "emoji": true },
    "blocks": [
      {
        "type": "input",
        "block_id": "act_input",
        "label": { "type": "plain_text", "text": "🧹 Choose a chore", "emoji": true },
        "element": { "type": "radio_buttons", "action_id": "act_select", "options": mappedChores }
      }
    ]
  }
}

exports.claimCallbackId = claimCallbackId;
exports.tuneCallbackId = tuneCallbackId;
exports.claim = claim;
exports.tune = tune;
