const head = {
  "type": "modal",
  "title": { "type": "plain_text", "text": "Chores", "emoji": true },
  "submit": { "type": "plain_text", "text": "Submit", "emoji": true },
  "close": { "type": "plain_text", "text": "Cancel", "emoji": true }
}

function list(choreActs) {
const mappedChoreActs = choreActs.map((choreAct, index) => {
  return {
    "value": `${index}`,
    "text": { "type": "plain_text", "text": choreAct.chore_name, "emoji": true },
    "description": { "type": "plain_text", "text": `${choreAct.value}.${choreAct.id}` }
  }
});

const body = {
  "blocks": [
    {
      "type": "input",
      "block_id": "input",
      "label": { "type": "plain_text", "text": "Claim a chore", "emoji": true },
      "element": { "type": "radio_buttons", "action_id": "options", "options": mappedChoreActs }
    }
  ]
}

return { ...head, ...body };
}

exports.list = list;
